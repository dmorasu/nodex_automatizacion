// Muestra el texto que extrae el motor para unos documentos. Uso: node texto.js <html> <docId...>
const fs = require('fs'), path = require('path'), puppeteer = require('puppeteer-core')
const DIR = __dirname, HTML = process.argv[2], ids = process.argv.slice(3).map(Number)
const man = new Map(JSON.parse(fs.readFileSync(path.join(DIR, 'manifiesto.json'), 'utf8')).map(m => [m.docId, m]))
;(async () => {
  const srv = require('./servidor')(DIR, { '/lector.html': HTML }); await new Promise(r => srv.listen(0, '127.0.0.1', r))
  const base = `http://127.0.0.1:${srv.address().port}`
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, protocolTimeout: 600000 })
  const p = await browser.newPage(); await p.goto(base + '/lector.html'); await p.waitForFunction('libs.ocr && libs.pdf', { timeout: 120000 })
  for (const id of ids) {
    const m = man.get(id)
    const r = await p.evaluate(async (u, n, t) => { const b = await (await fetch(u)).blob(); const o = await GuiaOCR.procesar([new File([b], n, { type: t })]); return { reg: o.registros[0], texto: o.archivos.map(a => a.texto).join('\n====\n') } }, `/archivos/${m.archivo}`, m.archivo, m.tipo)
    console.log(`\n######## ${id} ${m.nombreOriginal} · digitado ${JSON.stringify({ g: m.esperado.guia, t: m.esperado.transportadora, v: m.esperado.valor, f: m.esperado.fecha, d: m.esperado.destinatario })}`)
    console.log('LEÍDO', JSON.stringify(r.reg))
    console.log(r.texto.slice(0, 2500))
  }
  await browser.close(); srv.close()
})().catch(e => { console.error(e); process.exit(1) })
