import { z } from "zod"

export const RolSchema = z.object({
  id: z.number(),
  codigo: z.string(),
  nombre: z.string(),
  descripcion: z.string().nullable().optional()
})

export const UsuarioConRolesSchema = z.object({
  id: z.number(),
  nombreUsuario: z.string(),
  correoUsuario: z.string(),
  area: z.string().nullable(),
  roles: z.array(RolSchema.pick({ id: true, codigo: true, nombre: true }))
})

export type Rol = z.infer<typeof RolSchema>
export type UsuarioConRoles = z.infer<typeof UsuarioConRolesSchema>
