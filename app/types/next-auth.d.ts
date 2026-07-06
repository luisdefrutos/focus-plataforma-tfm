import { DefaultSession } from 'next-auth'
import type { AllowedFilters } from '@/lib/access'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      permissions: string[]
      bus: string[]
      buIds: number[]
      /** Listas blancas granulares por dimensión (RLS). */
      allowedFilters?: AllowedFilters | null
      /**
       * Módulos (pantallas) que el usuario puede ver.
       * undefined = sin restricción (acceso total, superusuario).
       * string[] = solo los módulos listados.
       */
      allowedModules?: string[] | null
    } & DefaultSession['user']
  }

  /** Objeto devuelto por `authorize()` y recibido en el callback `jwt` al login. */
  interface User {
    permissions: string[]
    bus: string[]
    buIds: number[]
    allowedFilters?: AllowedFilters | null
    allowedModules?: string[] | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    uid?: string
    username?: string
    permissions?: string[]
    bus?: string[]
    buIds?: number[]
    allowedFilters?: AllowedFilters | null
    allowedModules?: string[] | null
    /** Epoch ms del último refresco de alcance desde BD (ver callback jwt). */
    scopeRefreshedAt?: number
  }
}
