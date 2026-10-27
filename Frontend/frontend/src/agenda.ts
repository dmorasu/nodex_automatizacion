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
  direccion: string | null
  estado: string
  fechaCitaDistinta: string | null
}

export type SinHoraAgenda = {
  tramiteId: number
  tramite: string | null
  placa: string | null
  municipio: string | null
  direccion: string | null
  estado: string
  requiereCita: boolean
}

export type TipoReserva = "RESERVA" | "NO_DISPONIBLE"

export type ReservaAgenda = {
  id: number
  inicio: string
  fin: string
  motivo: string
  tipo: TipoReserva
  diaCompleto: boolean
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

export type AgendaDelDia = {
  fecha: string
  hoy: string
  duracionSinFin: number
  capacidad: number
  // Trámites abiertos sin tramitador (solo llega para Torre de control)
  sinMensajero: number | null
  mensajeros: MensajeroAgenda[]
}

// "Carlos Eduardo León" → "CE"
export const iniciales = (nombre: string) =>
  nombre.trim().split(/\s+/).slice(0, 2).map(p => p[0] ?? "").join("").toUpperCase()

// Horas para elegir en lista, cada 15 minutos (el campo de hora del navegador marcaba "valor no
// válido" con la hora a medio escribir). Se agregan las que vengan propuestas fuera de la cuadrícula.
export const opcionesDeHora = (...extras: string[]) => {
  const horas = new Set<string>()
  for (let m = aMinutos("06:00"); m <= aMinutos("21:00"); m += 15) horas.add(aHora(m))
  extras.filter(h => /^\d{2}:\d{2}$/.test(h)).forEach(h => horas.add(h))
  return [...horas].sort((a, b) => aMinutos(a) - aMinutos(b))
}

// Trámite abierto sin tramitador (bandeja de Torre de control)
export type TramiteSinMensajero = {
  id: number
  tramite: string | null
  placa: string | null
  municipio: string | null
  direccion: string | null
  cliente: string | null
  estado: string
  requiereCita: boolean
  fechaDiligencia: string | null
}

// Motivos de "No disponible" (los mismos del backend); "Otro" deja escribirlo
export const MOTIVOS_NO_DISPONIBLE = ["Permiso", "Incapacidad", "Mantenimiento de la moto", "Capacitación"]

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

export const noDisponibleTodoElDia = (m: MensajeroAgenda) => m.reservas.find(r => r.tipo === "NO_DISPONIBLE" && r.diaCompleto) ?? null

// Carga del día: diligencias del mensajero (con o sin hora) frente a su capacidad
export const cargaDelDia = (m: MensajeroAgenda, capacidad: number) => {
  const diligencias = m.citas.length + m.sinHora.length
  const porcentaje = Math.min(100, Math.round((diligencias / capacidad) * 100))
  const estado = noDisponibleTodoElDia(m) ? "No disponible"
    : diligencias > capacidad ? "Sobrecargado"
      : diligencias === capacidad ? "Completo"
        : porcentaje >= 66 ? "Ocupado" : "Disponible"
  return { diligencias, porcentaje, estado }
}

// Búsqueda: número del trámite, placa o matrícula, trámite, municipio, dirección o motivo
const normalizar = (texto: string) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
export const coincide = (busqueda: string, ...campos: (string | number | null | undefined)[]) => {
  const q = normalizar(busqueda.trim().replace(/^#/, ""))
  return !q || campos.some(c => c !== null && c !== undefined && normalizar(String(c)).includes(q))
}

// Solo lo que coincide con la búsqueda (el nombre del mensajero trae todo su día)
export const filtrarMensajero = (m: MensajeroAgenda, busqueda: string): MensajeroAgenda | null => {
  if (!busqueda.trim() || coincide(busqueda, m.nombre)) return m
  const citas = m.citas.filter(c => coincide(busqueda, c.tramiteId, c.placa, c.tramite, c.municipio, c.direccion))
  const sinHora = m.sinHora.filter(t => coincide(busqueda, t.tramiteId, t.placa, t.tramite, t.municipio, t.direccion))
  const reservas = m.reservas.filter(r => coincide(busqueda, r.tramiteId, r.motivo))
  return citas.length || sinHora.length || reservas.length ? { ...m, citas, sinHora, reservas } : null
}

// Hoja de ruta del día para pegar en WhatsApp
export const textoRutaWhatsApp = (m: MensajeroAgenda, fecha: string) => {
  const lineas = [`*Ruta de ${m.nombre}*`, fechaLarga(fecha), ""]
  const todoElDia = noDisponibleTodoElDia(m)
  if (todoElDia) return [...lineas, `No disponible todo el día: ${todoElDia.motivo}`].join("\n")

  const lugar = (t: { direccion: string | null, municipio: string | null }) => [t.direccion, t.municipio].filter(Boolean).join(", ")
  const ocupados = [
    ...m.citas.map(c => ({ inicio: c.inicio, cita: true, texto: [
      `${hora12(c.inicio)} – ${hora12(c.fin)} · Trámite #${c.tramiteId}`,
      [c.tramite, c.placa].filter(Boolean).join(" · "),
      lugar(c)
    ] })),
    ...m.reservas.filter(r => r.tipo === "NO_DISPONIBLE").map(r => ({ inicio: r.inicio, cita: false, texto: [`${hora12(r.inicio)} – ${hora12(r.fin)} · No disponible: ${r.motivo}`] }))
  ].sort((a, b) => aMinutos(a.inicio) - aMinutos(b.inicio))

  // Solo las citas llevan número; el "No disponible" va en su hora, sin número
  let numero = 0
  ocupados.forEach(o => lineas.push(`${o.cita ? `${++numero}. ` : "- "}${o.texto.filter(Boolean).join("\n   ")}`, ""))
  if (m.sinHora.length) {
    lineas.push("*Sin hora*")
    m.sinHora.forEach(t => lineas.push(`- Trámite #${t.tramiteId} · ${[t.tramite, t.placa, lugar(t)].filter(Boolean).join(" · ")}`))
  }
  if (!ocupados.length && !m.sinHora.length) lineas.push("Sin diligencias para este día.")
  return lineas.join("\n").trim()
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

  // No disponible todo el día: no hay espacios libres
  if (noDisponibleTodoElDia(m)) return ocupados

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
