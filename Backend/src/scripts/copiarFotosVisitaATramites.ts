import 'dotenv/config'
import { Op } from 'sequelize'
import { db } from '../config/db'
import ParadaMensajeria from '../models/mensajeria/paradaMensajeria'
import DocumentoSolicitud from '../models/documentosSolicitud'
import { obtenerArchivo } from '../services/azureFileStorage'
import { conPrefijo, TIPOS_DOCUMENTO_TRAMITE } from '../services/tramitadores/nombresDocumento'
import { nombreFotoVisita, registrarFotoVisita } from '../services/tramitadores/documentosTramite'

// =====================================
// COPIA A LOS DOCUMENTOS DEL TRÁMITE LAS FOTOS DE VISITA ANTERIORES
// Hasta el 2026-11-04 la foto que el mensajero tomaba al confirmar la visita en su ruta solo
// quedaba en la parada (se veía en la tarjeta de la ruta de ese día). Desde entonces también va
// a los documentos del trámite; este script pasa las que ya existían. Una segunda pasada no
// repite: salta las paradas cuyo trámite ya tiene un documento con el mismo nombre.
//
//   Revisar sin cambiar nada:  node dist/scripts/copiarFotosVisitaATramites.js
//   Aplicar:                   node dist/scripts/copiarFotosVisitaATramites.js --aplicar
//   (en desarrollo: TS_NODE_TRANSPILE_ONLY=1 npx ts-node src/scripts/copiarFotosVisitaATramites.ts)
// =====================================

const APLICAR = process.argv.includes('--aplicar')

const main = async () => {
  await db.authenticate()

  const paradas = await ParadaMensajeria.findAll({
    where: { fotoRuta: { [Op.ne]: null }, fotoNombre: { [Op.ne]: null } },
    order: [['fecha', 'ASC'], ['id', 'ASC']]
  })

  const pendientes: ParadaMensajeria[] = []
  for (const parada of paradas) {
    const nombre = conPrefijo(TIPOS_DOCUMENTO_TRAMITE.SOPORTE, nombreFotoVisita(parada.fecha, parada.fotoTipo))
    const yaEsta = await DocumentoSolicitud.count({
      where: { solicitudTramiteId: parada.solicitudTramiteId, tramitadorId: parada.tramitadorId, nombreOriginal: nombre }
    })
    if (!yaEsta) pendientes.push(parada)
  }

  console.log(`Paradas con foto: ${paradas.length}; ya en los documentos del trámite: ${paradas.length - pendientes.length}; por copiar: ${pendientes.length}`)
  for (const p of pendientes) console.log(`  parada ${p.id} · trámite #${p.solicitudTramiteId} · ${p.fecha}`)

  if (!APLICAR) {
    console.log('\nNada se modificó. Ejecute con --aplicar para copiarlas.')
    return
  }

  let copiadas = 0
  for (const p of pendientes) {
    try {
      const contenido = await obtenerArchivo(p.fotoRuta!, p.fotoNombre!)
      await registrarFotoVisita(p.solicitudTramiteId, p.tramitadorId, p.fecha, contenido, p.fotoTipo)
      copiadas++
    } catch (error) {
      console.error(`  ✗ parada ${p.id} (trámite #${p.solicitudTramiteId}): ${(error as Error).message}`)
    }
  }
  console.log(`\nCopiadas: ${copiadas} de ${pendientes.length}`)
}

main()
  .catch(error => {
    console.error('Error:', error.message)
    process.exitCode = 1
  })
  // El cliente de Azure deja el proceso vivo: se cierra a mano al terminar
  .finally(() => db.close().finally(() => process.exit()))
