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
  fechaEntrega: string | null
  ultimaGestion: string | null      // YYYY-MM-DD HH:MI (Bogotá)
  ultimaGestionTipo: string | null
  diasAtraso?: number
  diasEnNovedad?: number
  diasSinMovimiento?: number
}

export type ListaAlerta = { total: number, items: TramiteAlerta[] }

export type ClaveAlerta =
  | "vencenHoy"
  | "vencidos"
  | "enNovedad"
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
  // Creados en el período programados a más tardar el día hábil siguiente
  programacionEvaluados: number
  programacionEnPlazo: number
  porcentajeProgramacionEnPlazo: number | null
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

// Trámites por operación y la suma de su valor del trámite (sin viáticos)
export type FilaOperacion = {
  operacionId: number | null
  operacion: string
  tramites: number
  conValor: number
  valorTotal: number
  porcentaje: number
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
  // Acumulado de siempre, o en su propio rango de creación (desde/hasta)
  valorPorOperacion: { desde: string | null, hasta: string | null, total: number, filas: FilaOperacion[] }
  porMunicipio: FilaMunicipio[]
  causasNovedad: {
    total: number
    porTipo: Conteo[]
    porEntidad: Conteo[]
    porMunicipio: Conteo[]
  }
  // false si no se pudieron leer los reintegros de Nodex Gastos
  reintegrosDisponibles: boolean
  // finalizadosFueraDePlazo: parte de los finalizados (más de 1 día hábil después del reporte del tramitador)
  tendencia: { semana: string, creados: number, finalizados: number, finalizadosFueraDePlazo: number }[]
  antiguedad: {
    estados: string[]
    rangos: { rango: string, total: number, porEstado: Record<string, number> }[]
  }
}

export type OpcionFiltro = { id: number, nombre: string }

// 1234 → "1.234" sin toLocaleString: el servidor y Safari agrupan distinto y React da error de hidratación
export const miles = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".")

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]

// "2026-09-28" → "28 sep". Sin toLocaleDateString: el servidor y algunos navegadores (Safari)
// abrevian distinto ("sep" / "sept.") y React da error de hidratación
export const fechaCorta = (fecha: string) => {
  const [, mes, dia] = fecha.slice(0, 10).split("-").map(Number)
  return `${dia} ${MESES[mes - 1]}`
}
