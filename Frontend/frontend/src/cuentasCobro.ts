// Cuentas de cobro de los tramitadores: tipos de /cuentas-cobro-tramitadores y formatos.
// Los formatos no usan toLocale* (se pintan también en el servidor: error de hidratación).

export type EstadoCuenta = "BORRADOR" | "CON_TRAMITADOR" | "POR_CORREGIR" | "APROBADA" | "EN_TESORERIA" | "PAGADA" | "ANULADA"
export type TipoLinea = "TRAMITE" | "VISITA_FALLIDA" | "ADICIONAL"

export const ESTADOS_CUENTA: Record<EstadoCuenta, { nombre: string, clase: string }> = {
  BORRADOR: { nombre: "Borrador", clase: "border-slate-200 bg-slate-50 text-slate-600" },
  POR_CORREGIR: { nombre: "Por corregir", clase: "border-amber-200 bg-amber-50 text-amber-700" },
  CON_TRAMITADOR: { nombre: "Con el tramitador", clase: "border-orange-200 bg-orange-50 text-orange-700" },
  APROBADA: { nombre: "Aprobada por el tramitador", clase: "border-teal-200 bg-teal-50 text-teal-700" },
  EN_TESORERIA: { nombre: "En Tesorería", clase: "border-violet-200 bg-violet-50 text-violet-700" },
  PAGADA: { nombre: "Pagada", clase: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  ANULADA: { nombre: "Anulada", clase: "border-red-200 bg-red-50 text-red-600" }
}

export const NOMBRE_TIPO_LINEA: Record<TipoLinea, string> = {
  TRAMITE: "Trámite",
  VISITA_FALLIDA: "Visita fallida",
  ADICIONAL: "Adicional"
}

export type FilaPorGenerar = {
  tramitador: { id: number, nombre: string, identificacion: string }
  cantidad: number
  sinValor: number
  total: number
  desde: string
  hasta: string
  faltantes: string[]
  cuentaAbierta: { id: number, numero: string } | null
}

// Trámites listos para cobrar, por semana de finalizado
export type PorGenerar = { semana: string, tramitadores: FilaPorGenerar[] }

export type CuentaResumen = {
  id: number
  numero: string
  estado: EstadoCuenta
  semana: string
  total: number
  tramites: number
  tramitador: { id: number, nombre: string, identificacion: string }
  enviadaEn: string | null
  aprobadaEn: string | null
  fechaRadicacion: string | null
  fechaPago: string | null
  actualizadaEn: string
}

export type ListadoCuentas = {
  cuentas: CuentaResumen[]
  total: number
  porPagina: number
  conteos: Partial<Record<EstadoCuenta, number>>
}

export type LineaCuenta = {
  id: number
  tramiteId: number
  tipo: TipoLinea
  concepto: string
  fecha: string
  valor: number
  centroCostos: string | null
  creadaPorTramitador: number | null
  tieneSoporte: boolean
}

export type TramiteCuenta = { tramiteId: number, placa: string | null, cliente: string | null, lineas: LineaCuenta[], total: number }

export type DetalleCuenta = {
  id: number
  numero: string
  estado: EstadoCuenta
  editable: boolean
  semana: string
  total: number
  tramitador: {
    id: number
    nombre: string
    identificacion: string
    direccion: string | null
    ciudad: string | null
    correo: string | null
    telefono: string | null
    banco: string | null
    tipoCuenta: string | null
    numeroCuenta: string | null
    declaracionArt383: boolean
    tieneAcceso: boolean
    tieneFirma: boolean
  }
  faltantes: string[]
  tramites: TramiteCuenta[]
  distribucion: { centroCostos: string, valor: number, porcentaje: number }[]
  creadaEn: string
  enviadaEn: string | null
  aprobadaEn: string | null
  vistoBuenoEn: string | null
  vistoBuenoPor: string | null
  fechaRadicacion: string | null
  fechaPago: string | null
  pagadaPor: string | null
  observacionPago: string | null
  tieneSoportePago: boolean
  motivoAnulacion: string | null
  historial: { id: number, accion: string, detalle: string | null, nombre: string | null, esTramitador: boolean, fecha: string }[]
}

// Centavos → "$ 350.000"
export const pesos = (centavos: number) => {
  const entero = Math.round(Math.abs(centavos) / 100)
  return `${centavos < 0 ? "-" : ""}$ ${String(entero).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`
}

// "2026-10-09" → "09/10/2026" (sin zona horaria: es una fecha sin hora)
export const fechaCorta = (fecha: string | null) => (fecha ? fecha.slice(0, 10).split("-").reverse().join("/") : "—")

// Fecha y hora de Colombia (UTC-5 todo el año) sin depender del navegador
export const fechaHora = (iso: string | null) => {
  if (!iso) return "—"
  const enBogota = new Date(Date.parse(iso) - 5 * 3600 * 1000).toISOString()
  return `${fechaCorta(enBogota)} ${enBogota.slice(11, 16)}`
}

// Rango de la semana (sábado a viernes) a partir del viernes que la cierra
export const nombreSemana = (viernes: string) => {
  const inicio = new Date(`${viernes}T12:00:00Z`)
  inicio.setUTCDate(inicio.getUTCDate() - 6)
  return `${fechaCorta(inicio.toISOString())} al ${fechaCorta(viernes)}`
}

// Pestañas de la pantalla y los estados que muestra cada una
export const PESTANAS = [
  { clave: "porGenerar", nombre: "Por generar", estados: [] as EstadoCuenta[] },
  { clave: "borradores", nombre: "Borradores y por corregir", estados: ["BORRADOR", "POR_CORREGIR"] as EstadoCuenta[] },
  { clave: "tramitador", nombre: "Con el tramitador", estados: ["CON_TRAMITADOR"] as EstadoCuenta[] },
  { clave: "vistoBueno", nombre: "Por visto bueno", estados: ["APROBADA"] as EstadoCuenta[] },
  { clave: "tesoreria", nombre: "En Tesorería", estados: ["EN_TESORERIA"] as EstadoCuenta[] },
  { clave: "pagadas", nombre: "Pagadas", estados: ["PAGADA"] as EstadoCuenta[] },
  { clave: "anuladas", nombre: "Anuladas", estados: ["ANULADA"] as EstadoCuenta[] }
] as const

export type ClavePestana = typeof PESTANAS[number]["clave"]
