// Medición OCR: descarga (solo lectura) las guías adjuntas en producción y arma el manifiesto
// con la logística digitada. Uso: node descargar.js <carpeta Backend> <carpeta destino>
const path = require('path')
const fs = require('fs')
const backend = process.argv[2]
const destino = process.argv[3]
const req = m => require(path.join(backend, 'node_modules', m))
req('dotenv').config({ path: path.join(backend, '.env'), quiet: true })
const { Client } = req('pg')
const { ShareServiceClient } = req('@azure/storage-file-share')

;(async () => {
  fs.mkdirSync(path.join(destino, 'archivos'), { recursive: true })
  const c = new Client({ host: process.env.DB_HOST, port: +process.env.DB_PORT, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: 'nodex', options: '-c default_transaction_read_only=on', statement_timeout: 30000 })
  await c.connect()
  const docs = (await c.query(`
    SELECT d.id, d."nombreOriginal", d."nombreArchivo", d."rutaArchivo", d."tipoArchivo", d."solicitudTramiteId"
    FROM "DocumentosSolicitud" d
    JOIN "Logistica" l ON l."solicitudTramiteId" = d."solicitudTramiteId" AND NULLIF(TRIM(l."numeroGuia"),'') IS NOT NULL
    WHERE d."nombreOriginal" ILIKE '%gu_a%'
    ORDER BY d.id`)).rows
  const logs = (await c.query(`
    SELECT l."solicitudTramiteId" tramite, TRIM(l."numeroGuia") guia, t."nombreTransportadora" transportadora,
      l."valorEnvio"::float valor, l."pagoContraEntrega" contra, l."fechaProgramacionLogistica"::text fecha,
      l.destinatario, l."createdAt"
    FROM "Logistica" l LEFT JOIN "Transportadora" t ON t.id = l."transportadoraId"`)).rows
  await c.end()
  const porTramite = new Map(logs.map(l => [Number(l.tramite), l]))

  const share = ShareServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING).getShareClient(process.env.AZURE_FILE_SHARE_NAME)
  const manifiesto = []
  let ok = 0, fallos = 0
  const cola = [...docs]
  const trabajar = async () => {
    for (let d; (d = cola.shift());) {
      const ext = d.tipoArchivo === 'application/pdf' ? '.pdf' : '.jpg'
      const local = `${d.id}${ext}`
      const dir = d.rutaArchivo.substring(0, d.rutaArchivo.lastIndexOf('/'))
      try {
        const destinoArchivo = path.join(destino, 'archivos', local)
        if (!fs.existsSync(destinoArchivo)) {
          const buf = await share.getDirectoryClient(dir).getFileClient(d.nombreArchivo).downloadToBuffer()
          fs.writeFileSync(destinoArchivo, buf)
        }
        // Trámites en el nombre: números de 4 a 5 dígitos (los consecutivos de hoy)
        const delNombre = [...new Set((d.nombreOriginal.match(/(?<!\d)\d{4,5}(?!\d)/g) || []).map(Number))].filter(n => porTramite.has(n) || n === d.solicitudTramiteId)
        manifiesto.push({
          docId: d.id, archivo: local, nombreOriginal: d.nombreOriginal, tipo: d.tipoArchivo,
          tramite: d.solicitudTramiteId, tramitesNombre: delNombre,
          esperado: porTramite.get(Number(d.solicitudTramiteId)),
          otros: delNombre.filter(n => n !== d.solicitudTramiteId).map(n => porTramite.get(n) || { tramite: n })
        })
        ok++
      } catch (e) { fallos++; console.log('Falló', d.id, d.nombreOriginal, e.message) }
      if ((ok + fallos) % 50 === 0) console.log(`${ok + fallos}/${docs.length}`)
    }
  }
  await Promise.all(Array.from({ length: 6 }, trabajar))
  manifiesto.sort((a, b) => a.docId - b.docId)
  fs.writeFileSync(path.join(destino, 'manifiesto.json'), JSON.stringify(manifiesto, null, 1))
  console.log(`Listo: ${ok} descargados, ${fallos} fallidos de ${docs.length}`)
})().catch(e => { console.error(e); process.exit(1) })
