/**
 * Mantenimiento: deduplica PERSONAS en BD — borra los contactos duplicados y deja
 * solo el registro limpio (el más completo), rellenándole los huecos con lo que
 * aportaban los borrados.
 *
 * Ámbito de comparación: la ORGANIZACIÓN (todos los registros SAP del mismo CIF);
 * para clientes sin organización, el propio registro. Aplica a `contacts` (CRM)
 * y a `organization_contacts` (gestor/titular), cada tabla por separado.
 *
 * Reglas de fusión (más estrictas que la dedup de presentación, porque aquí se BORRA):
 *   a) mismo email (case-insensitive) → misma persona;
 *   b) la víctima NO tiene email y su nombre normalizado coincide;
 *   c) la víctima NO tiene email, su nombre está a distancia de edición ≤ 1
 *      (erratas: "Antonio/Antonia Mª Hidalgo", nombres de ≥10 chars) y además no
 *      aporta un teléfono distinto del superviviente.
 *   → Nunca se fusionan dos filas con emails DISTINTOS (podrían ser dos buzones reales).
 *
 * Superviviente: email 'Válido' > tiene email > más campos rellenos > nombre más largo > menor id.
 * Consentimientos RGPD: combinación conservadora (un 'false' domina sobre 'true').
 *
 * ⚠ Tras re-ejecutar el seed 06 (contactos CRM) o el 12 (gestor/titular) hay que
 *   volver a pasar este script: las cargas reintroducen los duplicados del Excel.
 *
 * Uso:
 *   npm run seed:dedupe-contacts            → ejecuta (borra)
 *   tsx prisma/seeds/16-dedupe-contacts.ts --dry   → solo informa, no toca nada
 */

import { prisma } from './lib/prisma';

const DELETE_BATCH = 1000;

// ───────── helpers de comparación (mismos criterios que la dedup de presentación) ─────────

function normName(name: string | null): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/^(mr|ms|mrs|sr|sra|srta|d|dña|don|doña)[.\s]+/i, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .trim();
}

function editDistanceLeq1(a: string, b: string): boolean {
  if (a === b) return true;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  if (la > lb) return editDistanceLeq1(b, a);
  let i = 0, j = 0, edits = 0;
  while (i < la && j < lb) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (la === lb) { i++; j++; } else j++;
  }
  return edits + (lb - j) + (la - i) <= 1;
}

/** Solo dígitos del teléfono, para comparar "+34 956 62 94 74" con "956629474". */
function normPhone(v: string | null): string {
  return (v ?? '').replace(/\D/g, '');
}

/** RGPD conservador: si algún registro dice 'false', gana 'false'; si no, cualquier 'true'; si no, null. */
function combineConsent(a: boolean | null, b: boolean | null): boolean | null {
  if (a === false || b === false) return false;
  if (a === true || b === true) return true;
  return null;
}

type Row = {
  id: number;
  scope: string;            // 'o<orgId>' o 'c<customerId>'
  fullName: string;
  email: string | null;
  emailOk: boolean;         // email validado ('Válido' CRM / 'VALIDO' org)
  phone: string | null;
  mobile: string | null;
  fields: Record<string, unknown>; // campos rellenables (para fundir huecos)
  consents?: Record<string, boolean | null>;
};

type Plan = {
  updates: Map<number, Record<string, unknown>>; // id superviviente → campos a actualizar
  deletes: number[];
  mergedPairs: Array<{ keep: Row; drop: Row; rule: string }>;
};

/** Nº de campos con valor (para elegir al más completo). */
function richness(r: Row): number {
  let n = Object.values(r.fields).filter(v => v != null).length;
  if (r.email) n += 2;
  if (r.emailOk) n += 2;
  return n;
}

/** Deduplica las filas de un ámbito y acumula el plan de updates/deletes. */
function dedupeScope(rows: Row[], plan: Plan): void {
  // Supervivientes primero: validado > email > completo > nombre largo > id.
  const ordered = [...rows].sort((a, b) =>
    Number(b.emailOk) - Number(a.emailOk) ||
    Number(!!b.email) - Number(!!a.email) ||
    richness(b) - richness(a) ||
    b.fullName.length - a.fullName.length ||
    a.id - b.id
  );

  const byEmail = new Map<string, Row>();
  const byName = new Map<string, Row>();
  const survivors: Row[] = [];

  for (const r of ordered) {
    const emailKey = r.email?.toLowerCase();
    const nameKey = normName(r.fullName);

    // a) mismo email
    let target = emailKey ? byEmail.get(emailKey) : undefined;
    let rule = 'email';

    // b) sin email + nombre exacto
    if (!target && !emailKey && nameKey) {
      target = byName.get(nameKey);
      rule = 'nombre';
    }

    // c) sin email + errata (distancia 1) + sin teléfono contradictorio
    if (!target && !emailKey && nameKey.length >= 10) {
      for (const [n, s] of byName) {
        if (!editDistanceLeq1(nameKey, n)) continue;
        const vPhone = normPhone(r.phone) || normPhone(r.mobile);
        const phoneCompatible = !vPhone || vPhone === normPhone(s.phone) || vPhone === normPhone(s.mobile);
        if (phoneCompatible) { target = s; rule = 'errata'; break; }
      }
    }

    if (!target) {
      survivors.push(r);
      if (emailKey) byEmail.set(emailKey, r);
      if (nameKey && !byName.has(nameKey)) byName.set(nameKey, r);
      continue;
    }

    // Fundir la víctima en el superviviente: rellenar huecos + nombre más completo.
    const upd = plan.updates.get(target.id) ?? {};
    if (r.fullName.length > target.fullName.length && (upd.fullName == null)) {
      upd.fullName = r.fullName;
      target.fullName = r.fullName;
      // Registrar también el nombre adoptado: otras filas con ese nombre deben caer aquí.
      const adopted = normName(target.fullName);
      if (adopted && !byName.has(adopted)) byName.set(adopted, target);
    }
    for (const [k, v] of Object.entries(r.fields)) {
      if (v != null && target.fields[k] == null && upd[k] === undefined) {
        upd[k] = v;
        target.fields[k] = v;
      }
    }
    if (target.consents && r.consents) {
      for (const k of Object.keys(target.consents)) {
        const combined = combineConsent(target.consents[k]!, r.consents[k]!);
        if (combined !== target.consents[k]) {
          upd[k] = combined;
          target.consents[k] = combined;
        }
      }
    }
    if (Object.keys(upd).length > 0) plan.updates.set(target.id, upd);
    plan.deletes.push(r.id);
    plan.mergedPairs.push({ keep: target, drop: r, rule });
  }
}

// ───────── pasada sobre `contacts` (CRM) ─────────

async function dedupeCrmContacts(dry: boolean): Promise<void> {
  console.log('\n👥 contacts (CRM) — ámbito: organización (o registro suelto)…');
  const rows = await prisma.contact.findMany({
    select: {
      contactId: true, customerId: true, fullName: true, firstName: true, lastName: true,
      title: true, email: true, phone: true, mobile: true, contactPosition: true,
      emailValidation: true, postalCode: true, entityId: true, buId: true,
      consentEmail: true, consentFax: true, consentLetter: true, consentPhone: true, consentSms: true,
      customer: { select: { orgId: true } },
    },
  });

  const byScope = new Map<string, Row[]>();
  for (const c of rows) {
    const scope = c.customer.orgId != null ? `o${c.customer.orgId}` : `c${c.customerId}`;
    const row: Row = {
      id: c.contactId,
      scope,
      fullName: c.fullName,
      email: c.email,
      emailOk: c.emailValidation === 'Válido',
      phone: c.phone,
      mobile: c.mobile,
      fields: {
        title: c.title, firstName: c.firstName, lastName: c.lastName,
        contactPosition: c.contactPosition, phone: c.phone, mobile: c.mobile,
        postalCode: c.postalCode, entityId: c.entityId, buId: c.buId,
      },
      consents: {
        consentEmail: c.consentEmail, consentFax: c.consentFax, consentLetter: c.consentLetter,
        consentPhone: c.consentPhone, consentSms: c.consentSms,
      },
    };
    (byScope.get(scope) ?? byScope.set(scope, []).get(scope)!).push(row);
  }

  const plan: Plan = { updates: new Map(), deletes: [], mergedPairs: [] };
  for (const rows of byScope.values()) if (rows.length > 1) dedupeScope(rows, plan);

  const byRule = plan.mergedPairs.reduce<Record<string, number>>((acc, p) => {
    acc[p.rule] = (acc[p.rule] ?? 0) + 1; return acc;
  }, {});
  console.log(`   ${rows.length} contactos → ${plan.deletes.length} duplicados a borrar` +
    ` (email: ${byRule.email ?? 0} · nombre: ${byRule.nombre ?? 0} · errata: ${byRule.errata ?? 0})` +
    ` · ${plan.updates.size} supervivientes a enriquecer`);

  if (dry) {
    for (const p of plan.mergedPairs.slice(0, 15)) {
      console.log(`     [${p.rule}] BORRA #${p.drop.id} "${p.drop.fullName}" → QUEDA #${p.keep.id} "${p.keep.fullName}"`);
    }
    if (plan.mergedPairs.length > 15) console.log(`     … y ${plan.mergedPairs.length - 15} más`);
    return;
  }

  for (const [contactId, data] of plan.updates) {
    await prisma.contact.update({ where: { contactId }, data });
  }
  let deleted = 0;
  for (let i = 0; i < plan.deletes.length; i += DELETE_BATCH) {
    const res = await prisma.contact.deleteMany({ where: { contactId: { in: plan.deletes.slice(i, i + DELETE_BATCH) } } });
    deleted += res.count;
  }
  console.log(`   ✔ borrados ${deleted} · enriquecidos ${plan.updates.size}`);
}

// ───────── pasada sobre `organization_contacts` (gestor/titular) ─────────

async function dedupeOrgContacts(dry: boolean): Promise<void> {
  console.log('\n🛠  organization_contacts (gestor/titular) — ámbito: organización…');
  const rows = await prisma.organizationContact.findMany({
    select: {
      orgContactId: true, orgId: true, role: true, fullName: true, firstName: true, lastName: true,
      email: true, phone: true, mobile: true, fax: true, emailValidation: true,
    },
  });

  const byScope = new Map<string, Row[]>();
  for (const c of rows) {
    // El rol forma parte del ámbito: un GESTOR y un TITULAR homónimos son relaciones distintas.
    const scope = `o${c.orgId}-${c.role ?? ''}`;
    const row: Row = {
      id: c.orgContactId,
      scope,
      fullName: c.fullName ?? '',
      email: c.email,
      emailOk: c.emailValidation === 'VALIDO',
      phone: c.phone,
      mobile: c.mobile,
      fields: {
        firstName: c.firstName, lastName: c.lastName,
        phone: c.phone, mobile: c.mobile, fax: c.fax,
      },
    };
    (byScope.get(scope) ?? byScope.set(scope, []).get(scope)!).push(row);
  }

  const plan: Plan = { updates: new Map(), deletes: [], mergedPairs: [] };
  for (const rows of byScope.values()) if (rows.length > 1) dedupeScope(rows, plan);

  console.log(`   ${rows.length} contactos → ${plan.deletes.length} duplicados a borrar · ${plan.updates.size} a enriquecer`);
  if (dry) return;

  for (const [orgContactId, data] of plan.updates) {
    await prisma.organizationContact.update({ where: { orgContactId }, data });
  }
  let deleted = 0;
  for (let i = 0; i < plan.deletes.length; i += DELETE_BATCH) {
    const res = await prisma.organizationContact.deleteMany({ where: { orgContactId: { in: plan.deletes.slice(i, i + DELETE_BATCH) } } });
    deleted += res.count;
  }
  console.log(`   ✔ borrados ${deleted} · enriquecidos ${plan.updates.size}`);
}

export async function dedupeContacts(dry = false): Promise<void> {
  console.log(`🧹 Deduplicación de contactos en BD${dry ? ' — DRY RUN (no borra nada)' : ''}`);

  // Normalización previa (2026-06-10): el rol 'MANTENEDOR' pasó a llamarse 'GESTOR'.
  // Sanea BDs cargadas con el seed 12 antiguo. Idempotente (0 filas si ya está limpio).
  if (!dry) {
    const renamed = await prisma.organizationContact.updateMany({
      where: { role: 'MANTENEDOR' },
      data: { role: 'GESTOR' },
    });
    if (renamed.count > 0) console.log(`   ♻ Roles renombrados MANTENEDOR → GESTOR: ${renamed.count}`);
  }

  await dedupeCrmContacts(dry);
  await dedupeOrgContacts(dry);
}

if (require.main === module) {
  const dry = process.argv.includes('--dry');
  dedupeContacts(dry)
    .then(() => prisma.$disconnect())
    .catch(err => {
      console.error(err);
      prisma.$disconnect();
      process.exit(1);
    });
}
