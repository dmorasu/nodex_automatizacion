import { z } from "zod"
import { errorContrasena } from "./politicaContrasena"

// Respuestas del backend (/api/app-tramitadores). Los campos opcionales del
// trámite vienen como null cuando no se han diligenciado.
const texto = z.string().nullish()

export const ErrorRespuestaSchema = z.object({ error: z.string() })

// Clave pública de las notificaciones push (null = el servidor no las tiene configuradas)
export const ClavePushSchema = z.object({ clavePublica: z.string().nullable() })

// ── Sesión ─────────────────────────────────
export const InicioSesionSchema = z.object({
  identificacion: z.string().trim().min(1, "Ingrese su identificación"),
  contrasena: z.string().min(1, "Ingrese su contraseña")
})

export const RespuestaLoginSchema = z.object({
  token: z.string(),
  debeCambiarContrasena: z.boolean(),
  tramitador: z.object({ id: z.number(), nombre: z.string() })
})

export const SesionSchema = z.object({
  id: z.number(),
  nombre: z.string(),
  identificacion: z.string(),
  // Mensajero: ve "Mi ruta"
  esMensajero: z.boolean().optional().default(false),
  debeCambiarContrasena: z.boolean()
})

// Ruta del día del mensajero (GET /ruta?fecha=)
export const ParadaSchema = z.object({
  id: z.number(),
  orden: z.number(),
  estado: z.enum(["PENDIENTE", "ENTREGADO", "NO_SE_PUDO"]),
  observacion: z.string().nullable(),
  // Desplazamiento de la realizada; las de antes del 2026-10-25 no lo tienen
  transporte: z.enum(["MOTO", "INTERMUNICIPAL"]).nullable().optional(),
  fechaConfirmacion: z.string().nullable(),
  // Hora en que el mensajero inició la diligencia (la confirmación es su fin)
  inicioDiligencia: z.string().nullable(),
  tieneFoto: z.boolean(),
  tramiteId: z.number(),
  cliente: z.string().nullable(),
  tipo: z.string().nullable(),
  placa: z.string().nullable(),
  detalle: z.string().nullable(),
  direccion: z.string().nullable(),
  municipio: z.string().nullable(),
  latitud: z.number().nullable(),
  longitud: z.number().nullable()
})

export const RutaSchema = z.object({
  fecha: z.string(),
  sede: z.object({
    nombre: z.string(),
    direccion: z.string(),
    latitud: z.number().nullable(),
    longitud: z.number().nullable()
  }).nullable(),
  paradas: z.array(ParadaSchema),
  // Rutas marcadas ese día (inicio, fin, almuerzo y km por GPS) y la que está en curso
  jornadas: z.array(z.object({
    id: z.number(),
    inicio: z.string(),
    fin: z.string().nullable(),
    minutosTotales: z.number(),
    minutosAlmuerzo: z.number(),
    minutosEfectivos: z.number(),
    enAlmuerzo: z.boolean(),
    km: z.number()
  })),
  jornadaAbierta: z.object({ id: z.number(), fecha: z.string(), inicio: z.string(), enAlmuerzo: z.boolean() }).nullable()
})

export const CambioContrasenaSchema = z.object({
  contrasenaActual: z.string().min(1, "Ingrese su contraseña actual"),
  contrasena: z.string().superRefine((valor, ctx) => {
    const error = errorContrasena(valor)
    if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error.replace("La contraseña", "La nueva contraseña") })
  }),
  confirmacion: z.string()
}).refine(datos => datos.contrasena === datos.confirmacion, { message: "Las contraseñas no coinciden" })

// ── Trámites ───────────────────────────────
const ProgramacionSchema = z.object({
  fechaRealizacionDiligencia: texto,
  fechaProbableEntrega: texto,
  fechaFinalizacionServicio: texto,
  requiereCita: z.boolean().nullish(),
  fechaCita: texto,
  horaCita: texto
}).nullish()

const EstadoSchema = z.object({ nombreEstado: z.string() }).nullish()

export const TramiteListadoSchema = z.object({
  id: z.number(),
  placa: texto,
  matriculaInmobiliaria: texto,
  detalleSolicitud: texto,
  direccionTramite: texto,
  createdAt: z.string(),
  reportePendiente: z.boolean().nullish(),
  // Gastos pagados del trámite a los que les falta la factura (se sube en el trámite)
  gastosSinFactura: z.number().nullish(),
  estadoActual: EstadoSchema,
  clientes: z.object({ nombreCliente: z.string() }).nullish(),
  tramite: z.object({ nombreTramite: z.string() }).nullish(),
  municipios: z.object({ nombreMunicipio: z.string(), departamento: texto }).nullish(),
  programacion: ProgramacionSchema
})

export const ListadoTramitesSchema = z.object({
  total: z.number(),
  pagina: z.number(),
  tamano: z.number(),
  registros: z.array(TramiteListadoSchema)
})

const ComentarioSchema = z.object({
  id: z.number(),
  comentario: z.string(),
  fecha: z.string(),
  autor: z.object({ tipo: z.enum(["TRAMITADOR", "USUARIO"]), id: z.number().nullable(), nombre: z.string() })
})

const ReporteSchema = z.object({
  id: z.number(),
  observacion: z.string(),
  estado: z.enum(["PENDIENTE", "REVISADO", "DEVUELTO"]),
  fecha: z.string(),
  revisor: z.string().nullable(),
  fechaRevision: z.string().nullable(),
  notaRevision: z.string().nullable()
})

const GastoDelTramiteSchema = z.object({
  id: z.number(),
  codigo: z.string(),
  conceptoPago: z.string(),
  valorRealmentePagado: texto,
  estado: z.object({ codigo: z.string(), nombre: z.string() }),
  soporteFactura: z.object({ estado: z.enum(["PENDIENTE", "APROBADO", "RECHAZADO"]), motivoRechazo: texto }).nullable(),
  reintegrosPendientes: z.array(z.object({ id: z.number(), valor: z.string() })),
  puedeSubirFactura: z.boolean(),
  reintegrosPorSoportar: z.array(z.number())
})

export const DetalleTramiteSchema = z.object({
  tramite: z.object({
    id: z.number(),
    placa: texto,
    matriculaInmobiliaria: texto,
    detalleSolicitud: texto,
    descripcionTramite: texto,
    documentosAportados: texto,
    direccionTramite: texto,
    fechaAsignacion: texto,
    fechaEntregaResultado: texto,
    createdAt: z.string(),
    estadoActual: EstadoSchema,
    clientes: z.object({
      nombreCliente: z.string(),
      identificacionCliente: texto,
      telefono: texto,
      telefonoMovil: texto
    }).nullish(),
    tramite: z.object({ nombreTramite: z.string() }).nullish(),
    entidad: z.object({ nombreEntidad: z.string() }).nullish(),
    municipios: z.object({ nombreMunicipio: z.string(), departamento: texto }).nullish(),
    operaciones: z.object({ nombreOperacion: z.string() }).nullish(),
    programacion: ProgramacionSchema,
    logistica: z.object({
      numeroGuia: texto,
      destinatario: texto,
      fechaProgramacionLogistica: texto,
      fechaEntregaTransportadora: texto,
      transportadora: z.object({ nombreTransportadora: z.string() }).nullish()
    }).nullish(),
    estadosTramites: z.array(z.object({ id: z.number(), createdAt: z.string(), estado: EstadoSchema })).default([]),
    subEstadosSolicitud: z.array(z.object({
      id: z.number(),
      observacion: texto,
      createdAt: z.string(),
      subEstado: z.object({ nombre: z.string() }).nullish()
    })).default([]),
    trazabilidad: z.array(z.object({
      id: z.number(),
      observacionTrazabilidad: texto,
      nombreUsuario: texto,
      createdAt: z.string()
    })).default([]),
    documentos: z.array(z.object({
      id: z.number(),
      nombreOriginal: z.string(),
      tipoArchivo: z.string(),
      // Lo subió el tramitador (app) o un usuario del equipo (Nodex Trámites)
      tramitadorId: z.number().nullish(),
      tipoDocumento: z.string().nullish(),
      usuario: z.object({ nombreUsuario: z.string() }).nullish(),
      createdAt: z.string()
    })).default([])
  }),
  comentarios: z.array(ComentarioSchema),
  reportes: z.array(ReporteSchema),
  // Gastos pagados del trámite: si les falta la factura o deben reintegro
  gastos: z.array(GastoDelTramiteSchema).default([])
})

// ── Gastos ─────────────────────────────────
const SoporteSchema = z.object({
  id: z.number(),
  reintegroId: z.number().nullable(),
  tipo: z.enum(["FACTURA", "REINTEGRO", "OTRO"]),
  observacion: texto,
  estado: z.enum(["PENDIENTE", "APROBADO", "RECHAZADO"]),
  motivoRechazo: texto,
  fechaRevision: texto,
  createdAt: z.string(),
  archivos: z.array(z.object({ id: z.number(), nombreOriginal: z.string(), tipoArchivo: z.string(), tamano: z.number() }))
})

const ItemSchema = z.object({ codigo: z.string(), nombre: z.string() })

export const GastoSchema = z.object({
  id: z.number(),
  codigo: z.string(),
  conceptoPago: z.string(),
  placa: texto,
  matriculaInmobiliaria: texto,
  solicitudTramiteId: z.number().nullable(),
  valorRealmentePagado: texto,
  fechaPago: texto,
  estado: ItemSchema,
  beneficiario: z.object({ nombre: z.string() }).nullish(),
  factura: z.object({ numeroFactura: texto, valorFactura: z.string() }).nullish(),
  reintegros: z.array(z.object({
    id: z.number(),
    valorReintegro: z.string(),
    fechaReintegro: texto,
    createdAt: z.string(),
    estado: ItemSchema
  })),
  soportes: z.array(SoporteSchema),
  puedeSubirFactura: z.boolean(),
  reintegrosPorSoportar: z.array(z.number())
})

export const ListadoGastosSchema = z.object({
  total: z.number(),
  pagina: z.number(),
  tamano: z.number(),
  resumen: z.object({
    porReintegrar: z.number(),
    reintegrosPendientes: z.number(),
    gastosSinFactura: z.number()
  }),
  registros: z.array(GastoSchema)
})

export type Sesion = z.infer<typeof SesionSchema>
export type Parada = z.infer<typeof ParadaSchema>
export type Ruta = z.infer<typeof RutaSchema>
export type JornadaDelDia = Ruta["jornadas"][number]
export type TramiteListado = z.infer<typeof TramiteListadoSchema>
export type DetalleTramite = z.infer<typeof DetalleTramiteSchema>
export type GastoDelTramite = z.infer<typeof GastoDelTramiteSchema>
export type Gasto = z.infer<typeof GastoSchema>
export type Soporte = z.infer<typeof SoporteSchema>

// ── Cuentas de cobro ──

export const ESTADOS_CUENTA_APP = ["CON_TRAMITADOR", "POR_CORREGIR", "APROBADA", "EN_TESORERIA", "PAGADA"] as const

export const CuentaCobroSchema = z.object({
  id: z.number(),
  numero: z.string(),
  estado: z.enum(ESTADOS_CUENTA_APP),
  total: z.number(),
  enviadaEn: z.string().nullable(),
  aprobadaEn: z.string().nullable(),
  fechaPago: z.string().nullable()
})

export const DetalleCuentaCobroSchema = CuentaCobroSchema.extend({
  fechaRadicacion: z.string().nullable(),
  tieneFirma: z.boolean(),
  tramites: z.array(z.object({
    tramiteId: z.number(),
    placa: z.string().nullable(),
    total: z.number(),
    lineas: z.array(z.object({
      id: z.number(),
      tipo: z.enum(["TRAMITE", "VISITA_FALLIDA", "ADICIONAL"]),
      concepto: z.string(),
      fecha: z.string(),
      valor: z.number()
    }))
  }))
})

export type CuentaCobro = z.infer<typeof CuentaCobroSchema>
export type DetalleCuentaCobro = z.infer<typeof DetalleCuentaCobroSchema>
