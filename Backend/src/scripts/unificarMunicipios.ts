import 'dotenv/config'
import { QueryTypes } from 'sequelize'
import { db } from '../config/db'

// =====================================
// UNIFICA LOS MUNICIPIOS DUPLICADOS
// La tabla Municipios se cargó dos veces: cada municipio tiene una copia sin "regional" y
// otra con "regional", y hay trámites apuntando a las dos. Este script deja una sola:
//   · se queda la de menor id (la que usa la mayoría de trámites)
//   · le copia la regional, la ubicación y el analista si le faltan
//   · pasa los trámites de la copia a la que se queda y borra la copia
// Todo en una transacción: si algo falla no cambia nada.
//
//   Revisar sin cambiar nada:  TS_NODE_TRANSPILE_ONLY=1 npx ts-node src/scripts/unificarMunicipios.ts
//   Aplicar los cambios:       TS_NODE_TRANSPILE_ONLY=1 npx ts-node src/scripts/unificarMunicipios.ts --aplicar
// =====================================

const APLICAR = process.argv.includes('--aplicar')

// Parejas (o grupos) del mismo municipio y departamento: la que se queda y las copias
const GRUPOS = `
  WITH grupos AS (
    SELECT id,
      FIRST_VALUE(id) OVER (PARTITION BY UPPER(TRIM("nombreMunicipio")), UPPER(TRIM(departamento)) ORDER BY id) AS queda
    FROM "Municipios"
  )
  SELECT g.id AS copia, g.queda FROM grupos g WHERE g.id <> g.queda
`

type Grupo = { copia: number, queda: number }

const main = async () => {
  await db.authenticate()

  const copias = await db.query<Grupo>(GRUPOS, { type: QueryTypes.SELECT })
  if (copias.length === 0) {
    console.log('No hay municipios duplicados.')
    return
  }

  const [{ tramites }] = await db.query<{ tramites: string }>(`
    SELECT COUNT(*) AS tramites FROM "SolicitudTramites" WHERE "municipiosId" IN (:ids)
  `, { type: QueryTypes.SELECT, replacements: { ids: copias.map(c => c.copia) } })

  const [{ total }] = await db.query<{ total: string }>(`SELECT COUNT(*) AS total FROM "Municipios"`, { type: QueryTypes.SELECT })
  console.log(`Municipios: ${total} · copias a eliminar: ${copias.length} · quedarían: ${Number(total) - copias.length}`)
  console.log(`Trámites que pasan a la copia que se queda: ${tramites}`)

  if (!APLICAR) {
    console.log('\nNada se modificó. Ejecute con --aplicar para unificar.')
    return
  }

  await db.transaction(async transaction => {
    // 1. Completar la que se queda con lo que solo tenga la copia
    await db.query(`
      UPDATE "Municipios" m SET
        regional = COALESCE(m.regional, c.regional),
        latitud = COALESCE(m.latitud, c.latitud),
        longitud = COALESCE(m.longitud, c.longitud),
        responsable = COALESCE(m.responsable, c.responsable),
        "analistaId" = COALESCE(m."analistaId", c."analistaId"),
        "updatedAt" = NOW()
      FROM (${GRUPOS}) g
      JOIN "Municipios" c ON c.id = g.copia
      WHERE m.id = g.queda
    `, { transaction })

    // 2. Pasar los trámites de la copia a la que se queda
    const [, movidos] = await db.query(`
      UPDATE "SolicitudTramites" s SET "municipiosId" = g.queda
      FROM (${GRUPOS}) g
      WHERE s."municipiosId" = g.copia
    `, { transaction })

    // 3. Borrar las copias (ya no las usa ningún trámite)
    const [, borrados] = await db.query(`
      DELETE FROM "Municipios" m USING (${GRUPOS}) g WHERE m.id = g.copia
    `, { transaction })

    console.log(`\nTrámites movidos: ${(movidos as { rowCount?: number })?.rowCount ?? '?'} · copias borradas: ${(borrados as { rowCount?: number })?.rowCount ?? '?'}`)
  })
}

main()
  .catch(error => {
    console.error('Error (no se cambió nada):', error.message)
    process.exitCode = 1
  })
  .finally(() => db.close())
