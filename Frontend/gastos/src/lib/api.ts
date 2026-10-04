import "server-only"
import { cookies } from "next/headers"
import { NOMBRE_COOKIE } from "../auth/dal"

// Llamada al backend desde el servidor (server components y server actions)
// con el token de la sesión. Ej: fetchApi("/gastos/catalogos")
export const fetchApi = (ruta: string, opciones: RequestInit = {}) => {
  const token = cookies().get(NOMBRE_COOKIE)?.value

  // Con FormData (archivos) el navegador/fetch arma el Content-Type con su boundary
  const esFormulario = opciones.body instanceof FormData

  return fetch(`${process.env.API_URL}${ruta}`, {
    ...opciones,
    headers: {
      ...(!esFormulario && { "Content-Type": "application/json" }),
      ...opciones.headers,
      Authorization: `Bearer ${token}`
    },
    cache: "no-store"
  })
}

// Convierte cualquier respuesta de error del backend en una lista de mensajes:
// { error: "..." } (reglas de negocio) o { errors: [{ msg }] } (validaciones)
export const leerErrores = async (respuesta: Response): Promise<string[]> => {
  const json = await respuesta.json().catch(() => null)

  if (json?.error) return [json.error]
  if (Array.isArray(json?.errors)) return json.errors.map((e: { msg: string }) => e.msg)

  return ["Hubo un error, intenta de nuevo"]
}
