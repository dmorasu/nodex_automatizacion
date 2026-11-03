const moneda = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
})

// "150000.00" → "$ 150.000"
export const formatoMoneda = (valor: string | number | null | undefined) =>
  valor === null || valor === undefined || valor === "" ? "—" : moneda.format(Number(valor))

// ISO → "30 sept 2026, 2:05 p. m."
export const formatoFechaHora = (iso: string) =>
  new Date(iso).toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" })

// ISO o "2026-09-30" → "30/09/2026"
export const formatoFecha = (fecha: string | null | undefined) => {
  if (!fecha) return "—"
  const [anio, mes, dia] = fecha.slice(0, 10).split("-")
  return `${dia}/${mes}/${anio}`
}

// Hora de la cita: "10:00:00" y "11:00:00" → "10:00 – 11:00" (la hora final es opcional)
export const formatoHoraCita = (inicio: string | null | undefined, fin: string | null | undefined) =>
  inicio ? `${inicio.slice(0, 5)}${fin ? ` – ${fin.slice(0, 5)}` : ""}` : ""

export const formatoTamano = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
