import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from './prisma'
// AllowedFilters + MODULE_* types imported inside loadUserScope below
import { loginLdapAd, type RetornoLogin } from './ad-soap'
import { normalizeUsername } from './username'
import { recordAuditEvent, clientInfoFromNextAuthReq, clientInfoFromHeaders } from './audit'
import { checkRateLimit, recordFailure, resetRateLimit } from './rate-limit'

// Rate-limiting del login: tras 10 fallos en 15 min (por IP y por usuario) se
// bloquea 15 min. Frena fuerza bruta/password-spraying y evita que Focus dispare
// el lockout del AD corporativo (CWE-307).
const LOGIN_RL = { limit: 10, windowMs: 15 * 60_000, blockMs: 15 * 60_000 } as const

const useSecureCookies = process.env.NODE_ENV === 'production';

// Cada cuánto se recarga el alcance (permisos/BUs/filtros) del usuario desde la
// BD. Al ponerlo a 10 segundos, evitamos saturar el pool de conexiones de Prisma
// (error 'pool timeout') cuando Next.js hace múltiples peticiones simultáneas.
const SCOPE_TTL_MS = 10 * 1000; // 10 segundos

import type { AllowedFilters, ModuleCode } from './access'
import { ALL_MODULES } from './access'

type UserScope = {
  id: string;
  name: string;
  username: string;
  email: string | null;
  permissions: string[];
  bus: string[];
  buIds: number[];
  allowedFilters: AllowedFilters;
  /** null = sin restricción (acceso total). string[] = solo esos módulos. */
  allowedModules: string[] | null;
};

/** Carga permisos + alcance de un usuario activo. Devuelve null si no existe o está inactivo. */
async function loadUserScope(username: string): Promise<UserScope | null> {
  const user = await prisma.appUser.findUnique({
    where: { username },
    include: {
      userRoles: {
        include: {
          role: { include: { rolePermissions: { include: { permission: true } } } },
        },
      },
    },
  })

  if (!user || !user.isActive) return null

  const permissions = new Set<string>()
  user.userRoles.forEach(ur => {
    ur.role.rolePermissions.forEach(rp => {
      permissions.add(rp.permission.permissionCode)
    })
  })

  // Si el rol tiene IAM_MANAGE → acceso total a todos los módulos.
  // Si el rol tiene permisos MODULE_* específicos → solo esos módulos.
  // Si el rol no tiene ningún MODULE_* → acceso a todos (retrocompatibilidad).
  const permArray = Array.from(permissions)
  const modulePerms = permArray.filter(p => p.startsWith('MODULE_')) as ModuleCode[]
  const hasAllModules = modulePerms.length === 0
  const allowedModules: string[] | null = hasAllModules ? null : modulePerms

  const allBus = await prisma.businessUnit.findMany({ select: { buId: true, buCode: true } })

  // Leer filtros granulares reales almacenados en BD (puede ser null → sin restricción).
  const rawFilters = user.allowedFilters as AllowedFilters | null

  return {
    id: user.userId.toString(),
    name: user.fullName,
    username: user.username,
    email: user.email,
    permissions: permArray,
    bus: allBus.map(b => b.buCode),
    buIds: allBus.map(b => b.buId),
    allowedFilters: rawFilters ?? {},
    allowedModules,
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Active Directory',
      credentials: {
        username: { label: 'Usuario de Windows', type: 'text', placeholder: 'ej: DOMINIO\\usuario o usuario@tuvsud.com' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.username) return null

        const cleanUsername = normalizeUsername(credentials.username)
        if (!cleanUsername) return null

        // Datos de cliente (IP/UA) para auditar el inicio de sesión.
        const client = clientInfoFromNextAuthReq(req)
        const logLoginFailed = (reason: string) =>
          recordAuditEvent({
            eventType: 'LOGIN_FAILED',
            username: cleanUsername,
            outcome: 'FAILURE',
            metadata: { reason },
            ...client,
          })

        // Claves de rate-limiting por IP y por usuario (se cuentan solo los fallos).
        const ipKey = `login:ip:${client.ipAddress ?? 'unknown'}`
        const userKey = `login:user:${cleanUsername}`
        const noteFailure = () => { recordFailure(ipKey, LOGIN_RL); recordFailure(userKey, LOGIN_RL) }

        // ── Modo mock (solo dev sin conexión, opt-in explícito) ──
        // NO valida la contraseña. Por defecto (sin la variable) la autenticación
        // va SIEMPRE contra Active Directory por SOAP, en todos los entornos.
        const mockMode = process.env.AUTH_ALLOW_MOCK === 'true'

        if (!mockMode) {
          // Bloqueo previo: si la IP o el usuario están en cooldown, no se llega a AD.
          if (!checkRateLimit(ipKey).ok || !checkRateLimit(userKey).ok) {
            await logLoginFailed('RATE_LIMITED')
            throw new Error('RATE_LIMITED')
          }

          // ── Validación real de credenciales contra Active Directory (SOAP) ──
          if (!credentials.password) { noteFailure(); await logLoginFailed('BAD_CREDENTIALS'); throw new Error('BAD_CREDENTIALS') }

          let result: RetornoLogin
          try {
            result = await loginLdapAd(cleanUsername, credentials.password)
          } catch (err) {
            // Timeout / red / HTTP / soap:Fault → el directorio no es accesible.
            // No cuenta como fallo de credenciales (es un problema de infraestructura).
            console.error('Error consultando el web service de AD:', err)
            await logLoginFailed('AD_ERROR')
            throw new Error('AD_ERROR')
          }

          if (result !== 'OK') {
            console.warn(`Login AD rechazado para "${cleanUsername}": ${result}`)
            noteFailure()
            // Guardamos el motivo real de AD (USUARIO_NO_EXISTE / CONTRASENNA_INCORRECTA / …)
            // en la auditoría; al usuario se le devuelve un error genérico.
            await logLoginFailed(result)
            if (result === 'USUARIO_DESHABILITADO') throw new Error('AD_DISABLED')
            if (result === 'ERROR_NO_CONTROLADO') throw new Error('AD_ERROR')
            // USUARIO_NO_EXISTE y CONTRASENNA_INCORRECTA → genérico (no revelar cuál falló).
            throw new Error('BAD_CREDENTIALS')
          }

          // Credenciales válidas: limpia los contadores de fallos de esta IP/usuario.
          resetRateLimit(ipKey)
          resetRateLimit(userKey)
        }

        // Credenciales válidas (o modo mock): exige cuenta Focus activa.
        const scope = await loadUserScope(cleanUsername)
        if (!scope) {
          console.warn(`Usuario "${cleanUsername}" válido en AD pero sin cuenta Focus activa.`)
          await logLoginFailed(mockMode ? 'BAD_CREDENTIALS' : 'NO_FOCUS_ACCESS')
          throw new Error(mockMode ? 'BAD_CREDENTIALS' : 'NO_FOCUS_ACCESS')
        }

        await recordAuditEvent({
          eventType: 'LOGIN_SUCCESS',
          userId: Number(scope.id),
          username: scope.username,
          userFullName: scope.name,
          metadata: mockMode ? { mock: true } : undefined,
          ...client,
        })

        return {
          id: scope.id,
          name: scope.name,
          email: scope.username,
          permissions: scope.permissions,
          bus: scope.bus,
          buIds: scope.buIds,
          allowedFilters: scope.allowedFilters,
          allowedModules: scope.allowedModules,
        }
      }
    })
  ],
  cookies: {
    // ── Las 3 cookies de next-auth se configuran SIN maxAge ──
    // Esto las convierte en "session cookies": el navegador las elimina
    // automáticamente al cerrarse por completo (todas las ventanas/pestañas).
    sessionToken: {
      name: `${useSecureCookies ? '__Secure-' : ''}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: useSecureCookies,
      },
    },
    callbackUrl: {
      name: `${useSecureCookies ? '__Secure-' : ''}next-auth.callback-url`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: useSecureCookies,
      },
    },
    csrfToken: {
      name: `${useSecureCookies ? '__Host-' : ''}next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: useSecureCookies,
      },
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Login inicial: tomar el alcance del usuario recién autenticado.
        token.uid = user.id
        token.username = user.email ?? undefined
        token.permissions = user.permissions
        token.bus = user.bus
        token.buIds = user.buIds
        token.allowedFilters = user.allowedFilters
        token.allowedModules = user.allowedModules
        token.scopeRefreshedAt = Date.now()
      } else if (
        token.username &&
        Date.now() - ((token.scopeRefreshedAt as number | undefined) ?? 0) > SCOPE_TTL_MS
      ) {
        // Token "viejo": recargar alcance desde BD para propagar cambios de
        // /accesos y revocar accesos de usuarios desactivados.
        const scope = await loadUserScope(token.username as string)
        if (scope) {
          token.permissions = scope.permissions
          token.bus = scope.bus
          token.buIds = scope.buIds
          token.allowedFilters = scope.allowedFilters
          token.allowedModules = scope.allowedModules
          token.name = scope.name
          token.email = scope.email
        } else {
          // Usuario desactivado o eliminado → revocar alcance (deja de ver datos).
          token.permissions = []
          token.bus = []
          token.buIds = []
          token.allowedFilters = {}
          token.allowedModules = []
        }
        token.scopeRefreshedAt = Date.now()
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid ?? '';
        session.user.permissions = token.permissions ?? [];
        session.user.bus = token.bus ?? [];
        session.user.buIds = token.buIds ?? [];
        session.user.allowedFilters = token.allowedFilters ?? {};
        session.user.allowedModules = token.allowedModules ?? null;
      }
      return session;
    }
  },
  events: {
    // Cierre de sesión: NextAuth no pasa el request al evento, pero corre dentro del
    // route handler de /api/auth, así que intentamos capturar IP/UA vía headers()
    // (el helper traga el error si no hay contexto de request → IP/UA quedan null).
    async signOut({ token }) {
      await recordAuditEvent({
        eventType: 'LOGOUT',
        userId: token?.uid ? Number(token.uid) : null,
        username: (token?.username as string) ?? 'desconocido',
        ...(await clientInfoFromHeaders()),
      })
    },
  },
  pages: {
    signIn: '/login'
  },
  session: {
    strategy: 'jwt',
    // Caducidad estricta de 8 horas (jornada laboral). 
    // Aunque el navegador restaure pestañas accidentalmente cerradas, si pasaron
    // 8 horas la sesión morirá obligando a loguear de nuevo.
    maxAge: 8 * 60 * 60,
  }
}
