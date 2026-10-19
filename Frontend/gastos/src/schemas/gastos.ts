import { z } from "zod"

// Los DECIMAL de PostgreSQL llegan como texto ("150000.00")
const dinero = z.string().nullable()
const textoNulo = z.string().nullable()

// ── Catálogos ──────────────────────────────

export const ItemCatalogoSchema = z.object({
  id: z.number(),
  codigo: z.string(),
  nombre: z.string()
})

// Tipo de documento con el servicio para el que se sube (pago, legalización, reintegro)
export const TipoDocumentoSchema = ItemCatalogoSchema.extend({
  paraPago: z.boolean().optional(),
  paraLegalizacion: z.boolean().optional(),
  paraReintegro: z.boolean().optional()
})

export const CatalogosSchema = z.object({
  tiposGasto: z.array(ItemCatalogoSchema),
  formasPago: z.array(ItemCatalogoSchema),
  estadosGasto: z.array(ItemCatalogoSchema),
  tiposDocumento: z.array(TipoDocumentoSchema)
})

export const ParametrosSchema = z.array(z.object({
  clave: z.string(),
  valor: z.string()
}))

export const OperacionSchema = z.object({
  id: z.number(),
  nombreOperacion: z.string(),
  centroDeCostos: textoNulo
})

export const BolsaApoyoSchema = z.object({
  id: z.number(),
  nombre: z.string(),
  lineaNegocio: textoNulo,
  // GENERAL | ANTICIPOS | FACTURAS (las de anticipos y anticipos facturados llevan saldo por cliente)
  tipo: z.string().default("GENERAL")
})

// Vista de Tesorería (incluye saldo)
export const BolsaSchema = BolsaApoyoSchema.extend({
  saldoActual: z.string(),
  activo: z.boolean()
})

export const TramitadorSchema = z.object({
  id: z.number(),
  nombreTramitador: z.string(),
  identificacion: textoNulo
})

export const TerceroSchema = z.object({
  id: z.number(),
  tipoIdentificacion: z.string(),
  identificacion: z.string(),
  nombre: z.string(),
  banco: textoNulo,
  tipoCuenta: textoNulo,
  numeroCuenta: textoNulo,
  correo: textoNulo,
  // Clientes del banco que pagan anticipos
  telefono: textoNulo.optional(),
  direccion: textoNulo.optional()
})

export const TramiteApoyoSchema = z.object({
  id: z.number(),
  operacionesId: z.number().nullable(),
  tramitadorId: z.number().nullable(),
  placa: textoNulo,
  matriculaInmobiliaria: textoNulo,
  clientes: z.object({ nombreCliente: z.string(), identificacionCliente: textoNulo }).nullable(),
  tramite: z.object({ nombreTramite: z.string() }).nullable(),
  operaciones: z.object({ nombreOperacion: z.string() }).nullable(),
  tramitador: z.object({ nombreTramitador: z.string() }).nullable()
})

// ── Gastos ─────────────────────────────────

const UsuarioCortoSchema = z.object({ id: z.number(), nombreUsuario: z.string() }).nullable()

export const GastoListadoSchema = z.object({
  id: z.number(),
  codigo: z.string(),
  conceptoPago: z.string(),
  placa: textoNulo,
  matriculaInmobiliaria: textoNulo,
  numeroFactura: textoNulo,
  reembolsable: z.boolean(),
  valorSolicitadoPago: z.string(),
  valorRealmentePagado: dinero,
  fechaPago: textoNulo,
  createdAt: z.string(),
  estado: ItemCatalogoSchema,
  tipoGasto: ItemCatalogoSchema,
  beneficiario: z.object({ id: z.number(), identificacion: z.string(), nombre: z.string() }),
  operacion: z.object({ id: z.number(), nombreOperacion: z.string() }),
  bolsa: z.object({ id: z.number(), nombre: z.string() }).nullable(),
  creador: UsuarioCortoSchema,
  factura: z.object({
    id: z.number(),
    numeroFactura: textoNulo,
    valorFactura: z.string(),
    cuatroXMil: z.string(),
    valorLegalizado: z.string()
  }).nullable(),
  tramitador: z.object({ id: z.number(), nombreTramitador: z.string() }).nullish(),
  legalizacionCaja: z.lazy(() => LegalizacionCajaCortaSchema).nullish(),
  // Seguimiento desde la app de tramitadores
  solicitudTramiteId: z.number().nullish(),
  soporteTramitador: z.enum(["PENDIENTE", "APROBADO", "RECHAZADO"]).nullish(),
  estadoTramite: z.string().nullish(),
  reporteRealizado: z.enum(["PENDIENTE", "REVISADO"]).nullish(),
  // Gasto de un anticipo: saldo del cliente y lo que tiene por pagar (para avisar si no alcanza)
  anticipoId: z.number().nullish(),
  anticipo: z.object({ id: z.number(), codigo: z.string() }).nullish(),
  saldoClienteAnticipo: z.coerce.string().nullish(),
  comprometidoClienteAnticipo: z.coerce.string().nullish()
})

export const ListadoGastosSchema = z.object({
  total: z.number(),
  pagina: z.number(),
  tamano: z.number(),
  registros: z.array(GastoListadoSchema),
  // Solo si se pide ?totales=si (panel de administración)
  totales: z.object({ solicitado: z.number(), pagado: z.number() }).optional()
})

export const DocumentoSchema = z.object({
  id: z.number(),
  nombreOriginal: z.string(),
  tipoArchivo: z.string(),
  tamano: z.number(),
  subidoPor: z.number(),
  createdAt: z.string(),
  tipoDocumento: z.object({ id: z.number(), codigo: z.string().optional(), nombre: z.string() }),
  usuario: UsuarioCortoSchema
})

export const TrazabilidadSchema = z.object({
  id: z.number(),
  observacion: textoNulo,
  createdAt: z.string(),
  estadoAnterior: z.object({ codigo: z.string(), nombre: z.string() }).nullable(),
  estadoNuevo: z.object({ codigo: z.string(), nombre: z.string() }),
  usuario: UsuarioCortoSchema
})

export const ReintegroGastoSchema = z.object({
  id: z.number(),
  valorReintegro: z.string(),
  fechaReintegro: textoNulo,
  observacion: textoNulo,
  createdAt: z.string(),
  estado: ItemCatalogoSchema,
  registrador: UsuarioCortoSchema,
  documentos: z.array(DocumentoSchema)
})

export const LineaCuentaDeGastoSchema = z.object({
  id: z.number(),
  tieneFacturaReal: z.boolean(),
  valorFactura: z.string(),
  cuatroXMil: z.string(),
  valorLegalizado: z.string(),
  nombreTerceroReal: textoNulo,
  identificacionTerceroReal: textoNulo,
  cuentaCobro: z.object({
    id: z.number(),
    numeroCuentaCobro: z.string(),
    fechaRadicacion: textoNulo,
    estado: ItemCatalogoSchema
  })
})

export const FacturaSchema = z.object({
  id: z.number(),
  numeroFactura: textoNulo,
  tieneFacturaReal: z.boolean(),
  identificacionTerceroReal: textoNulo,
  nombreTerceroReal: textoNulo,
  valorFactura: z.string(),
  baseRetencion: z.string(),
  porcentajeRetencion: z.string(),
  retencionFuente: z.string(),
  totalPagar: z.string(),
  tasaGmf: z.string(),
  cuatroXMil: z.string(),
  valorLegalizado: z.string(),
  observacion: textoNulo,
  updatedAt: z.string(),
  registrador: UsuarioCortoSchema
})

export const GastoDetalleSchema = GastoListadoSchema.extend({
  operacionId: z.number(),
  solicitudTramiteId: z.number().nullable(),
  tramitadorId: z.number().nullable(),
  tipoGastoId: z.number(),
  formaPagoId: z.number(),
  beneficiarioId: z.number(),
  creadoPor: z.number(),
  reembolsable: z.boolean(),
  numeroFactura: textoNulo,
  transito: textoNulo,
  contrato: textoNulo,
  nombreClienteBanco: textoNulo,
  identificacionClienteBanco: textoNulo,
  codigoBpr: textoNulo,
  // Retención (solo gastos de inmueble; null en los demás)
  retencionBase: textoNulo.optional(),
  retencionPorcentaje: textoNulo.optional(),
  retencionValor: textoNulo.optional(),
  retencionTotalPagar: textoNulo.optional(),
  observacion: textoNulo,
  numeroEgreso: textoNulo,
  observacionLegalizacion: textoNulo,
  motivoAnulacion: textoNulo,
  // Contabilización de no reembolsables (los reembolsables se contabilizan por cuenta de cobro)
  documentoContable: textoNulo.optional(),
  fechaContabilizacion: textoNulo.optional(),
  contabilizador: UsuarioCortoSchema.optional(),
  updatedAt: z.string(),
  formaPago: ItemCatalogoSchema,
  bolsaId: z.number().nullable(),
  lotePagoId: z.number().nullable(),
  tramitador: z.object({ id: z.number(), nombreTramitador: z.string() }).nullable(),
  beneficiario: TerceroSchema,
  actualizador: UsuarioCortoSchema,
  trazabilidad: z.array(TrazabilidadSchema),
  documentos: z.array(DocumentoSchema),
  // Soportes del pago (pertenecen al lote, no al gasto)
  documentosPago: z.array(DocumentoSchema),
  factura: FacturaSchema.nullable(),
  reintegros: z.array(ReintegroGastoSchema),
  lineasCuentaCobro: z.array(LineaCuentaDeGastoSchema),
  anticipo: z.object({
    id: z.number(),
    codigo: z.string(),
    tipo: z.string(),
    valorRecibido: dinero,
    reciboCaja: textoNulo,
    cliente: z.object({ id: z.number(), nombre: z.string(), tipoIdentificacion: z.string(), identificacion: z.string() })
  }).nullish(),
  saldoAnticipo: z.lazy(() => SaldoClienteSchema).nullish(),
  // Tipos de documento que se pueden subir en la etapa actual del gasto
  tiposDocumento: z.array(ItemCatalogoSchema).default([]),
  legalizacionCaja: z.lazy(() => LegalizacionCajaSchema).nullish(),
  permisos: z.object({
    registrarFactura: z.boolean(),
    editar: z.boolean(),
    anular: z.boolean(),
    subirDocumentos: z.boolean(),
    soloLectura: z.boolean().optional()
  })
})

// ── Tesorería ──────────────────────────────

export const MovimientoBolsaSchema = z.object({
  id: z.number(),
  tipo: z.string(),
  valor: z.string(),
  saldoResultante: z.string(),
  lotePagoId: z.number().nullable(),
  observacion: textoNulo,
  createdAt: z.string(),
  solicitudGasto: z.object({ id: z.number(), codigo: z.string() }).nullable(),
  usuario: UsuarioCortoSchema,
  // Bolsas de anticipos
  cliente: z.object({ id: z.number(), nombre: z.string(), identificacion: z.string() }).nullish(),
  anticipo: z.object({ id: z.number(), codigo: z.string() }).nullish()
})

export const MovimientosBolsaSchema = z.object({
  bolsa: BolsaSchema,
  total: z.number(),
  pagina: z.number(),
  tamano: z.number(),
  registros: z.array(MovimientoBolsaSchema)
})

export const ESTADOS_LOTE: Record<string, string> = {
  PROGRAMADO: "Por aprobar",
  APROBADO: "Aprobado · falta confirmar",
  PAGADO: "Pagado",
  RECHAZADO: "Rechazado"
}

export const LoteListadoSchema = z.object({
  id: z.number(),
  estado: z.string(),
  fechaPago: z.string(),
  numeroEgreso: textoNulo,
  total: z.string(),
  createdAt: z.string(),
  cantidadGastos: z.number(),
  // Gastos pagados en el lote (código para mostrar y enlazar)
  gastos: z.array(z.object({ id: z.number(), codigo: z.string() })),
  bolsa: z.object({ id: z.number(), nombre: z.string() }),
  creador: UsuarioCortoSchema
})

export const ListadoLotesSchema = z.object({
  total: z.number(),
  pagina: z.number(),
  tamano: z.number(),
  registros: z.array(LoteListadoSchema)
})

export const LoteDetalleSchema = LoteListadoSchema.omit({ cantidadGastos: true }).extend({
  observacion: textoNulo,
  fechaAprobacion: textoNulo,
  fechaConfirmacion: textoNulo,
  aprobador: UsuarioCortoSchema,
  confirmador: UsuarioCortoSchema,
  gastos: z.array(z.object({
    id: z.number(),
    codigo: z.string(),
    conceptoPago: z.string(),
    valorSolicitadoPago: z.string(),
    valorProgramado: dinero,
    valorRealmentePagado: dinero,
    estado: z.object({ codigo: z.string(), nombre: z.string() }),
    beneficiario: z.object({ id: z.number(), identificacion: z.string(), nombre: z.string() }),
    creador: UsuarioCortoSchema,
    anticipoId: z.number().nullish(),
    anticipo: z.object({ id: z.number(), codigo: z.string(), cliente: z.object({ nombre: z.string() }).nullish() }).nullish(),
    saldoClienteAnticipo: z.coerce.string().nullish(),
    comprometidoClienteAnticipo: z.coerce.string().nullish()
  })),
  documentos: z.array(DocumentoSchema)
})

// ── Legalización ───────────────────────────

export const CuentaListadoSchema = z.object({
  id: z.number(),
  numeroCuentaCobro: z.string(),
  fechaRadicacion: textoNulo,
  totalFacturas: z.string(),
  totalCuatroXMil: z.string(),
  totalLegalizado: z.string(),
  fechaLegalizacion: textoNulo,
  createdAt: z.string(),
  cantidadGastos: z.number(),
  estado: ItemCatalogoSchema,
  creador: UsuarioCortoSchema
})

export const ListadoCuentasSchema = z.object({
  total: z.number(),
  pagina: z.number(),
  tamano: z.number(),
  registros: z.array(CuentaListadoSchema)
})

export const LineaCuentaSchema = z.object({
  id: z.number(),
  tieneFacturaReal: z.boolean(),
  valorFactura: z.string(),
  tasaGmf: z.string(),
  cuatroXMil: z.string(),
  valorLegalizado: z.string(),
  identificacionTerceroReal: textoNulo,
  nombreTerceroReal: textoNulo,
  observacion: textoNulo,
  solicitudGasto: z.object({
    id: z.number(),
    codigo: z.string(),
    conceptoPago: z.string(),
    placa: textoNulo,
    matriculaInmobiliaria: textoNulo,
    valorRealmentePagado: dinero,
    fechaPago: textoNulo,
    beneficiario: z.object({ id: z.number(), identificacion: z.string(), nombre: z.string() }),
    bolsa: z.object({ id: z.number(), nombre: z.string() }).nullable(),
    reintegros: z.array(z.object({ id: z.number(), valorReintegro: z.string() }))
  })
})

export const CuentaDetalleSchema = CuentaListadoSchema.omit({ cantidadGastos: true }).extend({
  observacion: textoNulo,
  motivoAnulacion: textoNulo,
  contabilizacion: z.object({
    contabilizado: z.boolean(),
    documentoContable: textoNulo,
    fechaContabilizacion: textoNulo
  }).nullable(),
  lineas: z.array(LineaCuentaSchema),
  trazabilidad: z.array(z.object({
    id: z.number(),
    observacion: textoNulo,
    createdAt: z.string(),
    estadoNuevo: z.object({ codigo: z.string(), nombre: z.string() }),
    usuario: UsuarioCortoSchema
  })),
  documentos: z.array(DocumentoSchema),
  permisos: z.object({
    editar: z.boolean(),
    legalizar: z.boolean(),
    subirDocumentos: z.boolean()
  })
})

export const ReintegroListadoSchema = z.object({
  id: z.number(),
  valorReintegro: z.string(),
  fechaReintegro: textoNulo,
  observacion: textoNulo,
  createdAt: z.string(),
  estado: ItemCatalogoSchema,
  registrador: UsuarioCortoSchema,
  solicitudGasto: z.object({
    id: z.number(),
    codigo: z.string(),
    conceptoPago: z.string(),
    valorRealmentePagado: dinero,
    tramitador: z.object({ id: z.number(), nombreTramitador: z.string() }).nullable(),
    beneficiario: z.object({ id: z.number(), nombre: z.string() })
  })
})

export const ListadoReintegrosSchema = z.object({
  total: z.number(),
  pagina: z.number(),
  tamano: z.number(),
  registros: z.array(ReintegroListadoSchema)
})

// ── Tablero ────────────────────────────────

const ValoresBolsaSchema = z.object({
  saldo: z.number(),
  porPagar: z.number(),
  gastosPorPagar: z.number(),
  pagado: z.number(),
  gastosPagados: z.number(),
  sinFactura: z.number(),
  facturadoSinCuenta: z.number(),
  enCuentaCobro: z.number(),
  legalizado: z.number(),
  gastoAsumido: z.number(),
  reintegroPendiente: z.number(),
  reintegrado: z.number()
})

export const TableroSchema = z.object({
  totales: ValoresBolsaSchema,
  bolsas: z.array(ValoresBolsaSchema.extend({
    id: z.number(),
    nombre: z.string(),
    lineaNegocio: textoNulo,
    activo: z.boolean()
  })),
  cuentasPorLegalizar: z.array(z.object({
    id: z.number(),
    numeroCuentaCobro: z.string(),
    bolsaId: z.number().nullable(),
    bolsa: textoNulo,
    gastos: z.number(),
    valorLegalizado: z.number()
  })),
  reintegros: z.object({
    pendiente: z.number(),
    cantidadPendientes: z.number(),
    reintegrado: z.number(),
    recuperacion: z.number().nullable(),
    tramitadoresConDeuda: z.number(),
    diasPromedio: z.number(),
    antiguedad: z.array(z.object({ clave: z.string(), nombre: z.string(), cantidad: z.number(), valor: z.number() })),
    principales: z.array(z.object({ tramitadorId: z.number().nullable(), nombre: textoNulo, cantidad: z.number(), valor: z.number() }))
  })
})

export const ReintegrosTramitadorSchema = z.object({
  totales: z.object({
    tramitadores: z.number(),
    pendiente: z.number(),
    reintegrado: z.number(),
    gastosConReintegro: z.number()
  }),
  tramitadores: z.array(z.object({
    tramitadorId: z.number().nullable(),
    nombre: textoNulo,
    identificacion: textoNulo,
    tramites: z.number(),
    gastos: z.number(),
    pagado: z.number(),
    gastosConReintegro: z.number(),
    pendiente: z.number(),
    reintegrado: z.number(),
    pendienteDesde: textoNulo,
    pendientes: z.array(z.object({
      id: z.number(),
      gastoId: z.number(),
      codigo: z.string(),
      concepto: z.string(),
      tramiteId: z.number().nullable(),
      referencia: textoNulo,
      pagado: z.number(),
      valor: z.number(),
      desde: z.string()
    }))
  }))
})

export type Tablero = z.infer<typeof TableroSchema>
export type BolsaTablero = Tablero["bolsas"][number]
export type ResumenReintegros = Tablero["reintegros"]
export type ReintegrosTramitador = z.infer<typeof ReintegrosTramitadorSchema>["tramitadores"][number]

export type ItemCatalogo = z.infer<typeof ItemCatalogoSchema>
export type Catalogos = z.infer<typeof CatalogosSchema>
export type Operacion = z.infer<typeof OperacionSchema>
export type Tramitador = z.infer<typeof TramitadorSchema>
export type BolsaApoyo = z.infer<typeof BolsaApoyoSchema>
export type Bolsa = z.infer<typeof BolsaSchema>
export type MovimientoBolsa = z.infer<typeof MovimientoBolsaSchema>
export type LoteDetalle = z.infer<typeof LoteDetalleSchema>
export type LoteListado = z.infer<typeof LoteListadoSchema>
export type CuentaListado = z.infer<typeof CuentaListadoSchema>
export type CuentaDetalle = z.infer<typeof CuentaDetalleSchema>
export type LineaCuenta = z.infer<typeof LineaCuentaSchema>
export type ReintegroListado = z.infer<typeof ReintegroListadoSchema>
export type Tercero = z.infer<typeof TerceroSchema>
export type TramiteApoyo = z.infer<typeof TramiteApoyoSchema>
export type GastoListado = z.infer<typeof GastoListadoSchema>
export type GastoDetalle = z.infer<typeof GastoDetalleSchema>
export type Factura = z.infer<typeof FacturaSchema>

// Lo que el formulario envía al backend (POST/PUT /gastos/solicitudes)
export type DatosGasto = {
  operacionId: number | null
  bolsaId: number | null
  solicitudTramiteId: number | null
  // Gasto creado desde un anticipo (bolsa del anticipo y no reembolsable)
  anticipoId?: number | null
  tramitadorId: number | null
  tipoGastoId: number | null
  formaPagoId: number | null
  reembolsable: boolean
  numeroFactura: string
  conceptoPago: string
  matriculaInmobiliaria: string
  placa: string
  transito: string
  contrato: string
  nombreClienteBanco: string
  identificacionClienteBanco: string
  codigoBpr: string
  valorSolicitado: string
  // Solo inmuebles: base (por defecto 0) y porcentaje en % (por defecto 11)
  baseRetencion: string | null
  porcentajeRetencion: string | null
  observacion: string
  beneficiarioId: number | null
  beneficiario: {
    tipoIdentificacion: string
    identificacion: string
    nombre: string
    banco: string
    tipoCuenta: string
    numeroCuenta: string
    correo: string
  } | null
}

// ── Soportes de los tramitadores (app Nodex Tramitadores) ──
export const SoporteRevisionSchema = z.object({
  id: z.number(),
  tipo: z.enum(["FACTURA", "REINTEGRO", "OTRO"]),
  observacion: textoNulo,
  estado: z.enum(["PENDIENTE", "APROBADO", "RECHAZADO"]),
  motivoRechazo: textoNulo,
  fechaRevision: textoNulo,
  createdAt: z.string(),
  archivos: z.array(z.object({ id: z.number(), nombreOriginal: z.string(), tipoArchivo: z.string(), tamano: z.number() })),
  tramitador: z.object({ id: z.number(), nombreTramitador: z.string() }).nullable(),
  revisor: UsuarioCortoSchema.optional(),
  reintegro: z.object({ id: z.number(), valorReintegro: z.string(), estado: z.object({ codigo: z.string(), nombre: z.string() }) }).nullable(),
  solicitudGasto: z.object({
    id: z.number(),
    codigo: z.string(),
    conceptoPago: z.string(),
    placa: textoNulo,
    matriculaInmobiliaria: textoNulo,
    solicitudTramiteId: z.number().nullable(),
    valorRealmentePagado: dinero,
    fechaPago: textoNulo,
    reembolsable: z.boolean(),
    estado: z.object({ codigo: z.string(), nombre: z.string() }),
    bolsa: z.object({ id: z.number(), nombre: z.string() }).nullable(),
    beneficiario: z.object({ nombre: z.string() })
  }),
  // Cómo va el trámite en Nodex Trámites
  tramite: z.object({
    id: z.number(),
    estado: z.string(),
    reporteRealizado: z.enum(["PENDIENTE", "REVISADO"]).nullable()
  }).nullable()
})

export type SoporteRevision = z.infer<typeof SoporteRevisionSchema>

// ── Anticipos de clientes ──────────────────

export const ESTADOS_ANTICIPO: Record<string, { nombre: string, clase: string }> = {
  POR_CONFIRMAR: { nombre: "Por confirmar", clase: "border-amber-200 bg-amber-50 text-amber-800" },
  NOVEDAD: { nombre: "Con novedad", clase: "border-red-200 bg-red-50 text-red-700" },
  CONFIRMADO: { nombre: "Confirmado", clase: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  FACTURADO: { nombre: "Facturado", clase: "border-sky-200 bg-sky-50 text-sky-700" },
  ANULADO: { nombre: "Anulado", clase: "border-slate-200 bg-slate-100 text-slate-500" }
}

export const TIPOS_ANTICIPO: Record<string, string> = { VEHICULO: "Vehículo", INMUEBLE: "Inmueble" }

// ANTICIPO: se convierte en gastos. FACTURA (solicitud de factura): Contabilidad confirma el pago
// y adjunta la factura en un solo paso; no genera gastos
export const CLASES_ANTICIPO: Record<string, string> = { ANTICIPO: "Anticipo", FACTURA: "Solicitud de factura" }

// Bolsas que llevan saldo por cliente
export const NOMBRES_TIPO_BOLSA: Record<string, string> = { GENERAL: "General", ANTICIPOS: "Anticipos", FACTURAS: "Anticipos facturados", CAJA_MENOR: "Caja menor" }
export const llevaSaldoPorCliente = (tipo: string) => tipo === "ANTICIPOS" || tipo === "FACTURAS"

export const ClienteEmpresarialSchema = z.object({ id: z.number(), nombre: z.string(), activo: z.boolean().optional() })

export const SaldoClienteSchema = z.object({
  clienteId: z.number(),
  nombre: z.string(),
  tipoIdentificacion: z.string(),
  identificacion: z.string(),
  ingresado: z.number(),
  pagado: z.number(),
  otros: z.number(),
  saldo: z.number(),
  comprometido: z.number(),
  disponible: z.number(),
  ultimoMovimiento: z.string().nullish()
})

export const AnticipoListadoSchema = z.object({
  id: z.number(),
  codigo: z.string(),
  clase: z.string().default("ANTICIPO"),
  tipo: z.string(),
  estado: z.string(),
  concepto: z.string(),
  placa: textoNulo,
  matriculaInmobiliaria: textoNulo,
  valorConsignado: z.string(),
  fechaConsignacion: z.string(),
  valorRecibido: dinero,
  reciboCaja: textoNulo,
  numeroFactura: textoNulo,
  fechaFacturacion: textoNulo,
  motivoNovedad: textoNulo,
  creadoPor: z.number(),
  createdAt: z.string(),
  cantidadGastos: z.coerce.number().default(0),
  cliente: z.object({ id: z.number(), tipoIdentificacion: z.string(), identificacion: z.string(), nombre: z.string() }),
  clienteEmpresarial: z.object({ id: z.number(), nombre: z.string() }),
  bolsa: z.object({ id: z.number(), nombre: z.string() }),
  operacion: z.object({ id: z.number(), nombreOperacion: z.string() })
})

export const ListadoAnticiposSchema = z.object({
  total: z.number(),
  pagina: z.number(),
  tamano: z.number(),
  registros: z.array(AnticipoListadoSchema)
})

export const AnticipoDetalleSchema = AnticipoListadoSchema.omit({ cantidadGastos: true }).extend({
  operacionId: z.number(),
  bolsaId: z.number(),
  clienteId: z.number(),
  clienteEmpresarialId: z.number(),
  observacion: textoNulo,
  observacionContabilidad: textoNulo,
  motivoAnulacion: textoNulo,
  fechaConfirmacion: textoNulo,
  cliente: z.object({
    id: z.number(), tipoIdentificacion: z.string(), identificacion: z.string(), nombre: z.string(),
    telefono: textoNulo, direccion: textoNulo
  }),
  creador: UsuarioCortoSchema,
  confirmador: UsuarioCortoSchema,
  trazabilidad: z.array(z.object({
    id: z.number(),
    estadoAnterior: textoNulo,
    estadoNuevo: z.string(),
    observacion: textoNulo,
    createdAt: z.string(),
    usuario: UsuarioCortoSchema
  })),
  documentos: z.array(DocumentoSchema),
  gastos: z.array(z.object({
    id: z.number(),
    codigo: z.string(),
    conceptoPago: z.string(),
    valorSolicitadoPago: z.string(),
    valorProgramado: dinero,
    valorRealmentePagado: dinero,
    fechaPago: textoNulo,
    estado: z.object({ codigo: z.string(), nombre: z.string() })
  })),
  saldoCliente: SaldoClienteSchema.nullable(),
  permisos: z.object({ editar: z.boolean(), anular: z.boolean(), revisar: z.boolean(), crearGasto: z.boolean() })
})

// Arqueo de una bolsa de anticipos: totales y conteos de todos los clientes + la página filtrada
export const FILTROS_ARQUEO = { faltante: "Con faltante", porPagar: "Con gastos por pagar", sobrante: "Con sobrante", inactivos: "Sin movimiento en 30 días" } as const
export const ORDENES_ARQUEO = { faltante: "Faltantes primero", saldo: "Mayor saldo", reciente: "Movimiento más reciente", nombre: "Nombre" } as const

export const SaldosClientesSchema = z.object({
  bolsa: z.object({ id: z.number(), nombre: z.string(), tipo: z.string(), saldoActual: z.string() }),
  totales: z.object({
    clientes: z.number(), saldo: z.number(), comprometido: z.number(), sobrantes: z.number(), faltantes: z.number(), diferencia: z.number()
  }),
  conteos: z.object({ faltante: z.number(), porPagar: z.number(), sobrante: z.number(), inactivos: z.number() }),
  total: z.number(),
  pagina: z.number(),
  tamano: z.number(),
  clientes: z.array(SaldoClienteSchema)
})

export type Arqueo = z.infer<typeof SaldosClientesSchema>

export const ResumenAnticiposSchema = z.object({
  porConfirmar: z.number(),
  porFacturar: z.number().default(0),
  conNovedad: z.number(),
  confirmadosSinGasto: z.number()
})

export type ClienteEmpresarial = z.infer<typeof ClienteEmpresarialSchema>
export type SaldoCliente = z.infer<typeof SaldoClienteSchema>
export type AnticipoListado = z.infer<typeof AnticipoListadoSchema>
export type AnticipoDetalle = z.infer<typeof AnticipoDetalleSchema>

// Documentos de la factura que adjunta Contabilidad en las solicitudes de factura (PDF y XML)
export const esDocumentoFactura = (documento: { tipoDocumento: { codigo?: string } }) =>
  ["FACTURA_ANTICIPO", "FACTURA_ANTICIPO_XML"].includes(documento.tipoDocumento.codigo ?? "")

// Lo que envía el formulario del anticipo (va como JSON en el campo "datos", con los soportes)
export type DatosAnticipo = {
  clase: "ANTICIPO" | "FACTURA"
  tipo: "VEHICULO" | "INMUEBLE"
  cliente: { tipoIdentificacion: "CC" | "NIT", identificacion: string, nombre: string, telefono: string, direccion: string }
  clienteEmpresarialId: number | null
  operacionId: number | null
  bolsaId: number | null
  concepto: string
  placa: string
  matriculaInmobiliaria: string
  valorConsignado: string
  fechaConsignacion: string
  observacion: string
}

// Estado de cuenta de un cliente en una bolsa de anticipos (panel del arqueo)
export const EstadoCuentaClienteSchema = z.object({
  bolsa: z.object({ id: z.number(), nombre: z.string() }),
  cliente: z.object({
    id: z.number(), nombre: z.string(), tipoIdentificacion: z.string(), identificacion: z.string(),
    telefono: textoNulo.optional(), direccion: textoNulo.optional()
  }),
  saldo: SaldoClienteSchema.nullable(),
  periodo: z.object({
    desde: textoNulo, hasta: textoNulo,
    saldoInicial: z.number(), entradas: z.number(), salidas: z.number(), saldoFinal: z.number()
  }),
  movimientos: z.array(z.object({
    id: z.number(),
    tipo: z.string(),
    valor: z.number(),
    saldo: z.number(),
    fecha: z.string(),
    dia: z.string(),
    observacion: textoNulo,
    lotePagoId: z.number().nullable(),
    gastoId: z.number().nullable(),
    gastoCodigo: textoNulo,
    gastoConcepto: textoNulo,
    beneficiario: textoNulo,
    anticipoId: z.number().nullable(),
    anticipoCodigo: textoNulo,
    reciboCaja: textoNulo,
    anticipoConcepto: textoNulo,
    usuario: textoNulo
  })),
  porPagar: z.array(z.object({
    id: z.number(), codigo: z.string(), concepto: z.string(), valor: z.number(),
    estadoCodigo: z.string(), estado: z.string(), fecha: z.string(), anticipoCodigo: textoNulo
  })),
  anticipos: z.array(z.object({
    id: z.number(), codigo: z.string(), estado: z.string(), concepto: z.string(),
    placa: textoNulo, matriculaInmobiliaria: textoNulo,
    valorConsignado: z.string(), valorRecibido: dinero, reciboCaja: textoNulo, fechaConsignacion: z.string(), createdAt: z.string()
  }))
})

export type EstadoCuentaCliente = z.infer<typeof EstadoCuentaClienteSchema>

// ── Caja menor ─────────────────────────────

const MontoCajaSchema = z.object({ cantidad: z.number(), valor: z.number() })

// Saldo, lo comprometido y el cuadre de una caja (fondo = saldo + sin legalizar + pendiente + en reembolso)
export const ResumenCajaSchema = z.object({
  id: z.number(),
  nombre: z.string(),
  activo: z.boolean(),
  fondo: z.number(),
  saldo: z.number(),
  topeAlerta: z.number(),
  bajoTope: z.boolean(),
  porPagar: MontoCajaSchema,
  sinLegalizar: MontoCajaSchema,
  pendienteReembolso: MontoCajaSchema,
  enReembolso: MontoCajaSchema,
  diferencia: z.number()
})
export type ResumenCaja = z.infer<typeof ResumenCajaSchema>

export const LegalizacionCajaCortaSchema = z.object({
  id: z.number(),
  numeroFactura: z.string(),
  fechaFactura: z.string(),
  beneficiario: z.string(),
  quienLegaliza: z.string(),
  valorSoporte: z.string(),
  diferencia: z.string(),
  reembolsoCajaId: z.number().nullable()
})

export const LegalizacionCajaSchema = LegalizacionCajaCortaSchema.extend({
  tipoIdentificacion: z.string(),
  identificacion: z.string(),
  placa: textoNulo,
  matriculaInmobiliaria: textoNulo,
  observacion: textoNulo,
  createdAt: z.string(),
  registrador: UsuarioCortoSchema,
  reembolso: z.object({ id: z.number(), codigo: z.string(), estado: z.string(), fechaLegalizacion: textoNulo }).nullish()
})
export type LegalizacionCaja = z.infer<typeof LegalizacionCajaSchema>

export const ESTADOS_REEMBOLSO: Record<string, string> = {
  BORRADOR: "Borrador",
  POR_APROBAR: "Por aprobar",
  APROBADO: "Aprobado",
  LEGALIZADO: "Legalizado",
  ANULADO: "Anulado"
}

export const ReembolsoListadoSchema = z.object({
  id: z.number(),
  codigo: z.string(),
  estado: z.string(),
  total: z.string(),
  observacion: textoNulo,
  motivoRechazo: textoNulo,
  fechaEnvio: textoNulo,
  fechaAprobacion: textoNulo,
  fechaLegalizacion: textoNulo,
  createdAt: z.string(),
  cantidadGastos: z.coerce.number().default(0),
  bolsa: z.object({ id: z.number(), nombre: z.string() }),
  creador: UsuarioCortoSchema,
  aprobador: UsuarioCortoSchema
})
export type ReembolsoListado = z.infer<typeof ReembolsoListadoSchema>

export const ListadoReembolsosSchema = z.object({
  total: z.number(),
  pagina: z.number(),
  tamano: z.number(),
  registros: z.array(ReembolsoListadoSchema)
})

export const ReembolsoDetalleSchema = ReembolsoListadoSchema.omit({ cantidadGastos: true }).extend({
  legalizador: UsuarioCortoSchema,
  legalizaciones: z.array(LegalizacionCajaSchema.omit({ registrador: true, reembolso: true, createdAt: true }).extend({
    solicitudGastoId: z.number(),
    solicitudGasto: z.object({
      id: z.number(),
      codigo: z.string(),
      conceptoPago: z.string(),
      valorRealmentePagado: dinero,
      fechaPago: textoNulo,
      creador: UsuarioCortoSchema
    }),
    documentos: z.array(DocumentoSchema)
  })),
  documentos: z.array(DocumentoSchema),
  historial: z.array(z.object({
    id: z.number(),
    accion: z.string(),
    detalle: textoNulo,
    createdAt: z.string(),
    usuario: UsuarioCortoSchema
  })).default([]),
  permisos: z.object({ editar: z.boolean(), aprobar: z.boolean(), legalizar: z.boolean() })
})
export type ReembolsoDetalle = z.infer<typeof ReembolsoDetalleSchema>

export const UsuariosCajaSchema = z.object({
  asignaciones: z.array(z.object({ usuarioId: z.number(), bolsaId: z.number() })),
  usuarios: z.array(z.object({ id: z.number(), nombreUsuario: z.string(), correoUsuario: z.string() }))
})
export type UsuariosCaja = z.infer<typeof UsuariosCajaSchema>

// Qué pasó en cada paso del reembolso (historial)
export const ACCIONES_REEMBOLSO: Record<string, { nombre: string, color: string }> = {
  CREADO: { nombre: "Creado", color: "bg-slate-400" },
  AGREGADO: { nombre: "Gastos agregados", color: "bg-slate-400" },
  QUITADO: { nombre: "Gastos quitados", color: "bg-amber-500" },
  ENVIADO: { nombre: "Enviado a Dirección", color: "bg-orange-500" },
  DEVUELTO: { nombre: "Devuelto por Dirección", color: "bg-red-500" },
  APROBADO: { nombre: "Aprobado", color: "bg-teal-500" },
  LEGALIZADO: { nombre: "Legalizado", color: "bg-emerald-500" },
  ANULADO: { nombre: "Anulado", color: "bg-red-500" }
}

// Historial de una caja: gastos pagados con su legalización y su reembolso
export const GastoHistorialCajaSchema = z.object({
  id: z.number(),
  codigo: z.string(),
  conceptoPago: z.string(),
  placa: textoNulo,
  matriculaInmobiliaria: textoNulo,
  valorSolicitadoPago: z.string(),
  valorRealmentePagado: dinero,
  fechaPago: textoNulo,
  estado: z.object({ codigo: z.string(), nombre: z.string() }),
  creador: UsuarioCortoSchema,
  legalizacionCaja: LegalizacionCajaCortaSchema.extend({
    tipoIdentificacion: z.string(),
    identificacion: z.string(),
    placa: textoNulo,
    matriculaInmobiliaria: textoNulo,
    reembolso: z.object({ id: z.number(), codigo: z.string(), estado: z.string(), fechaLegalizacion: textoNulo }).nullish()
  }).nullish()
})
export type GastoHistorialCaja = z.infer<typeof GastoHistorialCajaSchema>

export const HistorialCajaSchema = z.object({
  totales: z.object({ cantidad: z.number(), entregado: z.number(), soporte: z.number(), sinLegalizar: z.number() }),
  total: z.number(),
  pagina: z.number(),
  tamano: z.number(),
  registros: z.array(GastoHistorialCajaSchema)
})
