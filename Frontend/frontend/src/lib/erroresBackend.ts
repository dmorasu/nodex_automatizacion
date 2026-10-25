import { ErrorResponoseSchema } from "@/src/schemas"

// El backend responde { error } (reglas de negocio) o { errors: [{ msg }] } (validaciones).
// Antes solo se leía { error } y lo demás terminaba en un error de zod en inglés.
export const mensajesDeError = (json: unknown, porDefecto: string): string[] => {
  const error = ErrorResponoseSchema.safeParse(json)
  if (error.success) return [error.data.error]

  const errores = (json as { errors?: { msg: string }[] } | null)?.errors
  const mensajes = Array.isArray(errores) ? errores.map(e => e.msg).filter(Boolean) : []
  return mensajes.length ? mensajes : [porDefecto]
}
