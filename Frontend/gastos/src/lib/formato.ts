const moneda = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
})

// "150000.00" → "$ 150.000"
export const formatoMoneda = (valor: string | number | null | undefined) =>
  valor === null || valor === undefined || valor === "" ? "—" : moneda.format(Number(valor))

const monedaCorta = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  notation: "compact",
  maximumFractionDigits: 1
})

// 1500000 → "$1,5 M" (ejes de las gráficas)
export const formatoMonedaCorto = (valor: number) => monedaCorta.format(valor)

// ISO → "30/09/2026 14:05"
export const formatoFechaHora = (iso: string) =>
  new Date(iso).toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  })

// ISO o "2026-09-30" → "30/09/2026"
export const formatoFecha = (fecha: string | null) => {
  if (!fecha) return "—"
  // Las fechas sin hora (DATEONLY) se leen tal cual, sin zona horaria
  const [anio, mes, dia] = fecha.slice(0, 10).split("-")
  return `${dia}/${mes}/${anio}`
}

// 0.11 → "11 %"
export const formatoPorcentaje = (valor: string | number) =>
  `${Number((Number(valor) * 100).toFixed(4))} %`

export const formatoTamano = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.ceil(bytes / 1024)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`
