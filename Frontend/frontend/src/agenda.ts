// Agenda de los mensajeros: tipos de /agenda-mensajeros y cálculos de la pantalla.
// Sin toLocale* (se pinta también en el servidor: error de hidratación).

export type CitaAgenda = {
  tramiteId: number
  inicio: string
  fin: string
  sinHoraFin: boolean
  tramite: string | null
  placa: string | null
  municipio: string | null
  estado: string
  fechaCitaDistinta: string | null
}

export type SinHoraAgenda = {
  tramiteId: number
  tramite: string | null
  placa: string | null
  municipio: string | null
  estado: string
  requiereCita: boolean
}

export type ReservaAgenda = {
  id: number
  inicio: string
  fin: string
  motivo: string
  tramiteId: number | null
  creadaPor: string
  creadaEn: string
  puedeCancelar: boolean
}

export type MensajeroAgenda = {
  id: number
  nombre: string
  sede: string | null
  citas: CitaAgenda[]
  sinHora: SinHoraAgenda[]
  reservas: ReservaAgenda[]
}

export type AgendaDelDia = { fecha: string, hoy: string, duracionSinFin: number, mensajeros: MensajeroAgenda[] }

// Jornada en la que se buscan espacios libres
export const INICIO_JORNADA = "07:30"
export const FIN_JORNADA = "17:30"
// Espacios libres más cortos que esto no se muestran
export const MINUTOS_LIBRE_MINIMO = 30

export const aMinutos = (hora: string) => {
  const [h, m] = hora.split(":").map(Number)
  return h * 60 + m
}
export const aHora = (minutos: number) => `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`

// "14:30" → "2:30 p. m."
export const hora12 = (hora: string) => {
  const [h, m] = hora.split(":").map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "a. m." : "p. m."}`
}

export const duracionTexto = (minutos: number) =>
  minutos < 60 ? `${minutos} min` : `${Math.floor(minutos / 60)} h${minutos % 60 ? ` ${minutos % 60} min` : ""}`

// "2026-10-24" → "24/10/2026"
export const fechaCorta = (fecha: string) => fecha.split("-").reverse().join("/")

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"]
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
// "2026-10-24" → "Sábado 24 de octubre"
export const fechaLarga = (fecha: string) => {
  const d = new Date(`${fecha}T12:00:00Z`)
  const dia = DIAS[d.getUTCDay()]
  return `${dia[0].toUpperCase()}${dia.slice(1)} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`
}

export type BloqueAgenda =
  | { tipo: "cita", inicio: string, fin: string, cita: CitaAgenda }
  | { tipo: "reserva", inicio: string, fin: string, reserva: ReservaAgenda }
  | { tipo: "libre", inicio: string, fin: string, minutos: number }

// El día del mensajero en orden: citas, reservas y los espacios libres de la jornada
export const bloquesDelDia = (m: MensajeroAgenda): BloqueAgenda[] => {
  const ocupados: BloqueAgenda[] = [
    ...m.citas.map(c => ({ tipo: "cita" as const, inicio: c.inicio, fin: c.fin, cita: c })),
    ...m.reservas.map(r => ({ tipo: "reserva" as const, inicio: r.inicio, fin: r.fin, reserva: r }))
  ].sort((a, b) => aMinutos(a.inicio) - aMinutos(b.inicio))

  const libres: BloqueAgenda[] = []
  let desde = aMinutos(INICIO_JORNADA)
  const hasta = aMinutos(FIN_JORNADA)
  for (const o of ocupados) {
    const inicio = aMinutos(o.inicio)
    if (inicio - desde >= MINUTOS_LIBRE_MINIMO && desde < hasta) {
      const fin = Math.min(inicio, hasta)
      if (fin - desde >= MINUTOS_LIBRE_MINIMO) libres.push({ tipo: "libre", inicio: aHora(desde), fin: aHora(fin), minutos: fin - desde })
    }
    desde = Math.max(desde, aMinutos(o.fin))
  }
  if (hasta - desde >= MINUTOS_LIBRE_MINIMO) libres.push({ tipo: "libre", inicio: aHora(desde), fin: aHora(hasta), minutos: hasta - desde })

  return [...ocupados, ...libres].sort((a, b) => aMinutos(a.inicio) - aMinutos(b.inicio))
}
