import "server-only"
import { cache } from "react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { SesionSchema } from "../schemas"
import { CodigoRol, tieneAcceso } from "./permisos"

export const NOMBRE_COOKIE = "TOKEN"

// Usuario en sesión con sus roles. `cache` evita repetir la consulta
// cuando el layout y la página la piden en la misma petición.
export const obtenerSesion = cache(async () => {
  const token = cookies().get(NOMBRE_COOKIE)?.value

  if (!token) {
    redirect("/auth/login")
  }

  const req = await fetch(`${process.env.API_URL}/gastos/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store"
  })

  if (!req.ok) {
    redirect("/auth/login")
  }

  const resultado = SesionSchema.safeParse(await req.json())

  if (!resultado.success) {
    redirect("/auth/login")
  }

  // El Administrador de Gastos es el ADMIN de esta app (el de Trámites no cuenta aquí)
  const roles = resultado.data.roles
  return { ...resultado.data, roles: roles.includes("ADMIN_GASTOS") ? [...roles, "ADMIN"] : roles }
})

// Para usar al inicio de cada página protegida por rol
export const requiereAcceso = async (rolesModulo: CodigoRol[]) => {
  const sesion = await obtenerSesion()

  if (!tieneAcceso(sesion.roles, rolesModulo)) {
    redirect("/sin-acceso")
  }

  return sesion
}
