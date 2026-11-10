// Prueba solo de códigos de barras con zxing-wasm (ZXing C++) sobre las fotos.
const fs = require('fs'), path = require('path'), puppeteer = require('puppeteer-core')
const DIR = __dirname
const man = JSON.parse(fs.readFileSync(path.join(DIR, 'manifiesto.json'), 'utf8')).filter(m => m.tipo !== 'application/pdf' && m.esperado)
const pagina = `<!doctype html><meta charset="utf-8"><script src="/node_modules/zxing-wasm/dist/iife/reader/index.js"></script>
<script>
ZXingWASM.prepareZXingModule({ overrides: { locateFile: (p) => '/node_modules/zxing-wasm/dist/reader/' + p }, fireImmediately: true })
async function leer(url) {
  const bmp = await createImageBitmap(await (await fetch(url)).blob())
  const out = new Set()
  for (const max of [0, 2000, 1200]) {
    const k = max ? Math.min(1, max / Math.max(bmp.width, bmp.height)) : 1
    const c = new OffscreenCanvas(Math.round(bmp.width * k), Math.round(bmp.height * k))
    const g = c.getContext('2d'); g.drawImage(bmp, 0, 0, c.width, c.height)
    const r = await ZXingWASM.readBarcodes(g.getImageData(0, 0, c.width, c.height), { formats: ['Code128', 'Code39', 'Code93', 'ITF', 'EAN-13', 'QRCode', 'DataMatrix', 'PDF417'], tryHarder: true, tryRotate: true, tryInvert: true, tryDownscale: true, maxNumberOfSymbols: 10 })
    r.forEach(x => out.add(x.format + '|' + x.text))
  }
  return [...out]
}
</script>`
fs.writeFileSync(path.join(DIR, 'barras.html'), pagina)
;(async () => {
  const srv = require('./servidor')(DIR); await new Promise(r => srv.listen(0, '127.0.0.1', r))
  const base = `http://127.0.0.1:${srv.address().port}`
  const browser = await puppeteer.launch({ executablePath: require('./servidor').rutaChrome(), headless: true, protocolTimeout: 600000 })
  const cola = [...man], salida = []
  const t0 = Date.now()
  await Promise.all(Array.from({ length: 4 }, async () => {
    const p = await browser.newPage(); await p.goto(base + '/barras.html'); await p.waitForFunction('window.ZXingWASM')
    for (let m; (m = cola.shift());) {
      let codigos = []
      try { codigos = await p.evaluate(u => leer(u), `/archivos/${m.archivo}`) } catch (e) { codigos = ['ERROR|' + e.message] }
      salida.push({ docId: m.docId, esperado: m.esperado.guia, transportadora: m.esperado.transportadora, codigos })
    }
  }))
  await browser.close(); srv.close()
  fs.writeFileSync(path.join(DIR, 'barras.json'), JSON.stringify(salida, null, 1))
  const dig = s => String(s || '').replace(/\D/g, '')
  let alguno = 0, contiene = 0
  const porT = {}
  for (const s of salida) {
    const t = s.transportadora || 'sin dato'; porT[t] ??= [0, 0, 0]; porT[t][2]++
    if (s.codigos.length) { alguno++; porT[t][0]++ }
    if (s.codigos.some(c => c.includes(dig(s.esperado)))) { contiene++; porT[t][1]++ }
  }
  console.log({ fotos: salida.length, conAlgunCodigo: alguno, conLaGuiaDigitada: contiene, minutos: ((Date.now() - t0) / 60000).toFixed(1) })
  console.table(Object.entries(porT).map(([t, [a, b, n]]) => ({ t, fotos: n, conCodigo: a, conGuia: b })))
  salida.slice(0, 12).forEach(s => console.log(s.docId, s.esperado, s.codigos.map(c => c.slice(0, 90))))
})().catch(e => { console.error(e); process.exit(1) })
