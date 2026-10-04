// Respuesta de GET /solicitudTramites/tablero (services/tableroTramites.ts en el backend)

export type TramiteAlerta = {
  id: number
  cliente: string | null
  tipo: string | null
  placa: string | null
  estado: string
  analista: string | null
  tramitador: string | null
  municipio: string | null
  fechaProgramada: string | null
  diasAtraso?: number
  diasSinMovimiento?: number
}

export type ListaAlerta = { total: number, items: TramiteAlerta[] }

export type ClaveAlerta =
  | "vencidos"
  | "novedadSinMovimiento"
  | "realizadoSinFinalizar"
  | "sinTramitador"
  | "sinProgramacion"
  | "sinMovimiento"
  | "sinAnalista"

export type FilaAnalista = {
  analistaId: number | null
  analista: string
  abiertos: number
  vencidos: number
  enNovedad: number
  finalizados: number
  porcentajeATiempo: number | null
  cicloPromedioDias: number | null
}

export type FilaTramitador = {
  tramitadorId: number | null
  tramitador: string
  abiertos: number
  vencidos: number
  enNovedad: number
  finalizados: number
  porcentajeATiempo: number | null
  cicloPromedioDias: number | null
  realizadoSinFinalizar: number
  reintegroPendiente: number
  gastosConReintegro: number
}

export type FilaCliente = {
  clienteId: number | null
  cliente: string
  identificacion: string | null
  abiertos: number
  vencidos: number
  finalizados: number
  porcentajeATiempo: number | null
  valorFinalizado: number
}

export type FilaMunicipio = {
  municipioId: number | null
  municipio: string
  departamento: string | null
  latitud: number | null
  longitud: number | null
  abiertos: number
  vencidos: number
}

export type Conteo = { nombre: string, cantidad: number }

export const formatoPesos = (valor: number) =>
  valor.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })

export type Tablero = {
  hoy: string
  diasGracia: number
  filtros: { desde: string, hasta: string }
  indicadores: {
    abiertos: number
    vencidos: number
    enNovedad: number
    finalizados: number
    porcentajeATiempo: number | null
    finalizadosConFecha: number
    cicloPromedioDias: number | null
    valorFinalizado: number
  }
  atencion: Record<ClaveAlerta, ListaAlerta>
  porAnalista: FilaAnalista[]
  porTramitador: FilaTramitador[]
  porCliente: FilaCliente[]
  porMunicipio: FilaMunicipio[]
  causasNovedad: {
    total: number
    porTipo: Conteo[]
    porEntidad: Conteo[]
    porMunicipio: Conteo[]
  }
  // false si no se pudieron leer los reintegros de Nodex Gastos
  reintegrosDisponibles: boolean
  tendencia: { semana: string, creados: number, finalizados: number }[]
  antiguedad: {
    estados: string[]
    rangos: { rango: string, total: number, porEstado: Record<string, number> }[]
  }
}

export type OpcionFiltro = { id: number, nombre: string }

// "2026-09-28" → "28 sep"
export const fechaCorta = (fecha: string) =>
  new Date(`${fecha}T12:00:00Z`).toLocaleDateString("es-CO", { day: "numeric", month: "short", timeZone: "UTC" }).replace(".", "")
