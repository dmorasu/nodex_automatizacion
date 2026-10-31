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

// Buscador de municipios (Trámites y la ciudad del cliente en los anticipos de Gastos).
// La tabla Municipios quedó cargada dos veces (una copia sin regional y otra con regional).
// Mientras se unifican (scripts/unificarMunicipios.ts), cada municipio sale una sola vez:
// la copia con menor id, que es la que usa la mayoría de trámites.
export const buscarMunicipios = (busqueda: string, limite: number) => db.query(`
  SELECT * FROM (
    SELECT DISTINCT ON (UPPER(TRIM(m."nombreMunicipio")), UPPER(TRIM(m.departamento)))
      m.id, m."nombreMunicipio", m.departamento,
      -- La regional puede estar solo en la otra copia
      COALESCE(m.regional, (
        SELECT d.regional FROM "Municipios" d
        WHERE UPPER(TRIM(d."nombreMunicipio")) = UPPER(TRIM(m."nombreMunicipio"))
          AND UPPER(TRIM(d.departamento)) = UPPER(TRIM(m.departamento))
          AND d.regional IS NOT NULL
        LIMIT 1
      )) AS regional,
      m.responsable, m."analistaId", m.latitud, m.longitud
    FROM "Municipios" m
    WHERE m."nombreMunicipio" ILIKE :contiene
    ORDER BY UPPER(TRIM(m."nombreMunicipio")), UPPER(TRIM(m.departamento)), m.id
  ) unicos
  -- Primero los que empiezan por el texto buscado
  ORDER BY ("nombreMunicipio" ILIKE :empieza) DESC, "nombreMunicipio", departamento
  LIMIT :limite
`, {
  type: QueryTypes.SELECT,
  replacements: { contiene: `%${busqueda}%`, empieza: `${busqueda}%`, limite }
})
