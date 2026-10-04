// =====================================
// ROLES Y MÓDULOS
// Los códigos deben coincidir con los del backend (services/gastos/constantes.ts).
// Esto solo decide qué se MUESTRA: la seguridad real la aplica el backend.
// =====================================

export const ROLES = {
  TESORERIA: "TESORERIA",
  // Paga solo las compras de certificados (CTL y Cámara de Comercio)
  TESORERIA_CERTIFICADOS: "TESORERIA_CERTIFICADOS",
  LEGALIZACION: "LEGALIZACION",
  CONTABILIDAD: "CONTABILIDAD",
  ADMIN: "ADMIN"
} as const

export type CodigoRol = typeof ROLES[keyof typeof ROLES]

export const NOMBRES_ROL: Record<string, string> = {
  TESORERIA: "Tesorería",
  TESORERIA_CERTIFICADOS: "Tesorería - Certificados",
  LEGALIZACION: "Legalización",
  CONTABILIDAD: "Contabilidad",
  ADMIN: "Administrador",
  GESTION_ACTIVOS: "Gestión de activos (trámites)",
  TORRE_CONTROL: "Torre de control (trámites)",
  ANALISTA_TRAMITES: "Analista de trámites",
  ADMIN_TORRE_CONTROL: "Administrador Torre de control"
}

// Roles del módulo de gastos: con alguno se ven todos los gastos
export const tieneRolDeGastos = (roles: string[]) =>
  roles.some(rol => ["TESORERIA", "TESORERIA_CERTIFICADOS", "LEGALIZACION", "CONTABILIDAD", "ADMIN"].includes(rol))

// Tesorería - Certificados sin otro rol de gastos: solo ve y paga las compras de certificados
export const soloCertificados = (roles: string[]) =>
  roles.includes(ROLES.TESORERIA_CERTIFICADOS) &&
  !roles.some(rol => ["TESORERIA", "LEGALIZACION", "CONTABILIDAD", "ADMIN"].includes(rol))

export type Modulo = {
  href: string
  nombre: string
  descripcion: string
  // Roles que pueden entrar. Vacío = cualquier usuario con sesión
  roles: CodigoRol[]
}

export const MODULOS: Modulo[] = [
  {
    href: "/solicitudes",
    nombre: "Mis gastos",
    descripcion: "Crea y consulta tus solicitudes de gasto",
    roles: []
  },
  {
    href: "/tesoreria",
    nombre: "Tesorería",
    descripcion: "Paga gastos y administra las bolsas",
    roles: [ROLES.TESORERIA, ROLES.TESORERIA_CERTIFICADOS]
  },
  {
    href: "/legalizacion",
    nombre: "Legalización",
    descripcion: "Cuentas de cobro y reintegros",
    roles: [ROLES.LEGALIZACION]
  },
  {
    href: "/contabilidad",
    nombre: "Contabilidad",
    descripcion: "Contabiliza las cuentas de cobro legalizadas",
    roles: [ROLES.CONTABILIDAD]
  },
  {
    href: "/tablero",
    nombre: "Tablero",
    descripcion: "Saldos por bolsa, pagos, reintegros y lo pendiente por legalizar",
    roles: [ROLES.TESORERIA, ROLES.LEGALIZACION, ROLES.CONTABILIDAD]
  },
  {
    href: "/reportes",
    nombre: "Reportes",
    descripcion: "Descarga en Excel los gastos con todo su recorrido",
    roles: [ROLES.TESORERIA, ROLES.LEGALIZACION, ROLES.CONTABILIDAD]
  },
  {
    href: "/admin",
    nombre: "Administración",
    descripcion: "Todos los gastos con filtros, totales y paginación",
    roles: [ROLES.ADMIN]
  },
  {
    href: "/usuarios",
    nombre: "Usuarios",
    descripcion: "Usuarios y roles del módulo de gastos",
    roles: [ROLES.ADMIN]
  }
]

// ADMIN entra a todo
export const tieneAcceso = (rolesUsuario: string[], rolesModulo: CodigoRol[]) =>
  rolesModulo.length === 0 ||
  rolesUsuario.includes(ROLES.ADMIN) ||
  rolesModulo.some(rol => rolesUsuario.includes(rol))

export const modulosPermitidos = (rolesUsuario: string[]) =>
  MODULOS.filter(modulo => tieneAcceso(rolesUsuario, modulo.roles))
