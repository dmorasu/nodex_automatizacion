export const fechaColombia = (): string => {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(new Date())
}

export const formatearFecha = (fecha: Date | string): string => {
  const d = new Date(fecha)

  const dia = String(d.getUTCDate()).padStart(2, '0')
  const mes = String(d.getUTCMonth() + 1).padStart(2, '0')
  const anio = d.getUTCFullYear()

  return `${dia}/${mes}/${anio}`
}