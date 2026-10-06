import Holidays from "date-holidays"

const hd = new Holidays("CO") // Colombia

export function sumarDiasHabilesColombia(
  fechaInicial: Date,
  diasHabiles: number
): Date {

  const fecha = new Date(fechaInicial)
  let contador = 0

  while (contador < diasHabiles) {
    fecha.setDate(fecha.getDate() + 1)

    const diaSemana = fecha.getDay() // 0 domingo, 6 sábado
    const esFinSemana = diaSemana === 0 || diaSemana === 6
    const esFestivo = hd.isHoliday(fecha)

    if (!esFinSemana && !esFestivo) {
      contador++
    }
  }

  return fecha
}


export function toDateOnly(date: Date) {
  return date.toISOString().split("T")[0]
}
