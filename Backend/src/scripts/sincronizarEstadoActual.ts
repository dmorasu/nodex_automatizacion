import 'dotenv/config'
import { QueryTypes } from 'sequelize'
import { db } from '../config/db'

// =====================================
// SINCRONIZA EL ESTADO ACTUAL DE LOS TRÁMITES
// SolicitudTramites."estadoActualTramite" debe ser el último registro de EstadosTramites.
// El cargue de estados por Excel no lo actualizaba (corregido el 2026-10-03), así que puede
// haber trámites desfasados. Este script los iguala al último estado de su historial.
//
//   Revisar sin cambiar nada:  TS_NODE_TRANSPILE_ONLY=1 npx ts-node src/scripts/sincronizarEstadoActual.ts
//   Aplicar los cambios:       TS_NODE_TRANSPILE_ONLY=1 npx ts-node src/scripts/sincronizarEstadoActual.ts --aplicar
// =====================================

const APLICAR = process.argv.includes('--aplicar')

// Último estado del historial de cada trámite (los trámites sin historial no se tocan)
const ULTIMO_ESTADO = `
  SELECT s.id, s."estadoActualTramite" AS actual, u."estadoId" AS ultimo
  FROM "SolicitudTramites" s
  JOIN LATERAL (
    SELECT e."estadoId" FROM "EstadosTramites" e
    WHERE e."solicitudTramiteId" = s.id
    ORDER BY e."createdAt" DESC, e.id DESC
    LIMIT 1
  ) u ON true
  WHERE s."estadoActualTramite" IS DISTINCT FROM u."estadoId"
`

type Desfase = { id: number, actual: number | null, ultimo: number }

const main = async () => {
  await db.authenticate()

  const nombres = new Map(
    (await db.query<{ id: number, nombreEstado: string }>(`SELECT id, "nombreEstado" FROM "Estados"`, { type: QueryTypes.SELECT }))
      .map(e => [e.id, e.nombreEstado])
  )
  const nombre = (id: number | null) => (id === null ? 'sin estado' : nombres.get(id) ?? `estado ${id}`)

  const desfasados = await db.query<Desfase>(ULTIMO_ESTADO, { type: QueryTypes.SELECT })
  if (desfasados.length === 0) {
    console.log('Todos los trámites tienen su estado actual al día.')
    return
  }

  // Resumen: de qué estado a qué estado pasarían
  const cambios = new Map<string, number>()
  for (const d of desfasados) {
    const clave = `${nombre(d.actual)} → ${nombre(d.ultimo)}`
    cambios.set(clave, (cambios.get(clave) ?? 0) + 1)
  }
  console.log(`Trámites desfasados: ${desfasados.length}`)
  for (const [clave, cantidad] of [...cambios].sort((a, b) => b[1] - a[1])) console.log(`  ${clave}: ${cantidad}`)
  console.log(`  Ejemplos: ${desfasados.slice(0, 10).map(d => `#${d.id}`).join(', ')}`)

  if (!APLICAR) {
    console.log('\nNada se modificó. Ejecute con --aplicar para guardar los cambios.')
    return
  }

  const [, resultado] = await db.query(`
    UPDATE "SolicitudTramites" s
    SET "estadoActualTramite" = d.ultimo
    FROM (${ULTIMO_ESTADO}) d
    WHERE s.id = d.id
  `)
  console.log(`\nActualizados: ${(resultado as { rowCount?: number })?.rowCount ?? '?'}`)
}

main()
  .catch(error => {
    console.error('Error:', error.message)
    process.exitCode = 1
  })
  .finally(() => db.close())
