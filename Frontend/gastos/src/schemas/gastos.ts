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

export const CatalogosSchema = z.object({
  tiposGasto: z.array(ItemCatalogoSchema),
  formasPago: z.array(ItemCatalogoSchema),
  estadosGasto: z.array(ItemCatalogoSchema),
  tiposDocumento: z.array(ItemCatalogoSchema)
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
  lineaNegocio: textoNulo
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
  correo: textoNulo
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
  // Seguimiento desde la app de tramitadores
  solicitudTramiteId: z.number().nullish(),
  soporteTramitador: z.enum(["PENDIENTE", "APROBADO", "RECHAZADO"]).nullish(),
  estadoTramite: z.string().nullish(),
  reporteRealizado: z.enum(["PENDIENTE", "REVISADO"]).nullish()
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
  tipoDocumento: z.object({ id: z.number(), nombre: z.string() }),
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
  permisos: z.object({
    registrarFactura: z.boolean(),
    editar: z.boolean(),
    anular: z.boolean(),
    subirDocumentos: z.boolean()
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
  usuario: UsuarioCortoSchema
})

export const MovimientosBolsaSchema = z.object({
  bolsa: BolsaSchema,
  total: z.number(),
  pagina: z.number(),
  tamano: z.number(),
  registros: z.array(MovimientoBolsaSchema)
})

export const LoteListadoSchema = z.object({
  id: z.number(),
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
  gastos: z.array(z.object({
    id: z.number(),
    codigo: z.string(),
    conceptoPago: z.string(),
    valorSolicitadoPago: z.string(),
    valorRealmentePagado: dinero,
    beneficiario: z.object({ id: z.number(), identificacion: z.string(), nombre: z.string() }),
    creador: UsuarioCortoSchema
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
