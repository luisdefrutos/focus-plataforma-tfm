/**
 * Diagnóstico del "passport" del web service de login AD.
 *
 * Replica la función Encripta() de las apps internas — passport = MD5(user + CLAVE_
 * ENCRIPTACION_LDAP) — probando combinaciones de formato (hex min/may, Base64) y
 * encoding (utf8/ascii/latin1/utf16le), y consultando ExisteUsuarioLDAP_AD contra
 * el servicio real. La variante que devuelva `existe=true` es la correcta.
 *
 * Lee la clave de `.env` (AD_SOAP_LDAP_KEY) y NUNCA imprime la clave ni el hash:
 * solo el nombre de la variante y el resultado. Seguro para compartir la salida.
 *
 * Uso (desde app/):  npx tsx prisma/seeds/lib/probe-ad-passport.ts [user]
 */
import 'dotenv/config'
import { createHash } from 'crypto'

const URL = process.env.AD_SOAP_URL ?? 'https://gestion.atisae.com/loginwebservice/login.asmx'
const NS = 'http://tempuri.org/LoginWebService/Login'
const KEY = process.env.AD_SOAP_LDAP_KEY ?? ''
const USER = process.argv[2] ?? 'uriza-jo'

if (!KEY) {
  console.error('❌ Falta AD_SOAP_LDAP_KEY en .env. Añádela (sin pegarla en el chat) y reejecuta.')
  process.exit(1)
}

const ENCODINGS: BufferEncoding[] = ['utf8', 'ascii', 'latin1', 'utf16le']
const FORMATS = ['hex', 'HEX', 'base64'] as const

function md5(input: string, enc: BufferEncoding, fmt: (typeof FORMATS)[number]): string {
  const d = createHash('md5').update(Buffer.from(input, enc)).digest()
  if (fmt === 'base64') return d.toString('base64')
  const hex = d.toString('hex')
  return fmt === 'HEX' ? hex.toUpperCase() : hex
}

function xmlEscape(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

async function existe(user: string, passport: string): Promise<string> {
  const body =
    `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">` +
    `<soap:Body><ExisteUsuarioLDAP_AD xmlns="${NS}"><user>${xmlEscape(user)}</user>` +
    `<passport>${xmlEscape(passport)}</passport></ExisteUsuarioLDAP_AD></soap:Body></soap:Envelope>`
  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: `"${NS}/ExisteUsuarioLDAP_AD"` },
    body,
  })
  const text = await res.text()
  const fault = text.match(/<faultstring[^>]*>([\s\S]*?)<\/faultstring>/)?.[1]
  if (fault) return `FAULT: ${fault.trim()}`
  const exists = text.match(/<existe>(.*?)<\/existe>/)?.[1] ?? '?'
  const errLdap = text.match(/<errorLdap>(.*?)<\/errorLdap>/)?.[1] ?? '?'
  // Presencia (NO valores) de los campos de datos que usa el alta para autorrellenar:
  const withValue = (tag: string) => new RegExp(`<${tag}>[^<]+</${tag}>`).test(text)
  const fields = ['fullName', 'displayName', 'mail', 'sAMAccountName', 'cn', 'givenName', 'sn'].filter(withValue)
  return `existe=${exists} errorLdap=${errLdap}` + (exists === 'true' ? ` campos=[${fields.join(',')}]` : '')
}

async function main() {
  console.log(`Probando MD5(user + CLAVE) para user="${USER}" — ${ENCODINGS.length}x${FORMATS.length}x2 variantes\n`)
  let hit = false
  for (const order of ['user+key', 'key+user'] as const) {
    for (const enc of ENCODINGS) {
      for (const fmt of FORMATS) {
        const input = order === 'user+key' ? USER + KEY : KEY + USER
        let r: string
        try {
          r = await existe(USER, md5(input, enc, fmt))
        } catch (e) {
          r = `ERROR ${(e as Error).message}`
        }
        const ok = r.startsWith('existe=true')
        if (ok) hit = true
        console.log(`[${order} enc=${enc} fmt=${fmt}] => ${r}${ok ? '   ✅ <<< ESTA VARIANTE' : ''}`)
      }
    }
  }
  console.log(
    hit
      ? '\n✅ Encontrada. Si NO es (user+key, utf8, hex), fija AD_SOAP_PASSPORT_FMT / AD_SOAP_PASSPORT_ENC en .env con esos valores.'
      : '\n❌ Ninguna variante resolvió. Pide a IT la implementación exacta de Encripta() (puede no ser MD5 simple, o el user concatenado difiere).',
  )
}

main()
