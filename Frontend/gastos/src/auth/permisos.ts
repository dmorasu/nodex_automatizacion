// =====================================
// ROLES Y MÓDULOS
// Los códigos deben coincidir con los del backend (services/gastos/constantes.ts).
// Esto solo decide qué se MUESTRA: la seguridad real la aplica el backend.
// =====================================

export const ROLES = {
  TESORERIA: "TESORERIA",
  // Paga solo las compras de certificados (CTL, Cámara de Comercio y RUNT)
  TESORERIA_CERTIFICADOS: "TESORERIA_CERTIFICADOS",
  LEGALIZACION: "LEGALIZACION",
  CONTABILIDAD: "CONTABILIDAD",
  // Aprueba los pagos que programa Tesorería
  DIRECCION_NEGOCIO: "DIRECCION_NEGOCIO",
  // Hace el trabajo de Tesorería solo en la caja menor que tiene asignada
  AUXILIAR_TESORERIA_CAJA: "AUXILIAR_TESORERIA_CAJA",
  ADMIN: "ADMIN"
} as const

export type CodigoRol = typeof ROLES[keyof typeof ROLES]

export const NOMBRES_ROL: Record<string, string> = {
  TESORERIA: "Tesorería",
  TESORERIA_CERTIFICADOS: "Tesorería - Certificados",
  LEGALIZACION: "Legalización",
  CONTABILIDAD: "Contabilidad",
  DIRECCION_NEGOCIO: "Dirección de Negocio",
  AUXILIAR_TESORERIA_CAJA: "Auxiliar de Tesorería - Caja menor",
  ADMIN: "Administrador",
  GESTION_ACTIVOS: "Gestión de activos (trámites)",
  TORRE_CONTROL: "Torre de control (trámites)",
  ANALISTA_TRAMITES: "Analista de trámites",
  ADMIN_TORRE_CONTROL: "Administrador Torre de control"
}

// Roles del módulo de gastos: con alguno se ven todos los gastos
export const tieneRolDeGastos = (roles: string[]) =>
  roles.some(rol => ["TESORERIA", "TESORERIA_CERTIFICADOS", "LEGALIZACION", "CONTABILIDAD", "DIRECCION_NEGOCIO", "ADMIN"].includes(rol))

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
    href: "/anticipos",
    nombre: "Anticipos",
    descripcion: "Registra pagos de clientes",
    roles: []
  },
  {
    href: "/tesoreria",
    nombre: "Tesorería",
    descripcion: "Paga gastos y administra las bolsas",
    roles: [ROLES.TESORERIA, ROLES.TESORERIA_CERTIFICADOS, ROLES.AUXILIAR_TESORERIA_CAJA]
  },
  {
    href: "/direccion",
    nombre: "Aprobación de pagos",
    descripcion: "Aprueba o rechaza los pagos programados",
    roles: [ROLES.DIRECCION_NEGOCIO]
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
    nombre: "Indicadores",
    descripcion: "Saldos por bolsa, pagos, reintegros y lo pendiente por legalizar",
    roles: [ROLES.TESORERIA, ROLES.LEGALIZACION, ROLES.CONTABILIDAD]
  },
  {
    href: "/reportes",
    nombre: "Reportes",
    descripcion: "Descarga en Excel la data",
    roles: [ROLES.TESORERIA, ROLES.LEGALIZACION, ROLES.CONTABILIDAD]
  },
  {
    href: "/admin",
    nombre: "Tablero de Control",
    descripcion: "Administración del dato",
    roles: [ROLES.ADMIN]
  },
  {
    href: "/usuarios",
    nombre: "Usuarios",
    descripcion: "Usuarios y roles del módulo de gastos",
    roles: [ROLES.ADMIN]
  },
  {
    href: "/catalogos",
    nombre: "Catálogos",
    descripcion: "Clientes empresariales, tipos y formas de pago",
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
