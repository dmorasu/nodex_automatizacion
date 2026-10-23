import "server-only"
import { cache } from "react"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { UserSchema } from "../schemas"
import { perfilDesdeRoles, permisosAnalistas, puedeConfigurarNotificaciones, type PerfilTramites } from "./perfiles"

// Sesión del usuario con su perfil de trámites. `cache` evita repetir las
// consultas cuando el layout y la página la piden en la misma petición.
export const verificacionSesion = cache(async () => {
  const token = cookies().get('TOKEN')?.value

  if (!token) {
    redirect('/auth/login')
  }

  const encabezados = { Authorization: `Bearer ${token}` }

  const [req, reqRoles] = await Promise.all([
    fetch(`${process.env.API_URL}/auth/user`, { headers: encabezados, cache: "no-store" }),
    // Los roles viven en el mismo sistema de Nodex Gastos
    fetch(`${process.env.API_URL}/gastos/me`, { headers: encabezados, cache: "no-store" })
  ])

  const session = await req.json()
  const resultado = UserSchema.safeParse(session)

  if (!resultado.success) {
    redirect('/auth/login')
  }

  const asignados: string[] = reqRoles.ok ? ((await reqRoles.json()).roles ?? []) : []
  // El Administrador de Trámites es el ADMIN de esta app (el de Gastos no cuenta aquí)
  const roles = asignados.includes("ADMIN_TRAMITES") ? [...asignados, "ADMIN"] : asignados
  const perfil = perfilDesdeRoles(roles)

  // Sin perfil asignado no hay acceso a trámites
  if (!perfil) {
    redirect('/sin-acceso')
  }

  return {
    usuario: resultado.data,
    perfil,
    // Administrador de Trámites además ve Administración (usuarios, perfiles y contraseñas)
    esAdmin: roles.includes("ADMIN"),
    // Administración de usuarios: Admin todo; Administrador de Torre de control solo perfiles de trámites
    puedeAdministrarUsuarios: roles.includes("ADMIN") || roles.includes("ADMIN_TORRE_CONTROL"),
    ...permisosAnalistas(roles),
    puedeConfigurarNotificaciones: puedeConfigurarNotificaciones(roles),
    token,
    isAuth: true
  }
})

// Para páginas exclusivas del administrador
export const requiereAdmin = async () => {
  const sesion = await verificacionSesion()
  if (!sesion.esAdmin) redirect('/center/dashboard')
  return sesion
}

// Para Administración de usuarios (Admin o Administrador de Torre de control)
export const requiereAdministrarUsuarios = async () => {
  const sesion = await verificacionSesion()
  if (!sesion.puedeAdministrarUsuarios) redirect('/center/dashboard')
  return sesion
}

// Para páginas de asignación de analistas (Administrador de Torre de control o Admin)
export const requiereAsignarAnalistas = async () => {
  const sesion = await verificacionSesion()
  if (!sesion.puedeAsignarAnalistas) redirect('/center/dashboard')
  return sesion
}

// Para la configuración de notificaciones automáticas (Admin y Torre de control)
export const requiereConfigurarNotificaciones = async () => {
  const sesion = await verificacionSesion()
  if (!sesion.puedeConfigurarNotificaciones) redirect('/center/dashboard')
  return sesion
}

// Para páginas exclusivas de un perfil (ej: cargues masivos solo Torre de control)
export const requierePerfil = async (perfiles: PerfilTramites[]) => {
  const sesion = await verificacionSesion()

  // Admin entra a todas las secciones
  if (!perfiles.includes(sesion.perfil) && !sesion.esAdmin) {
    redirect('/center/dashboard')
  }

  return sesion
}
