import 'dotenv/config'
import { QueryTypes } from 'sequelize'
import { db } from '../config/db'
import { facturasDelTramitePorPasar, pasarFacturasDelTramite, type FacturaPorPasar } from '../services/tramitadores/soportesTramitador'

// =====================================
// PASA A SU GASTO LAS FACTURAS QUE EL TRAMITADOR SUBIÓ EN EL TRÁMITE ANTES DEL PAGO
// Hasta el 2026-11-11, una factura subida en el trámite cuando su gasto aún no estaba Pagado
// quedaba solo en el trámite y no llegaba a Legalización. Desde ese día pasa sola al pagar el
// gasto; este script recupera los gastos ya pagados (las mismas reglas: trámite con un solo
// gasto, sin factura registrada ni factura del tramitador). Una segunda pasada no repite.
//
//   Revisar sin cambiar nada:  node dist/scripts/pasarFacturasDelTramiteAGastos.js
//   Aplicar:                   node dist/scripts/pasarFacturasDelTramiteAGastos.js --aplicar
// =====================================

const APLICAR = process.argv.includes('--aplicar')

const main = async () => {
  await db.authenticate()

  // Gastos pagados cuyo trámite tiene facturas subidas por un tramitador
  const filas = await db.query<{ id: number }>(`
    SELECT DISTINCT g.id
    FROM gastos_solicitudes g
    JOIN gastos_estados_gasto e ON e.id = g.estado_id AND e.codigo = 'PAGADO'
    JOIN "DocumentosSolicitud" d ON d."solicitudTramiteId" = g.solicitud_tramite_id
      AND d."tipoDocumento" = 'FACTURA' AND d."tramitadorId" IS NOT NULL
    ORDER BY g.id`, { type: QueryTypes.SELECT })

  const pendientes: FacturaPorPasar[] = []
  for (const { id } of filas) {
    const porPasar = await facturasDelTramitePorPasar(Number(id))
    if (porPasar) pendientes.push(porPasar)
  }

  console.log(`Gastos pagados con facturas del tramitador en su trámite: ${filas.length}; por pasar: ${pendientes.length}`)
  for (const p of pendientes) {
    console.log(`  ${p.codigoGasto} · trámite #${p.solicitudTramiteId} · ${p.documentos.map(d => `${d.nombre} (doc ${d.id})`).join(', ')}`)
  }

  if (!APLICAR) {
    console.log('\nNada se modificó. Ejecute con --aplicar para pasarlas.')
    return
  }

  let pasadas = 0
  for (const p of pendientes) {
    try {
      await pasarFacturasDelTramite(p.gastoId)
      pasadas++
    } catch (error) {
      console.error(`  ✗ ${p.codigoGasto}: ${(error as Error).message}`)
    }
  }
  console.log(`\nPasadas: ${pasadas} de ${pendientes.length}. Quedan en Legalización → Soportes de tramitadores.`)
}

main()
  .catch(error => console.error(error))
  .finally(() => process.exit(0))
