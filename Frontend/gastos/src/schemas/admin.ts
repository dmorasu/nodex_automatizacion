import { z } from "zod"

export const RolSchema = z.object({
  id: z.number(),
  codigo: z.string(),
  nombre: z.string(),
  descripcion: z.string().nullable().optional(),
  // GASTOS | TRAMITES: cada app asigna solo los suyos
  modulo: z.string().nullable().optional()
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

// Registro de un catálogo de Gastos en la pantalla de Catálogos (solo Admin)
export const RegistroCatalogoSchema = z.object({
  id: z.number(),
  codigo: z.string().optional(),
  nombre: z.string(),
  activo: z.boolean(),
  // Cuántos registros lo usan: lo que está en uso no se elimina (se desactiva)
  uso: z.number(),
  // Lo usa la lógica del sistema: no se elimina (ni se desactiva, salvo los tipos de gasto)
  delSistema: z.boolean(),
  // Tipos de documento: para qué servicio se sube
  paraPago: z.boolean().optional(),
  paraLegalizacion: z.boolean().optional(),
  paraReintegro: z.boolean().optional()
})

export const CatalogoAdminSchema = z.object({
  permiteCrear: z.boolean(),
  registros: z.array(RegistroCatalogoSchema)
})

export type RegistroCatalogo = z.infer<typeof RegistroCatalogoSchema>
