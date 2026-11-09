// Compara lo que leyó el prototipo con la logística digitada en Nodex.
// Uso: node evaluar.js  (lee manifiesto.json y resultados.jsonl de esta carpeta)
const fs = require('fs')
const path = require('path')
const DIR = __dirname
const man = new Map(JSON.parse(fs.readFileSync(path.join(DIR, 'manifiesto.json'), 'utf8')).map(m => [m.docId, m]))
const ARCHIVO = process.argv[2] || 'resultados.jsonl'
const res = fs.readFileSync(path.join(DIR, ARCHIVO), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))

const sinTildes = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
const marca = s => { const t = sinTildes(s); return /ENVIA|COLVANES/.test(t) ? 'Envía' : /SERVIENTREGA/.test(t) ? 'Servientrega' : /INTER/.test(t) ? 'Inter' : /COORDINADORA/.test(t) ? 'Coordinadora' : /TCC/.test(t) ? 'TCC' : t ? 'Otra' : '' }
const digitos = s => String(s || '').replace(/\D/g, '')
function lev(a, b) { const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length] }
const nombre = s => sinTildes(s).replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim()
const parecido = (a, b) => { a = nombre(a); b = nombre(b); if (!a || !b) return false; if (a.includes(b) || b.includes(a)) return true; return 1 - lev(a, b) / Math.max(a.length, b.length) >= 0.8 }
const fechaISO = ddmmaaaa => { const m = String(ddmmaaaa || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : '' }
const dias = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 864e5)

const grupos = {}
const g = k => (grupos[k] ??= { docs: 0, rastreo: 0, sinLectura: 0, guia: [0, 0], guiaOkMal: 0, transp: [0, 0], valor: [0, 0], valorReparto: 0, fecha: [0, 0], fechaCerca: 0, dest: [0, 0], ok: 0, okTodo: 0, seg: [] })
const ejemplos = { guiaMal: [], valorMal: [], okMal: [] }

for (const r of res) {
  const m = man.get(r.docId); if (!m || !m.esperado) continue
  const e = m.esperado
  const tipo = m.tipo === 'application/pdf' ? 'PDF' : 'Foto/imagen'
  const claves = ['TOTAL', `Transp: ${marca(e.transportadora) || 'sin dato'}`, `Tipo: ${tipo}`, `${marca(e.transportadora) || 'sin dato'} · ${tipo}`]
  // Se toma el registro cuyo número coincide; si no, el primero
  const regs = r.registros || []
  const reg = regs.find(x => digitos(x.numeroGuia) === digitos(e.guia)) || regs[0]
  for (const k of claves) {
    const s = g(k); s.docs++; if (r.segundos) s.seg.push(r.segundos)
    if (reg && reg.esRastreo) { s.rastreo++; continue }
    if (!reg || !reg.numeroGuia) { s.sinLectura++; continue }
    const guiaBien = digitos(reg.numeroGuia) === digitos(e.guia)
    s.guia[1]++; if (guiaBien) s.guia[0]++
    if (reg.estado === 'OK') { s.ok++; if (!guiaBien) s.guiaOkMal++ }
    if (e.transportadora) { s.transp[1]++; if (marca(reg.transportadora) === marca(e.transportadora)) s.transp[0]++ }
    let valorBien = null
    if (e.valor > 0 && !e.contra) {
      s.valor[1]++
      const n = Math.max(1, m.tramitesNombre.length)
      const total = reg.valorEnvio
      if (total === e.valor) { s.valor[0]++; valorBien = true }
      else if (total && n > 1 && Math.abs(total / n - e.valor) <= 1) { s.valor[0]++; s.valorReparto++; valorBien = true }
      else valorBien = false
    }
    let fechaBien = null
    if (e.fecha) { s.fecha[1]++; const f = fechaISO(reg.fechaProbableEntrega); fechaBien = f === e.fecha; if (fechaBien) s.fecha[0]++; else if (f && Math.abs(dias(f, e.fecha)) <= 3) s.fechaCerca++ }
    let destBien = null
    if (e.destinatario) { s.dest[1]++; destBien = parecido(reg.destinatario, e.destinatario); if (destBien) s.dest[0]++ }
    if (guiaBien && valorBien !== false && fechaBien !== false && destBien !== false && marca(reg.transportadora) === marca(e.transportadora)) s.okTodo++
    if (k === 'TOTAL') {
      if (!guiaBien && ejemplos.guiaMal.length < 15) ejemplos.guiaMal.push(`${m.docId} ${m.nombreOriginal} · leído ${reg.numeroGuia} · digitado ${e.guia} (${marca(e.transportadora)}, ${tipo})`)
      if (valorBien === false && ejemplos.valorMal.length < 15) ejemplos.valorMal.push(`${m.docId} ${m.nombreOriginal} · leído ${reg.valorEnvio} · digitado ${e.valor} · trámites en el nombre ${m.tramitesNombre.length}`)
      if (reg.estado === 'OK' && !guiaBien && ejemplos.okMal.length < 15) ejemplos.okMal.push(`${m.docId} ${m.nombreOriginal} · leído ${reg.numeroGuia} · digitado ${e.guia}`)
    }
  }
}

const pct = ([a, b]) => b ? `${Math.round(100 * a / b)} % (${a}/${b})` : '—'
const filas = Object.entries(grupos).sort((a, b) => (a[0] === 'TOTAL' ? -1 : b[0] === 'TOTAL' ? 1 : b[1].docs - a[1].docs)).map(([k, s]) => {
  const seg = s.seg.sort((a, b) => a - b)
  return { grupo: k, guias: s.docs, rastreo: s.rastreo, sinLectura: s.sinLectura, numeroGuia: pct(s.guia), transportadora: pct(s.transp), valor: pct(s.valor), 'valor (repartido)': s.valorReparto, fecha: pct(s.fecha), 'fecha ±3 días': s.fechaCerca, destinatario: pct(s.dest), 'todo bien': pct([s.okTodo, s.docs]), 'marcadas OK': s.ok, 'OK con guía errada': s.guiaOkMal, 'seg. mediana': seg.length ? seg[Math.floor(seg.length / 2)].toFixed(1) : '' }
})
console.table(filas)
// Guías "OK" cuyo número no coincide con lo digitado: ¿error del lector o de digitación?
const okDistintas = []
let okTotal = 0, okIgual = 0
for (const r of res) {
  const m = man.get(r.docId), reg = (r.registros || [])[0]
  if (!m || !m.esperado || !reg || reg.estado !== 'OK') continue
  okTotal++
  if (digitos(reg.numeroGuia) === digitos(m.esperado.guia)) okIgual++
  else okDistintas.push(`${m.docId} ${m.nombreOriginal} · leído ${reg.numeroGuia} (${reg.verificacion}) · digitado ${m.esperado.guia}`)
}
console.log(`\n== Guías marcadas OK: ${okTotal}; número igual a lo digitado: ${okIgual}; distinto: ${okDistintas.length}`)
okDistintas.forEach(x => console.log('  ', x))

// Verificación del número en todas las guías leídas
const verif = {}
for (const r of res) { const reg = (r.registros || [])[0]; if (!reg || reg.esRastreo || !reg.numeroGuia) continue; verif[reg.verificacion || '—'] = (verif[reg.verificacion || '—'] || 0) + 1 }
console.log('\n== Cómo se confirmó el número', verif)

// Estado final
const estados = {}
for (const r of res) { const reg = (r.registros || [])[0]; const k = r.error ? 'Error' : !reg ? 'Sin registro' : reg.esRastreo ? 'Rastreo (no es guía)' : reg.estado; estados[k] = (estados[k] || 0) + 1 }
console.log('\n== Estado', estados)

// Forma de pago contra lo digitado (solo logísticas desde el 2026-11-04, cuando existe el campo)
const pago = {}
for (const r of res) {
  const m = man.get(r.docId), reg = (r.registros || [])[0]
  if (!m || !m.esperado || !reg || reg.esRastreo || String(m.esperado.createdAt) < '2026-11-04') continue
  const k = `${marca(m.esperado.transportadora)} · leído "${reg.pago || '—'}" · digitado contra entrega=${m.esperado.contra}`
  pago[k] = (pago[k] || 0) + 1
}
console.log('\n== Forma de pago (logísticas desde el 2026-11-04)'); Object.entries(pago).sort().forEach(([k, v]) => console.log('  ', v, k))

fs.writeFileSync(path.join(DIR, 'evaluacion_' + ARCHIVO.replace('.jsonl', '') + '.json'), JSON.stringify({ filas, ejemplos, okDistintas, verif, estados, pago }, null, 1))
for (const [k, v] of Object.entries(ejemplos)) { console.log('\n== ' + k); v.forEach(x => console.log(' ', x)) }
