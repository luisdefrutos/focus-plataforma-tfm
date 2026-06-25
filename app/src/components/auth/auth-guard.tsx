'use client'

import { useSession } from 'next-auth/react'
import { ReactNode } from 'react'

interface AuthGuardProps {
  children: ReactNode
  requiredPermission?: string
  fallback?: ReactNode
}

export function AuthGuard({ children, requiredPermission, fallback = null }: AuthGuardProps) {
  const { data: session, status } = useSession()

  if (status === 'loading') {
    return null
  }

  // Si no requiere permiso específico, solo estar logueado
  if (!requiredPermission && session?.user) {
    return <>{children}</>
  }

  // Si requiere permiso, verificar
  if (requiredPermission && session?.user?.permissions?.includes(requiredPermission)) {
    return <>{children}</>
  }

  return <>{fallback}</>
}
