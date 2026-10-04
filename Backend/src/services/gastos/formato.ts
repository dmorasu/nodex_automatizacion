const moneda = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
})

// 150000 → "$ 150.000"  (mensajes de error y correos)
export const formatoMoneda = (valor: number | string | null | undefined) =>
  valor === null || valor === undefined ? '—' : moneda.format(Number(valor))

// "2026-09-30" → "30/09/2026"
export const formatoFecha = (fecha: string | null | undefined) => {
  if (!fecha) return '—'
  const [anio, mes, dia] = fecha.slice(0, 10).split('-')
  return `${dia}/${mes}/${anio}`
}
