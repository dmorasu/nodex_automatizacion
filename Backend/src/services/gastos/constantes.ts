// =====================================
// CONSTANTES DEL MÓDULO DE GASTOS
// Los códigos son fijos (la lógica depende de ellos);
// los nombres visibles se pueden cambiar en la base de datos.
// =====================================

export const ROLES = {
  TESORERIA: 'TESORERIA',
  // Persona de Tesorería que paga solo las compras de certificados (CTL y Cámara de Comercio)
  TESORERIA_CERTIFICADOS: 'TESORERIA_CERTIFICADOS',
  LEGALIZACION: 'LEGALIZACION',
  CONTABILIDAD: 'CONTABILIDAD',
  ADMIN: 'ADMIN',
  // Aprueba en Nodex los pagos que Tesorería programa (luego los aprueba en la plataforma del banco)
  DIRECCION_NEGOCIO: 'DIRECCION_NEGOCIO',
  // Perfiles del módulo de trámites
  GESTION_ACTIVOS: 'GESTION_ACTIVOS',
  TORRE_CONTROL: 'TORRE_CONTROL',
  // Analista de Torre de control: en el inicio ve solo los trámites asignados a él
  ANALISTA_TRAMITES: 'ANALISTA_TRAMITES',
  // Administrador de Torre de control: además reasigna analistas
  ADMIN_TORRE_CONTROL: 'ADMIN_TORRE_CONTROL'
} as const

// Perfiles del módulo de trámites: los únicos que el Administrador de Torre de control puede asignar
export const ROLES_TRAMITES: string[] = [ROLES.GESTION_ACTIVOS, ROLES.TORRE_CONTROL, ROLES.ANALISTA_TRAMITES, ROLES.ADMIN_TORRE_CONTROL]

// Estos roles trabajan en Torre de control: tienen sus mismos permisos (se agregan en `autenticacion`)
export const ROLES_CON_TORRE_CONTROL: string[] = [ROLES.ANALISTA_TRAMITES, ROLES.ADMIN_TORRE_CONTROL]

export type CodigoRol = typeof ROLES[keyof typeof ROLES]

export const TIPOS_GASTO = {
  VEHICULO: 'VEHICULO',
  INMUEBLE: 'INMUEBLE',
  OTRO: 'OTRO',
  // Compras de certificados: las paga Tesorería - Certificados (no salen en "Por pagar" general)
  CTL: 'CTL',
  CAMARA_COMERCIO: 'CAMARA_COMERCIO'
} as const

export const TIPOS_GASTO_CERTIFICADOS: string[] = [TIPOS_GASTO.CTL, TIPOS_GASTO.CAMARA_COMERCIO]

export const ESTADOS_GASTO = {
  SOLICITADO: 'SOLICITADO',
  PROGRAMADO: 'PROGRAMADO',          // Tesorería lo programó para pago (en un lote)
  APROBADO_PAGO: 'APROBADO_PAGO',    // Dirección de Negocio lo aprobó; falta el soporte del banco
  PAGADO: 'PAGADO',
  FACTURADO: 'FACTURADO',            // Legalización registró la factura real
  EN_CUENTA_COBRO: 'EN_CUENTA_COBRO',
  LEGALIZADO: 'LEGALIZADO',
  CONTABILIZADO: 'CONTABILIZADO',
  ANULADO: 'ANULADO'
} as const

// Estados en los que el gasto todavía no se ha pagado (el valor pagado y la bolsa aún no cuentan)
export const ESTADOS_SIN_PAGO: string[] = [ESTADOS_GASTO.SOLICITADO, ESTADOS_GASTO.PROGRAMADO, ESTADOS_GASTO.APROBADO_PAGO, ESTADOS_GASTO.ANULADO]

// Lote de pago: Tesorería programa → Dirección de Negocio aprueba → Tesorería adjunta el soporte y confirma
export const ESTADOS_LOTE = {
  PROGRAMADO: 'PROGRAMADO',   // tiene gastos pendientes de aprobación
  APROBADO: 'APROBADO',       // todos sus gastos aprobados; falta confirmar el pago
  PAGADO: 'PAGADO',           // pago confirmado: bolsa descontada
  RECHAZADO: 'RECHAZADO'      // se quitaron o rechazaron todos sus gastos
} as const

export const ESTADOS_CUENTA_COBRO = {
  BORRADOR: 'BORRADOR',
  LEGALIZADA: 'LEGALIZADA',
  CONTABILIZADA: 'CONTABILIZADA',
  ANULADA: 'ANULADA'
} as const

export const ESTADOS_REINTEGRO = {
  PENDIENTE: 'PENDIENTE',
  REINTEGRADO: 'REINTEGRADO'
} as const

export const TIPOS_MOVIMIENTO_BOLSA = {
  RECARGA: 'RECARGA',           // + entra dinero a la bolsa
  PAGO: 'PAGO',                 // − Tesorería paga un gasto
  REINTEGRO: 'REINTEGRO',       // + el tramitador devuelve un sobrante (fase 5)
  LEGALIZACION: 'LEGALIZACION', // + se legaliza una cuenta de cobro (fase 5)
  REVERSO: 'REVERSO',           // ± se deshace un movimiento
  AJUSTE: 'AJUSTE',             // ± corrección manual del administrador
  ANTICIPO: 'ANTICIPO'          // + Contabilidad confirma el pago de un cliente (recibo de caja)
} as const

export type TipoMovimientoBolsa = typeof TIPOS_MOVIMIENTO_BOLSA[keyof typeof TIPOS_MOVIMIENTO_BOLSA]

export const TIPOS_DOCUMENTO = {
  SOPORTE_PAGO: 'SOPORTE_PAGO',
  // Comprobante de la consignación que hizo el cliente (anticipos)
  SOPORTE_CONSIGNACION: 'SOPORTE_CONSIGNACION',
  CUENTA_COBRO: 'CUENTA_COBRO',
  SOPORTE_REINTEGRO: 'SOPORTE_REINTEGRO'
} as const

export const PARAMETROS = {
  RETENCION_FUENTE: 'RETENCION_FUENTE',
  GMF: 'GMF'
} as const

export type ClaveParametro = typeof PARAMETROS[keyof typeof PARAMETROS]

// GENERAL: la recarga Tesorería y paga cualquier gasto.
// ANTICIPOS: se llena con los pagos de los clientes del banco (anticipos confirmados por
// Contabilidad) y además lleva el saldo de cada cliente; solo paga los gastos de esos anticipos.
export const TIPOS_BOLSA = {
  GENERAL: 'GENERAL',
  ANTICIPOS: 'ANTICIPOS'
} as const

export type TipoBolsa = typeof TIPOS_BOLSA[keyof typeof TIPOS_BOLSA]

// Anticipo (ingreso de un cliente del banco): la operación lo registra → Contabilidad
// confirma que el dinero entró (recibo de caja) o lo devuelve con novedad → se convierte en gastos
export const ESTADOS_ANTICIPO = {
  POR_CONFIRMAR: 'POR_CONFIRMAR',
  NOVEDAD: 'NOVEDAD',           // Contabilidad lo devolvió al creador para corregirlo
  CONFIRMADO: 'CONFIRMADO',     // el dinero entró: suma a la bolsa y al saldo del cliente
  ANULADO: 'ANULADO'
} as const

export type EstadoAnticipo = typeof ESTADOS_ANTICIPO[keyof typeof ESTADOS_ANTICIPO]

export const TIPOS_ANTICIPO = {
  VEHICULO: 'VEHICULO',
  INMUEBLE: 'INMUEBLE'
} as const
