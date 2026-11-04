import { QueryTypes, type Transaction } from 'sequelize'
import { db } from '../config/db'
import { tituloMunicipio } from '../utils/tituloMunicipio'

// =====================================
// RESIDENCIA DEL TRAMITADOR (2026-11-04)
// El municipio de residencia (Directorio) es el único dato de dónde vive: la región del
// tramitador es la regional de ese municipio y la ciudad de la cuenta de cobro es su nombre.
// Antes se escribían aparte en Catálogos → Tramitadores (región, ciudad y residencia).
// La regional puede estar solo en la otra copia del municipio (tabla cargada dos veces).
// =====================================

const CONSULTA = `
  SELECT m.id, m."nombreMunicipio" AS nombre,
    TRIM(COALESCE(m.regional, (
      SELECT d.regional FROM "Municipios" d
      WHERE UPPER(TRIM(d."nombreMunicipio")) = UPPER(TRIM(m."nombreMunicipio"))
        AND UPPER(TRIM(d.departamento)) = UPPER(TRIM(m.departamento))
        AND TRIM(COALESCE(d.regional, '')) <> ''
      LIMIT 1
    ))) AS regional
  FROM "Municipios" m`

export type Residencia = { ciudad: string, regional: string | null }

export const residenciaDe = async (municipioId: number, transaction?: Transaction): Promise<Residencia | null> => {
  const [fila] = await db.query<{ nombre: string, regional: string | null }>(`${CONSULTA} WHERE m.id = :id`, {
    replacements: { id: municipioId }, type: QueryTypes.SELECT, transaction
  })
  return fila ? { ciudad: tituloMunicipio(fila.nombre), regional: fila.regional || null } : null
}

// Al arrancar: deja la región y la ciudad de cada tramitador iguales a las de su municipio de
// residencia (los que no lo tienen no se tocan). Idempotente: solo actualiza lo que difiere
export const sincronizarResidencias = async () => {
  const filas = await db.query<{ id: number, region: string | null, ciudad: string | null, nombre: string, regional: string | null }>(`
    SELECT t.id, t.region, t.ciudad, r.nombre, r.regional
    FROM "Tramitador" t
    JOIN (${CONSULTA}) r ON r.id = t."municipioResidenciaId"
  `, { type: QueryTypes.SELECT })
  let cambiados = 0
  for (const f of filas) {
    const ciudad = tituloMunicipio(f.nombre)
    const region = f.regional || f.region
    if (f.ciudad === ciudad && f.region === region) continue
    await db.query(`UPDATE "Tramitador" SET ciudad = :ciudad, region = :region WHERE id = :id`, { replacements: { id: f.id, ciudad, region } })
    cambiados++
  }
  return cambiados
}
