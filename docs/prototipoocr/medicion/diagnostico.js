const fs = require('fs'), path = require('path'), DIR = __dirname
const man = new Map(JSON.parse(fs.readFileSync(path.join(DIR, 'manifiesto.json'), 'utf8')).map(m => [m.docId, m]))
const res = fs.readFileSync(path.join(DIR, 'resultados.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
const dig = s => String(s || '').replace(/\D/g, '')
let conBarras = 0, fotos = 0, barrasBien = 0, errores = 0
const dest = [], fecha = [], sinLect = []
for (const r of res) {
  const m = man.get(r.docId); const e = m.esperado
  if (r.error) { errores++; continue }
  const esFoto = m.tipo !== 'application/pdf'
  if (esFoto) { fotos++; const b = (r.archivos || []).flatMap(a => a.barras || []); if (b.length) { conBarras++; if (b.some(x => x === dig(e.guia))) barrasBien++ } }
  const reg = (r.registros || [])[0]
  if (!reg || !reg.numeroGuia) { sinLect.push(`${m.docId} ${m.nombreOriginal} ${m.tipo} obs=${reg ? reg.observaciones.join('|') : JSON.stringify(r.errores)}`); continue }
  if (dest.length < 25 && e.destinatario) dest.push(`${m.tipo === 'application/pdf' ? 'PDF ' : 'FOTO'} leído «${reg.destinatario}» · digitado «${e.destinatario}»`)
  if (fecha.length < 20 && e.fecha) fecha.push(`${m.tipo === 'application/pdf' ? 'PDF ' : 'FOTO'} ${e.transportadora} leído ${reg.fechaProbableEntrega || '—'} · digitado ${e.fecha} · creada ${String(e.createdAt).slice(0, 10)}`)
}
console.log({ errores, fotos, fotosConBarras: conBarras, barrasCoincidenConDigitado: barrasBien })
console.log('\n== destinatario'); dest.forEach(x => console.log(' ', x))
console.log('\n== fecha'); fecha.forEach(x => console.log(' ', x))
console.log('\n== sin lectura (' + sinLect.length + ')'); sinLect.slice(0, 15).forEach(x => console.log(' ', x))
// Comparación global de fechas: diferencia digitado - leído
const difs = {}
for (const r of res) { const m = man.get(r.docId), reg = (r.registros || [])[0]; if (!reg || !reg.fechaProbableEntrega || !m.esperado.fecha) continue; const [d, mo, y] = reg.fechaProbableEntrega.split('/'); const k = Math.round((Date.parse(m.esperado.fecha) - Date.parse(`${y}-${mo}-${d}`)) / 864e5); const b = k === 0 ? '0' : Math.abs(k) <= 3 ? '±1-3' : Math.abs(k) <= 15 ? '±4-15' : 'más'; difs[b] = (difs[b] || 0) + 1 }
console.log('\n== días entre fecha digitada y leída', difs)
