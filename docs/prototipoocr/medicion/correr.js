// Corre el motor del prototipo (sin cambios) sobre las guías descargadas, en Chrome sin ventana.
// Uso: node correr.js <html del prototipo> [paginas=4] [limite]
// Escribe resultados.jsonl (se puede reanudar: salta los ya leídos).
const http = require('http')
const fs = require('fs')
const path = require('path')
const puppeteer = require('puppeteer-core')

const DIR = __dirname
const HTML = process.argv[2]
const PAGINAS = Number(process.argv[3] || 4)
const LIMITE = Number(process.argv[4] || 0)
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'

const manifiesto = JSON.parse(fs.readFileSync(path.join(DIR, 'manifiesto.json'), 'utf8'))
const salida = path.join(DIR, process.env.SALIDA || 'resultados.jsonl')
const SOLO = process.env.SOLO ? new Set(process.env.SOLO.split(',').map(Number)) : null
const hechos = new Set(fs.existsSync(salida) ? fs.readFileSync(salida, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l).docId) : [])
let pendientes = manifiesto.filter(m => !hechos.has(m.docId) && (!SOLO || SOLO.has(m.docId)))
if (LIMITE) pendientes = pendientes.slice(0, LIMITE)

const servidor = require('./servidor')(DIR, { '/lector.html': HTML })

;(async () => {
  await new Promise(r => servidor.listen(0, '127.0.0.1', r))
  const base = `http://127.0.0.1:${servidor.address().port}`
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, protocolTimeout: 600000, args: ['--no-first-run'] })
  console.log(`Pendientes: ${pendientes.length} · páginas en paralelo: ${PAGINAS}`)
  const inicio = Date.now()
  let n = 0
  const trabajar = async (i) => {
    const page = await browser.newPage()
    page.on('pageerror', e => console.log(`[p${i}] error de página`, e.message))
    await page.goto(`${base}/lector.html`, { waitUntil: 'load' })
    await page.waitForFunction('typeof libs !== "undefined" && libs.ocr && libs.pdf', { timeout: 120000 })
    for (let m; (m = pendientes.shift());) {
      const t0 = Date.now()
      let r
      try {
        r = await page.evaluate(async (url, nombre, tipo) => {
          const blob = await (await fetch(url)).blob()
          const file = new File([blob], nombre, { type: tipo })
          const out = await Promise.race([
            GuiaOCR.procesar([file]),
            new Promise((_, rej) => setTimeout(() => rej(new Error('tiempo agotado (180 s)')), 180000))
          ])
          return { registros: out.registros, errores: out.errores, archivos: out.archivos.map(a => ({ transportadora: a.transportadora, giro: a.giro, barras: a.barras })) }
        }, `${base}/archivos/${m.archivo}`, m.archivo, m.tipo)
      } catch (e) {
        r = { error: e.message }
        // Página posiblemente dañada: se recarga
        try { await page.goto(`${base}/lector.html`, { waitUntil: 'load' }); await page.waitForFunction('libs.ocr && libs.pdf', { timeout: 120000 }) } catch {}
      }
      fs.appendFileSync(salida, JSON.stringify({ docId: m.docId, segundos: (Date.now() - t0) / 1000, ...r }) + '\n')
      n++
      if (n % 10 === 0) {
        const min = (Date.now() - inicio) / 60000
        console.log(`${n} leídas · ${min.toFixed(1)} min · ${(min * 60 / n).toFixed(1)} s/guía efectivo`)
      }
    }
    await page.close()
  }
  await Promise.all(Array.from({ length: PAGINAS }, (_, i) => trabajar(i)))
  await browser.close()
  servidor.close()
  console.log(`Fin: ${n} guías en ${((Date.now() - inicio) / 60000).toFixed(1)} min`)
})().catch(e => { console.error(e); process.exit(1) })
