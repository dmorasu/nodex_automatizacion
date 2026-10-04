import Parametros from '../../models/gastos/parametros'
import { ClaveParametro } from './constantes'

// Devuelve el valor numérico de un parámetro (ej: RETENCION_FUENTE → 0.11).
// Falla si no existe, para no calcular con un valor inventado.
export const obtenerParametro = async (clave: ClaveParametro): Promise<number> => {
  const parametro = await Parametros.findOne({ where: { clave } })

  if (!parametro) {
    throw new Error(`No existe el parámetro de gastos ${clave}`)
  }

  return Number(parametro.valor)
}
