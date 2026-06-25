/**
 * Cliente del web service SOAP de login corporativo (INSPECCION_SA / TÜV LFD).
 *
 * Es un servicio ASMX (ASP.NET, SOAP 1.1) que actúa de fachada sobre el Active
 * Directory: la app NO habla LDAP directo, sino que invoca estas operaciones.
 * WSDL: https://gestion.atisae.com/loginwebservice/login.asmx?WSDL
 *
 * Operaciones que usamos:
 *  - LoginLDAP_AD(user, password, passport)  → valida credenciales contra AD.
 *  - ExisteUsuarioLDAP_AD(user, passport)    → comprueba existencia + datos del usuario.
 *
 * SOLO debe importarse desde código server-side (usa secretos de entorno y no
 * debe llegar nunca al bundle del cliente).
 */

import { createHash } from 'crypto'

const SOAP_NS = 'http://tempuri.org/LoginWebService/Login'

const AD_SOAP_URL =
  process.env.AD_SOAP_URL ?? 'https://gestion.atisae.com/loginwebservice/login.asmx'

/**
 * Clave de encriptación LDAP (`CLAVE_ENCRIPTACION_LDAP`) compartida con el web
 * service. Secreta: va en `.env` (`AD_SOAP_LDAP_KEY`), NO se versiona.
 */
const AD_SOAP_LDAP_KEY = process.env.AD_SOAP_LDAP_KEY ?? ''

/**
 * Formato del hash que produce la función `Encripta()` de las apps internas.
 * Por defecto hex en minúsculas sobre bytes UTF-8; configurable por si Encripta
 * usa hex en mayúsculas / Base64 u otro encoding (lo determina probe-ad-passport).
 *   AD_SOAP_PASSPORT_FMT: 'hex' | 'HEX' | 'base64'
 *   AD_SOAP_PASSPORT_ENC: 'utf8' | 'ascii' | 'latin1' | 'utf16le'
 */
const PASSPORT_FMT = (process.env.AD_SOAP_PASSPORT_FMT ?? 'hex') as 'hex' | 'HEX' | 'base64'
const PASSPORT_ENC = (process.env.AD_SOAP_PASSPORT_ENC ?? 'utf8') as BufferEncoding

/**
 * Calcula el "passport" que exige el web service, replicando la función `Encripta()`
 * de las apps internas:  passport = MD5(user + CLAVE_ENCRIPTACION_LDAP).
 * El `user` concatenado debe ser EXACTAMENTE el mismo string que se envía en <user>.
 */
function computePassport(user: string): string {
  const md5 = createHash('md5').update(Buffer.from(user + AD_SOAP_LDAP_KEY, PASSPORT_ENC)).digest()
  if (PASSPORT_FMT === 'base64') return md5.toString('base64')
  const hex = md5.toString('hex')
  return PASSPORT_FMT === 'HEX' ? hex.toUpperCase() : hex
}

/** Timeout de la llamada SOAP en milisegundos. */
const AD_SOAP_TIMEOUT_MS = Number(process.env.AD_SOAP_TIMEOUT_MS ?? 10000)

/** Resultado del login contra AD (enum `RetornoLogin` del WSDL). */
export type RetornoLogin =
  | 'OK'
  | 'USUARIO_NO_EXISTE'
  | 'CONTRASENNA_INCORRECTA'
  | 'USUARIO_DESHABILITADO'
  | 'ERROR_NO_CONTROLADO'

/** Datos del usuario devueltos por ExisteUsuarioLDAP_AD (tipo `RetornoUsuario` del WSDL). */
export type AdUserLookup = {
  /** Existe la cuenta en el directorio. */
  exists: boolean
  /** El propio servicio reportó un error consultando el LDAP. */
  errorLdap: boolean
  /** La cuenta existe pero está deshabilitada para login. */
  disabled: boolean
  /** sAMAccountName canónico (la casing autoritativa del directorio). */
  samAccountName?: string
  /** Nombre completo para mostrar (fullName → displayName → cn, el primero disponible). */
  fullName?: string
  /** Correo electrónico corporativo. */
  email?: string
}

/** Escapa los 5 caracteres especiales de XML para incrustar valores en el sobre SOAP. */
function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Decodifica entidades XML básicas + numéricas en los valores de la respuesta. */
function xmlDecode(value: string | undefined): string | undefined {
  if (value === undefined) return undefined
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, '&') // el &amp; se decodifica el último para no recomponer otras entidades
}

/**
 * Realiza una llamada SOAP 1.1 al web service y devuelve el cuerpo XML de la
 * respuesta como texto. Lanza si hay timeout, error HTTP o un <soap:Fault>.
 */
async function callSoap(operation: string, innerBody: string): Promise<string> {
  const envelope =
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"' +
    ' xmlns:xsd="http://www.w3.org/2001/XMLSchema"' +
    ' xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">' +
    '<soap:Body>' +
    innerBody +
    '</soap:Body>' +
    '</soap:Envelope>'

  let res: Response
  try {
    res = await fetch(AD_SOAP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: `"${SOAP_NS}/${operation}"`,
      },
      body: envelope,
      signal: AbortSignal.timeout(AD_SOAP_TIMEOUT_MS),
      cache: 'no-store',
    })
  } catch (err) {
    // Timeout (AbortError) o fallo de red/DNS/TLS.
    throw new Error(`Fallo de red invocando ${operation} en el web service de AD: ${(err as Error).message}`)
  }

  const text = await res.text()

  if (!res.ok) {
    // Un passport inválido o un error interno suele venir como HTTP 500 + <soap:Fault>.
    const fault = text.match(/<faultstring[^>]*>([\s\S]*?)<\/faultstring>/)?.[1]
    throw new Error(
      `El web service de AD respondió HTTP ${res.status} en ${operation}` +
        (fault ? `: ${xmlDecode(fault.trim())}` : ''),
    )
  }

  return text
}

/** Extrae el contenido textual de la primera aparición de <tag>...</tag>. */
function pickTag(xml: string, tag: string): string | undefined {
  // Los valores van XML-escapados, así que [^<] nunca corta un valor legítimo.
  const m = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))
  return m ? xmlDecode(m[1]) : undefined
}

/**
 * Acota el XML al cuerpo de la respuesta de la operación esperada
 * (`<OpResponse>…</OpResponse>`, con o sin prefijo de namespace) antes de extraer
 * valores. Endurecimiento (CWE-345): evita que un resultado se lea de un elemento
 * inyectado en otra parte del documento; si el wrapper esperado no aparece, la
 * respuesta se considera no interpretable. NOTA: la garantía de autenticidad real
 * de la respuesta la da TLS (el certificado del host se verifica); esto es defensa
 * en profundidad sobre el parseo.
 */
function scopeToResponse(xml: string, operation: string): string {
  const m = xml.match(
    new RegExp(`<(?:\\w+:)?${operation}Response[^>]*>([\\s\\S]*?)</(?:\\w+:)?${operation}Response>`),
  )
  return m ? m[1] : ''
}

/**
 * Valida usuario + contraseña contra Active Directory vía SOAP.
 * Devuelve el enum `RetornoLogin`; si la respuesta no es interpretable, asume
 * ERROR_NO_CONTROLADO. Propaga (lanza) los fallos de red/HTTP para que el caller
 * los distinga de "credenciales incorrectas".
 */
export async function loginLdapAd(user: string, password: string): Promise<RetornoLogin> {
  const body =
    `<LoginLDAP_AD xmlns="${SOAP_NS}">` +
    `<user>${xmlEscape(user)}</user>` +
    `<password>${xmlEscape(password)}</password>` +
    `<passport>${xmlEscape(computePassport(user))}</passport>` +
    `</LoginLDAP_AD>`

  const xml = await callSoap('LoginLDAP_AD', body)
  const scoped = scopeToResponse(xml, 'LoginLDAP_AD')
  const result = pickTag(scoped, 'LoginLDAP_ADResult') as RetornoLogin | undefined
  return result ?? 'ERROR_NO_CONTROLADO'
}

/**
 * Consulta si un usuario existe en Active Directory y devuelve sus datos
 * (nombre, email, sAMAccountName). NO valida contraseña. Se usa en el alta de
 * usuarios de Focus para autorrellenar nombre y correo desde el directorio.
 */
export async function existeUsuarioLdapAd(user: string): Promise<AdUserLookup> {
  const body =
    `<ExisteUsuarioLDAP_AD xmlns="${SOAP_NS}">` +
    `<user>${xmlEscape(user)}</user>` +
    `<passport>${xmlEscape(computePassport(user))}</passport>` +
    `</ExisteUsuarioLDAP_AD>`

  const xml = await callSoap('ExisteUsuarioLDAP_AD', body)
  const scoped = scopeToResponse(xml, 'ExisteUsuarioLDAP_AD')

  return {
    exists: pickTag(scoped, 'existe') === 'true',
    errorLdap: pickTag(scoped, 'errorLdap') === 'true',
    disabled: pickTag(scoped, 'loginDisabled') === 'true',
    samAccountName: pickTag(scoped, 'sAMAccountName'),
    fullName:
      pickTag(scoped, 'fullName') ||
      pickTag(scoped, 'displayName') ||
      pickTag(scoped, 'cn') ||
      undefined,
    email: pickTag(scoped, 'mail') || undefined,
  }
}

// `normalizeUsername` se movió a `@/lib/username` (helper puro sin secretos) para
// que pueda importarse sin arrastrar este módulo (con AD_SOAP_LDAP_KEY) a un bundle.
export { normalizeUsername } from './username'
