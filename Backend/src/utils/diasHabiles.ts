// =====================================
// DÍAS HÁBILES EN COLOMBIA
// Sin sábados, domingos ni festivos. Los festivos se calculan para cualquier año: fijos, los que
// la Ley Emiliani (Ley 51 de 1983) pasa al lunes siguiente y los que dependen de la Pascua.
// Fechas como texto YYYY-MM-DD (días de Colombia).
// =====================================

const DIA_MS = 24 * 60 * 60 * 1000

const texto = (fecha: Date) => fecha.toISOString().slice(0, 10)
const sumar = (fecha: Date, dias: number) => new Date(fecha.getTime() + dias * DIA_MS)
const utc = (anio: number, mes: number, dia: number) => new Date(Date.UTC(anio, mes - 1, dia))

// Domingo de Pascua (algoritmo anónimo gregoriano)
const pascua = (anio: number) => {
  const a = anio % 19, b = Math.floor(anio / 100), c = anio % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1
  return utc(anio, mes, dia)
}

// Al lunes siguiente si no cae en lunes (Ley Emiliani)
const alLunes = (fecha: Date) => sumar(fecha, (8 - fecha.getUTCDay()) % 7)

const cache = new Map<number, Set<string>>()

export const festivosColombia = (anio: number): Set<string> => {
  const guardados = cache.get(anio)
  if (guardados) return guardados

  const p = pascua(anio)
  const festivos = new Set([
    // Fijos
    ...[[1, 1], [5, 1], [7, 20], [8, 7], [12, 8], [12, 25]].map(([m, d]) => utc(anio, m, d)),
    // Ley Emiliani: Reyes, San José, San Pedro y San Pablo, Asunción, Día de la Raza,
    // Todos los Santos, Independencia de Cartagena
    ...[[1, 6], [3, 19], [6, 29], [8, 15], [10, 12], [11, 1], [11, 11]].map(([m, d]) => alLunes(utc(anio, m, d))),
    // Según la Pascua: Jueves y Viernes Santo; Ascensión, Corpus Christi y Sagrado Corazón (ya en lunes)
    sumar(p, -3), sumar(p, -2), sumar(p, 43), sumar(p, 64), sumar(p, 71)
  ].map(texto))

  cache.set(anio, festivos)
  return festivos
}

export const esDiaHabil = (fecha: string) => {
  const dia = new Date(`${fecha}T00:00:00Z`)
  const semana = dia.getUTCDay()
  return semana !== 0 && semana !== 6 && !festivosColombia(dia.getUTCFullYear()).has(fecha)
}

// El n-ésimo día hábil después de una fecha (sin contarla)
export const sumarDiasHabiles = (fecha: string, dias: number) => {
  let actual = new Date(`${fecha}T00:00:00Z`)
  let faltan = dias
  while (faltan > 0) {
    actual = sumar(actual, 1)
    if (esDiaHabil(texto(actual))) faltan--
  }
  return texto(actual)
}
