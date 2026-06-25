import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token // Requiere estar logueado para acceder a cualquier ruta protegida
    },
  }
)

export const config = {
  // Proteger todo excepto login, api auth estáticos, etc
  matcher: [
    '/((?!login|api/auth|_next/static|_next/image|favicon.ico|focus-logo.svg).*)',
  ],
}
