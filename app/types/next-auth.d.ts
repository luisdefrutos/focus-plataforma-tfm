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
    } & DefaultSession['user']
  }

  /** Objeto devuelto por `authorize()` y recibido en el callback `jwt` al login. */
  interface User {
    permissions: string[]
    bus: string[]
    buIds: number[]
    allowedFilters?: AllowedFilters | null
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
    /** Epoch ms del último refresco de alcance desde BD (ver callback jwt). */
    scopeRefreshedAt?: number
  }
}
