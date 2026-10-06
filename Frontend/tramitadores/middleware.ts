import { NextResponse, type NextRequest } from "next/server"

// Detrás de Nginx, request.url trae la dirección interna (localhost:9003) y la redirección
// mandaba al celular a "localhost". Se arma con la dirección pública que envía Nginx
// (Host y X-Forwarded-Proto); en desarrollo, sin Nginx, queda la de siempre.
const direccionPublica = (request: NextRequest) => {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  const protocolo = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "")
  return host ? `${protocolo}://${host}` : request.url
}

// Sin cookie de sesión, todo (menos el login y los íconos) lleva al login.
// La validez del token la revisa el backend en cada página.
export function middleware(request: NextRequest) {
  if (!request.cookies.has("TOKEN_TRAMITADOR")) {
    return NextResponse.redirect(new URL("/auth/login", direccionPublica(request)))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!auth|_next|iconos|manifest.webmanifest|favicon.ico|.*\\.png$).*)"]
}
