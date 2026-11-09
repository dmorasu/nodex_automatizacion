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

// Solicitudes de factura (fórmula de Contabilidad, 2026-11-09): todo sale del valor consignado.
//   base = consignado ÷ (1 + IVA − retención); IVA y retención sobre la base
//   total de la factura = base + IVA; valor a pagar = base + IVA − retención = consignado
// En centavos, igual que el backend (liquidarFactura en services/gastos/anticipos.ts)
export const liquidarFactura = (consignadoCentavos: number, tarifaIva: number, tarifaRetencion = 0) => {
  const baseExacta = consignadoCentavos / (1 + tarifaIva - tarifaRetencion)
  const base = Math.round(baseExacta)
  const iva = Math.round(baseExacta * tarifaIva)
  const retencion = Math.round(baseExacta * tarifaRetencion)
  return { base, iva, retencion, totalFactura: base + iva, consignado: consignadoCentavos }
}

// Valores de una solicitud de factura ya registrada (en pesos): los guardados o, si es anterior y
// no los tiene, calculados sobre el consignado con su tarifa
export const valoresFactura = (s: {
  valorConsignado: string
  ivaPorcentaje?: string | null
  ivaValor?: string | null
  baseValor?: string | null
  retencionPorcentaje?: string | null
  retencionValor?: string | null
}) => {
  if (!s.ivaPorcentaje) return null
  const calculado = liquidarFactura(Math.round(Number(s.valorConsignado) * 100), Number(s.ivaPorcentaje), Number(s.retencionPorcentaje ?? 0))
  const base = s.baseValor ? Number(s.baseValor) : calculado.base / 100
  const iva = s.ivaValor ? Number(s.ivaValor) : calculado.iva / 100
  const retencion = s.retencionValor ? Number(s.retencionValor) : calculado.retencion / 100
  return {
    base, iva, retencion,
    tarifaIva: Number(s.ivaPorcentaje),
    tarifaRetencion: s.retencionPorcentaje ? Number(s.retencionPorcentaje) : 0,
    totalFactura: Math.round((base + iva) * 100) / 100,
    consignado: Number(s.valorConsignado)
  }
}
