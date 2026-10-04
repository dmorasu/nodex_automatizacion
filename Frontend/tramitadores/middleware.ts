import { NextResponse, type NextRequest } from "next/server"

// Sin cookie de sesión, todo (menos el login y los íconos) lleva al login.
// La validez del token la revisa el backend en cada página.
export function middleware(request: NextRequest) {
  if (!request.cookies.has("TOKEN_TRAMITADOR")) {
    return NextResponse.redirect(new URL("/auth/login", request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!auth|_next|iconos|manifest.webmanifest|favicon.ico|.*\\.png$).*)"]
}
