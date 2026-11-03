// Cuentas de cobro de los tramitadores que llegan a Tesorería (GET /gastos/cuentas-tramitadores)

export type CuentaTramitadorResumen = {
  id: number
  numero: string
  estado: "EN_TESORERIA" | "PAGADA"
  semana: string
  total: number
  tramites: number
  tramitador: { id: number, nombre: string, identificacion: string }
  fechaRadicacion: string | null
  fechaPago: string | null
}

export type ListadoCuentasTramitador = { cuentas: CuentaTramitadorResumen[], total: number, porPagina: number }

// Cómo calculó Nodex la retención (valores en centavos)
export type CalculoRetencion = {
  metodo: "TABLA_383" | "TARIFA_FIJA"
  mes: string
  uvt: number
  tarifa?: number
  baseMes?: number
  retencionMes?: number
  retenidoAntes?: number
  calculada: number
}

export type DetalleCuentaTramitador = {
  id: number
  numero: string
  estado: "EN_TESORERIA" | "PAGADA"
  total: number
  retencion: number | null
  neto: number
  calculoRetencion: CalculoRetencion | null
  retencionAjustada: boolean
  bolsa: { id: number, nombre: string } | null
  tramitador: {
    nombre: string
    identificacion: string
    direccion: string | null
    ciudad: string | null
    correo: string | null
    telefono: string | null
    banco: string | null
    tipoCuenta: string | null
    numeroCuenta: string | null
  }
  tramites: {
    tramiteId: number
    placa: string | null
    total: number
    lineas: { id: number, tipo: "TRAMITE" | "VISITA_FALLIDA" | "ADICIONAL", concepto: string, fecha: string, valor: number, centroCostos: string | null }[]
  }[]
  distribucion: { centroCostos: string, valor: number, porcentaje: number }[]
  aprobadaEn: string | null
  vistoBuenoEn: string | null
  vistoBuenoPor: string | null
  fechaRadicacion: string | null
  fechaPago: string | null
  pagadaPor: string | null
  observacionPago: string | null
  tieneSoportePago: boolean
}

export const NOMBRE_LINEA = { TRAMITE: "Trámite", VISITA_FALLIDA: "Visita fallida", ADICIONAL: "Adicional" } as const
