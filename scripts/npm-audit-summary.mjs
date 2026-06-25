#!/usr/bin/env node
/**
 * Convierte la salida de `npm audit --json` en un resumen Markdown que el
 * pipeline publica en la página del run (`##vso[task.uploadsummary]`).
 *
 * Uso:  node scripts/npm-audit-summary.mjs <ruta audit.json> <ruta salida.md>
 *
 * Nunca lanza: ante cualquier problema escribe un Markdown de aviso y sale 0,
 * para no romper el build (la auditoría es informativa).
 */
import { readFileSync, writeFileSync } from 'node:fs';

const [, , inPath = 'audit.json', outPath = 'audit-summary.md'] = process.argv;

const SEV_ORDER = { critical: 0, high: 1, moderate: 2, low: 3, info: 4 };
const SEV_ICON = { critical: '🔴', high: '🟠', moderate: '🟡', low: '⚪', info: 'ℹ️' };

/** Escapa el contenido de una celda de tabla Markdown. */
function cell(s) {
  return String(s ?? '').replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').trim();
}

function fixLabel(fixAvailable) {
  if (fixAvailable === true) return 'sí';
  if (!fixAvailable) return 'no';
  // objeto { name, version, isSemVerMajor }
  const major = fixAvailable.isSemVerMajor ? ' (major)' : '';
  return `sí → ${fixAvailable.name}@${fixAvailable.version}${major}`;
}

/** Saca el primer aviso (título + url) del array `via`. */
function advisory(via) {
  const adv = (via || []).find((v) => v && typeof v === 'object');
  if (!adv) return { title: '', url: '' };
  return { title: adv.title || adv.name || '', url: adv.url || '' };
}

function build(md) {
  let out = '';
  try {
    const json = JSON.parse(readFileSync(inPath, 'utf8'));
    const m = json.metadata?.vulnerabilities ?? {};
    const total = m.total ?? 0;

    out += '## 🔐 Auditoría de dependencias (npm audit)\n\n';

    if (total === 0) {
      out += '✅ **Sin vulnerabilidades conocidas** en las dependencias.\n';
      return out;
    }

    out += `**${total} vulnerabilidad(es)** — `;
    out += `🔴 críticas: ${m.critical ?? 0} · 🟠 altas: ${m.high ?? 0} · `;
    out += `🟡 moderadas: ${m.moderate ?? 0} · ⚪ bajas: ${m.low ?? 0} · ℹ️ info: ${m.info ?? 0}\n\n`;

    const vulns = Object.values(json.vulnerabilities ?? {})
      .sort((a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9)
        || String(a.name).localeCompare(String(b.name)));

    out += '| Paquete | Severidad | Aviso | Rango vulnerable | Fix |\n';
    out += '|---|---|---|---|---|\n';
    for (const v of vulns) {
      const { title, url } = advisory(v.via);
      const sev = `${SEV_ICON[v.severity] ?? ''} ${v.severity ?? ''}`.trim();
      const avisoCell = url ? `[${cell(title || 'ver aviso')}](${url})` : cell(title);
      out += `| ${cell(v.name)} | ${cell(sev)} | ${avisoCell} | ${cell(v.range)} | ${cell(fixLabel(v.fixAvailable))} |\n`;
    }

    out += '\n_Informe completo: artefacto `npm-audit` del run. Auditoría informativa (no bloquea el build)._\n';
    return out;
  } catch (err) {
    return `## 🔐 Auditoría de dependencias (npm audit)\n\n> ⚠️ No se pudo generar el resumen: ${cell(err.message)}\n`;
  }
}

writeFileSync(outPath, build(), 'utf8');
console.log(`Resumen de auditoría escrito en ${outPath}`);
