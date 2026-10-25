import "server-only"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import type { z } from "zod"
import { NOMBRE_COOKIE } from "../auth/sesion"

// Llamada al backend de la app (/api/app-tramitadores) con el token de la sesión.
// Ej: fetchApi("/tramites?filtro=activos")
export const fetchApi = async (ruta: string, opciones: RequestInit = {}) => {
  const token = (await cookies()).get(NOMBRE_COOKIE)?.value
  const esFormulario = opciones.body instanceof FormData

  return fetch(`${process.env.API_URL}/app-tramitadores${ruta}`, {
    ...opciones,
    headers: {
      ...(!esFormulario && { "Content-Type": "application/json" }),
      ...opciones.headers,
      Authorization: `Bearer ${token}`
    },
    cache: "no-store"
  })
}

// GET validado con su esquema. Sesión vencida → login; contraseña temporal → cambiarla;
// no encontrado → null (la página muestra 404)
export const obtenerDatos = async <T extends z.ZodType>(ruta: string, esquema: T): Promise<z.infer<T> | null> => {
  const req = await fetchApi(ruta)

  if (req.status === 401) redirect("/auth/login?sesion=cerrada")
  if (req.status === 403) redirect("/cambiar-contrasena")
  if (req.status === 404) return null
  if (!req.ok) throw new Error(`No se pudo consultar ${ruta} (${req.status})`)

  return esquema.parse(await req.json())
}

// Errores del backend como lista de mensajes:
// { error: "..." } (reglas de negocio) o { errors: [{ msg }] } (validaciones)
export const leerErrores = async (respuesta: Response): Promise<string[]> => {
  const json = await respuesta.json().catch(() => null)

  if (json?.error) return [json.error]
  if (Array.isArray(json?.errors)) return json.errors.map((e: { msg: string }) => e.msg)

  return ["Hubo un error, intente de nuevo"]
}
