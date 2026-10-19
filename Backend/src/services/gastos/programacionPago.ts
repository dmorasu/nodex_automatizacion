import { esDiaHabil, sumarDiasHabiles } from '../../utils/diasHabiles'
import { PARAMETROS } from './constantes'
import { obtenerParametro } from './parametros'

// =====================================
// CUÁNDO SE PROGRAMA PARA PAGO UN GASTO NUEVO
// Norma de Tesorería: lo que se crea en un día hábil antes de la hora de corte (parámetro
// HORA_CORTE_PROGRAMACION, 9:00 a. m. por defecto, se cambia en Catálogos → Programación de pagos)
// se programa ese mismo día; lo que se crea después, o en un día no hábil, el siguiente día hábil.
// =====================================

export type ProgramacionPago = {
  // true: se programa el siguiente día hábil (se le avisa a quien lo creó)
  siguienteDiaHabil: boolean
  // Por qué pasa al siguiente día hábil: se creó después de la hora de corte o en un día no hábil
  motivo: 'HORA_CORTE' | 'DIA_NO_HABIL' | null
  fecha: string       // YYYY-MM-DD, día de Colombia
  horaCorte: string   // "09:00"
}

// 9.5 → "09:30"
export const horaComoTexto = (horas: number) => {
  const minutos = Math.round(horas * 60)
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`
}

export const programacionDelGasto = async (creado = new Date()): Promise<ProgramacionPago> => {
  const corte = await obtenerParametro(PARAMETROS.HORA_CORTE_PROGRAMACION)

  // Fecha y hora en Colombia
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(creado).map(p => [p.type, p.value])
  )
  const hoy = `${partes.year}-${partes.month}-${partes.day}`
  const hora = Number(partes.hour) + Number(partes.minute) / 60

  const motivo = !esDiaHabil(hoy) ? 'DIA_NO_HABIL' : hora >= corte ? 'HORA_CORTE' : null
  return { siguienteDiaHabil: motivo !== null, motivo, fecha: motivo ? sumarDiasHabiles(hoy, 1) : hoy, horaCorte: horaComoTexto(corte) }
}
