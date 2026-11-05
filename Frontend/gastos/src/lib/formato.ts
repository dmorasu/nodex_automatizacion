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

// ISO → "30/09/2026 2:05 p. m." en hora de Colombia (UTC−5 todo el año, sin horario de verano).
// Sin toLocale*: da el mismo texto en el servidor y en el navegador (sirve en componentes de cliente)
export const formatoFechaHoraColombia = (iso: string | null) => {
  if (!iso) return "—"
  const fecha = new Date(new Date(iso).getTime() - 5 * 60 * 60 * 1000)
  const dos = (n: number) => String(n).padStart(2, "0")
  const horas = fecha.getUTCHours()
  return `${dos(fecha.getUTCDate())}/${dos(fecha.getUTCMonth() + 1)}/${fecha.getUTCFullYear()} ` +
    `${horas % 12 || 12}:${dos(fecha.getUTCMinutes())} ${horas < 12 ? "a. m." : "p. m."}`
}

// 0.11 → "11 %"
export const formatoPorcentaje = (valor: string | number) =>
  `${Number((Number(valor) * 100).toFixed(4))} %`

export const formatoTamano = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.ceil(bytes / 1024)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`

// IVA incluido en el valor que consigna el cliente (solicitudes de factura). Total = lo consignado
// o recibido; IVA = total × t / (1 + t); base = total − IVA. En centavos, igual que el backend
export const ivaIncluido = (totalCentavos: number, tarifa: number) => {
  const iva = Math.round(totalCentavos * tarifa / (1 + tarifa))
  return { base: totalCentavos - iva, iva, total: totalCentavos }
}
