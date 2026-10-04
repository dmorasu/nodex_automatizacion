import { z } from "zod"

export const InicioSesionSchema = z.object({
  correoUsuario: z.string()
    .min(1, { message: "El correo es obligatorio" })
    .email({ message: "Correo no válido" }),
  contrasena: z.string()
    .min(1, { message: "La contraseña no puede ir vacía" })
})

export const ErrorRespuestaSchema = z.object({
  error: z.string()
})

// Respuesta de GET /api/gastos/me
export const SesionSchema = z.object({
  id: z.number(),
  nombreUsuario: z.string(),
  correoUsuario: z.string(),
  roles: z.array(z.string())
})

export type Sesion = z.infer<typeof SesionSchema>
