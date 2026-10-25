import "server-only"
import { cache } from "react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { SesionSchema } from "../schemas"

// Cookie propia (no se cruza con la de Nodex Trámites o Gastos en el mismo dominio)
export const NOMBRE_COOKIE = "TOKEN_TRAMITADOR"
export const DURACION_COOKIE = 60 * 60 * 24 * 15 // 15 días, igual que el token

// Tramitador en sesión. `cache` evita repetir la consulta en la misma petición.
// Si el token venció, se restableció la contraseña o lo desactivaron, vuelve al login.
export const obtenerSesion = cache(async () => {
  const token = (await cookies()).get(NOMBRE_COOKIE)?.value
  if (!token) redirect("/auth/login")

  const req = await fetch(`${process.env.API_URL}/app-tramitadores/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store"
  })
  if (!req.ok) redirect("/auth/login?sesion=cerrada")

  const resultado = SesionSchema.safeParse(await req.json())
  if (!resultado.success) redirect("/auth/login?sesion=cerrada")

  return resultado.data
})

// Para las páginas de la app: con contraseña temporal solo se puede cambiar la contraseña
export const requiereSesion = async () => {
  const sesion = await obtenerSesion()
  if (sesion.debeCambiarContrasena) redirect("/cambiar-contrasena")
  return sesion
}
