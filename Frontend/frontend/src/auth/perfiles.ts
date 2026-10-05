// Perfiles del módulo de trámites. Se asignan como roles en la
// Administración de Nodex Gastos (mismos usuarios y mismo sistema de roles).
//   · TORRE_CONTROL:   acceso completo (como siempre)
//   · GESTION_ACTIVOS: crea y edita solo sus trámites y les crea gastos
// El rol ADMIN tiene acceso de Torre de control.

export type PerfilTramites = "TORRE_CONTROL" | "GESTION_ACTIVOS"

export const NOMBRES_PERFIL: Record<PerfilTramites, string> = {
  TORRE_CONTROL: "Torre de control",
  GESTION_ACTIVOS: "Gestión de activos"
}

// Analista de trámites y Administrador de Torre de control trabajan como Torre de control
// (el backend ya devuelve TORRE_CONTROL en sus roles). Además:
//   · Analista: el inicio muestra solo sus trámites (al buscar encuentra cualquiera)
//   · Administrador de Torre de control (y Admin): reasigna analistas
export type PermisosAnalistas = { esAnalista: boolean, puedeAsignarAnalistas: boolean }

export const permisosAnalistas = (roles: string[]): PermisosAnalistas => {
  const puedeAsignarAnalistas = roles.includes("ADMIN_TORRE_CONTROL") || roles.includes("ADMIN")
  return {
    esAnalista: roles.includes("ANALISTA_TRAMITES") && !puedeAsignarAnalistas,
    puedeAsignarAnalistas
  }
}

// Notificaciones automáticas de WhatsApp (hora, días, activar y enviar ahora): Admin y
// Torre de control. El analista no, aunque trabaje con los permisos de Torre de control.
export const puedeConfigurarNotificaciones = (roles: string[]) =>
  permisosAnalistas(roles).puedeAsignarAnalistas ||
  (roles.includes("TORRE_CONTROL") && !roles.includes("ANALISTA_TRAMITES"))

// Si el usuario tiene los dos perfiles, prevalece Torre de control (el más amplio)
export const perfilDesdeRoles = (roles: string[]): PerfilTramites | null => {
  if (["TORRE_CONTROL", "ADMIN", "ANALISTA_TRAMITES", "ADMIN_TORRE_CONTROL"].some(rol => roles.includes(rol))) return "TORRE_CONTROL"
  if (roles.includes("GESTION_ACTIVOS")) return "GESTION_ACTIVOS"
  return null
}
