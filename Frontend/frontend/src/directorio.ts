// Directorio de tramitadores (Ayudas Torre de Control): tipos y cálculos de la pantalla

export type MunicipioDirectorio = { id: number, nombre: string, departamento: string, regional: string | null, latitud: number | null, longitud: number | null }

export type PersonaDirectorio = {
  id: number
  nombre: string
  identificacion: string | null
  esMensajero: boolean
  region: string | null
  whatsapp: string | null
  correo: string | null
  correoPersonal: string | null
  direccion: string | null
  ciudad: string | null
  banco: string | null
  tipoCuenta: string | null
  tarjetaAmparada: boolean | null
  tiempoPago: string | null
  nota: string | null
  cumpleDia: number | null
  cumpleMes: number | null
  sede: string | null
  residenciaId: number | null
  cobertura: number[]
}

export type SedeDirectorio = { id: number, nombre: string, direccion: string, ciudad: string | null, celular: string | null, horario: string | null }

export type DatosDirectorio = { municipios: MunicipioDirectorio[], tramitadores: PersonaDirectorio[], sedes: SedeDirectorio[] }

export const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]

// Sin tildes ni mayúsculas, para buscar
export const normalizar = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()

// "BOGOTÁ, D.C." → "Bogotá, D.C."; "SAN JOSÉ DE CÚCUTA" → "San José de Cúcuta"
const MENORES = new Set(["de", "del", "la", "las", "los", "y", "el", "e", "en"])
export const tituloMunicipio = (s: string) => s.toLowerCase().split(" ").map((p, i) =>
  /^[a-z]\.[a-z]/i.test(p) ? p.toUpperCase() : i > 0 && MENORES.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)).join(" ")

// Celular de 10 dígitos para mostrar (Nodex lo guarda con el 57 del país)
export const celular = (whatsapp: string | null) => {
  const d = String(whatsapp ?? "").replace(/\D/g, "").replace(/^57(?=\d{10}$)/, "")
  return d.length === 10 ? d.replace(/(\d{3})(\d{3})(\d{4})/, "$1 $2 $3") : whatsapp ?? ""
}

// Etiquetas que salen de la nota de Torre de control; la prioridad ordena las fichas
// (mensajeros primero, luego "Primera opción", los demás y al final los de uso restringido)
const REGLAS: [RegExp, string, Tono, number][] = [
  [/contingencia/, "Solo contingencia", "alerta", 3],
  [/solo usar|solo con autorizacion|usar solo/, "Uso restringido", "alerta", 3],
  [/primera opcion/, "Primera opción", "bien", 1],
  [/no activar/, "Restricción", "alerta", 0],
  [/tarifario/, "Revisar tarifario", "info", 0],
  [/estudiante/, "Estudiante de Derecho", "info", 0],
  [/abogad/, "Abogado(a)", "info", 0]
]
export type Tono = "alerta" | "bien" | "info"
export const etiquetas = (p: PersonaDirectorio) => {
  const nota = normalizar(p.nota)
  return REGLAS.filter(([re]) => re.test(nota)).map(([, texto, tono, prioridad]) => ({ texto, tono, prioridad }))
}
export const prioridad = (p: PersonaDirectorio) => {
  if (p.esMensajero) return 0
  const pr = etiquetas(p).map(e => e.prioridad)
  return pr.includes(3) ? 3 : pr.includes(1) ? 1 : 2
}
export const ordenarPersonas = (a: PersonaDirectorio, b: PersonaDirectorio) =>
  prioridad(a) - prioridad(b) || a.nombre.localeCompare(b.nombre, "es")

// ── Distancia aproximada por carretera: línea recta × 1,4 a 45 km/h (como el HTML de Torre sin servicio
// de rutas). Para la ruta exacta, el enlace a Google Maps ──
const enLinea = (a: MunicipioDirectorio, b: MunicipioDirectorio) => {
  const r = (x: number) => x * Math.PI / 180
  const h = Math.sin(r(b.latitud! - a.latitud!) / 2) ** 2 + Math.cos(r(a.latitud!)) * Math.cos(r(b.latitud!)) * Math.sin(r(b.longitud! - a.longitud!) / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}
export const MINUTOS_DESPLAZAMIENTO = 90
export const distancia = (desde: MunicipioDirectorio | undefined, hasta: MunicipioDirectorio | undefined) => {
  if (!desde || !hasta || desde.latitud == null || hasta.latitud == null || desde.longitud == null || hasta.longitud == null) return null
  if (desde.id === hasta.id) return { km: 0, minutos: 0 }
  const km = enLinea(desde, hasta) * 1.4
  return { km, minutos: km / 45 * 60 }
}
export const textoDistancia = (d: { km: number, minutos: number }) => {
  const m = Math.max(5, Math.round(d.minutos / 5) * 5)
  const tiempo = m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}`
  return `aprox. ${Math.max(1, Math.round(d.km))} km · ${tiempo}`
}
export const enlaceRuta = (desde: MunicipioDirectorio, hasta: MunicipioDirectorio) =>
  `https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=${encodeURIComponent(`${desde.nombre}, ${desde.departamento}, Colombia`)}&destination=${encodeURIComponent(`${hasta.nombre}, ${hasta.departamento}, Colombia`)}`

// ── Cumpleaños ──
// Días que faltan para el próximo cumpleaños (0 = hoy). El 29 de febrero se celebra el 28 en años no bisiestos
export const diasParaCumple = (p: PersonaDirectorio, hoy: Date) => {
  if (!p.cumpleDia || !p.cumpleMes) return null
  const base = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  const fecha = (anio: number) => {
    const bisiesto = anio % 4 === 0 && (anio % 100 !== 0 || anio % 400 === 0)
    return new Date(anio, p.cumpleMes! - 1, p.cumpleMes === 2 && p.cumpleDia === 29 && !bisiesto ? 28 : p.cumpleDia!)
  }
  let f = fecha(base.getFullYear())
  if (f < base) f = fecha(base.getFullYear() + 1)
  return Math.round((f.getTime() - base.getTime()) / 864e5)
}
