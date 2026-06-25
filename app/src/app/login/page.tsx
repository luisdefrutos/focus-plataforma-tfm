'use client'

/**
 * Pantalla de login — RUTA INDEPENDIENTE, fuera del grupo (dashboard).
 *
 * Al vivir en app/login (no en (dashboard)/login) usa solo el layout raíz
 * (html/body/Providers): NO hereda el sidebar, la topbar ni el AutoLogout del
 * dashboard. Es una pantalla a pantalla completa, sin el chrome de la aplicación.
 *
 * El login valida usuario + contraseña contra Active Directory vía el web service
 * SOAP corporativo (ver app/src/lib/auth.ts y app/src/lib/ad-soap.ts).
 */

import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { TsInput } from '@tuvsud/design-system/react/input'
import { TsButton } from '@tuvsud/design-system/react/button'
import { TsIcon } from '@tuvsud/design-system/react/icon'

/** Códigos lanzados por authorize() (auth.ts) → mensaje para el usuario. */
const ERROR_MESSAGES: Record<string, string> = {
  BAD_CREDENTIALS: 'Usuario o contraseña incorrectos.',
  AD_DISABLED: 'Tu cuenta de Active Directory está deshabilitada. Contacta con IT.',
  AD_ERROR: 'No se pudo contactar con el directorio. Inténtalo de nuevo en unos minutos.',
  NO_FOCUS_ACCESS:
    'Tus credenciales son correctas, pero tu usuario no tiene acceso a Focus. Contacta con un administrador.',
  RATE_LIMITED: 'Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo.',
  CredentialsSignin: 'Usuario o contraseña incorrectos.',
}

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await signIn('credentials', {
      username,
      password,
      redirect: false,
    })

    if (res?.error) {
      setError(ERROR_MESSAGES[res.error] ?? 'No se pudo iniciar sesión. Inténtalo de nuevo.')
      setLoading(false)
    } else {
      // Marcar esta pestaña como "sesión activa" para el guard de AutoLogout.
      // sessionStorage es por pestaña: se destruye al cerrarla.
      sessionStorage.setItem('focus-tab-active', 'true')
      setLoading(false)
      router.push('/')
      router.refresh()
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-md rounded-2xl p-8 shadow-2xl bg-white border border-border">
        {/* Marca */}
        <div className="mb-8 flex flex-col items-center text-center">
          <img src="/focus-logo.svg" alt="Focus" className="mb-5 h-24 w-24" />
          <h1 className="text-3xl font-bold tracking-wide" style={{ color: '#1F6AA5' }}>
            FOCUS
          </h1>
          <p className="mt-2 text-sm font-medium" style={{ color: '#1F6AA5' }}>
            Fully Oriented to Customer Unity & Service
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label
              className="mb-2 block text-sm font-medium"
              style={{ color: 'var(--ts-semantic-color-text-primary-default)' }}
            >
              Usuario de Windows
            </label>
            <TsInput
              type="text"
              value={username}
              onInput={(e: React.FormEvent<HTMLInputElement>) => setUsername(e.currentTarget.value)}
              placeholder="Ej: defru-li o WW001\defru-li"
              className="w-full"
              required
            >
              <TsIcon name="person" slot="prefix" />
            </TsInput>
          </div>

          <div>
            <label
              className="mb-2 block text-sm font-medium"
              style={{ color: 'var(--ts-semantic-color-text-primary-default)' }}
            >
              Contraseña
            </label>
            <TsInput
              type="password"
              value={password}
              onInput={(e: React.FormEvent<HTMLInputElement>) => setPassword(e.currentTarget.value)}
              placeholder="Tu contraseña de Windows"
              className="w-full"
              required
            >
              <TsIcon name="lock" slot="prefix" />
            </TsInput>
          </div>

          <TsButton type="submit" variant="primary" className="w-full" disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
            <TsIcon name="login" slot="suffix" />
          </TsButton>
        </form>
      </div>
    </main>
  )
}
