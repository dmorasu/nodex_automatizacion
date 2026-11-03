// Calificaciones de la encuesta de finalizado (escala 1 a 4). Sin toLocale*: se pintan en el servidor.

export type TramiteCalificado = {
  id: number
  placa: string | null
  tipo: string | null
  creadoPor: string | null
  tramitadorId: number | null
  tramitador: string | null
  finalizado: string | null
  promedio: number | null
  evaluadaEn: string | null
  evaluadaPor: string | null
}

export type ResumenCalificaciones = { finalizados: number, calificados: number, sinCalificar: number, promedio: number | null, bajas: number }

export type CalificacionesPorTramite = { tramites: TramiteCalificado[], total: number, porPagina: number, resumen: ResumenCalificaciones }

export type CalificacionesPorTramitador = {
  preguntas: { id: number, texto: string, orden: number }[]
  tramitadores: {
    tramitadorId: number | null
    tramitador: string
    finalizados: number
    calificados: number
    promedio: number | null
    bajas: number
    porPregunta: Record<string, number | null>
  }[]
}

// Nombre y color según el promedio (Malo 1, Regular 2, Bueno 3, Excelente 4)
export const nivel = (promedio: number) => {
  if (promedio >= 3.5) return { nombre: "Excelente", clase: "border-emerald-200 bg-emerald-50 text-emerald-700" }
  if (promedio >= 2.5) return { nombre: "Bueno", clase: "border-sky-200 bg-sky-50 text-sky-700" }
  if (promedio >= 1.5) return { nombre: "Regular", clase: "border-amber-200 bg-amber-50 text-amber-800" }
  return { nombre: "Malo", clase: "border-red-200 bg-red-50 text-red-600" }
}

export const NOMBRES_RESPUESTA: Record<number, string> = { 1: "Malo", 2: "Regular", 3: "Bueno", 4: "Excelente" }

// 3.4 → "3,40"
export const numero = (valor: number) => valor.toFixed(2).replace(".", ",")

export const fechaCorta = (fecha: string | null) => (fecha ? fecha.slice(0, 10).split("-").reverse().join("/") : "—")
