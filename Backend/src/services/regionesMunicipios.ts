import { QueryTypes } from 'sequelize'
import { db } from '../config/db'

// Regiones = las regionales de los municipios (ANTIOQUIA, BOGOTÁ Y SABANA, CARIBE, CENTRO, SUR).
// Se leen de la tabla para que el tramitador y los municipios usen siempre la misma lista.
export const regionesDeMunicipios = async (): Promise<string[]> => {
  const filas = await db.query<{ regional: string }>(`
    SELECT DISTINCT TRIM(regional) AS regional FROM "Municipios"
    WHERE TRIM(COALESCE(regional, '')) <> ''
    ORDER BY 1
  `, { type: QueryTypes.SELECT })
  return filas.map(f => f.regional)
}
