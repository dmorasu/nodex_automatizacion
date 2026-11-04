import 'dotenv/config'
import fs from 'fs'
import { QueryTypes, type Transaction } from 'sequelize'
import { db } from '../config/db'
import Tramitador from '../models/tramitador'
import CoberturaTramitador from '../models/tramitadores/coberturaTramitador'
import SedeMensajeria from '../models/mensajeria/sedeMensajeria'
import Operaciones from '../models/operaciones'
import { ajustarEsquemaTramitadores } from '../seeds/ajustesEsquemaTramitadores'

// =====================================
// IMPORTA EL DIRECTORIO DE TRAMITADORES (Ayudas Torre de Control, 2026-11-04)
// Lee el HTML "Ayudas_Torre_de_Control_ Rótulos _ Directorio.html" (sus datos publicados en
// "const DATOS = …") y llena en Nodex: datos del directorio de cada tramitador, sus municipios de
// cobertura, las oficinas GPA y las líneas de negocio (operaciones) con su centro de costos.
// Decisiones del usuario: el directorio manda (sobrescribe lo de Nodex cuando trae el dato; un dato
// vacío no borra nada); las personas que no están en Nodex solo se informan; se crean las
// operaciones que falten. No toca nombre, identificación, correo, región, estado ni la cuenta bancaria.
//
//   Revisar sin cambiar nada:  TS_NODE_TRANSPILE_ONLY=1 npx ts-node src/scripts/importarDirectorioTramitadores.ts "<ruta del HTML>"
//   Aplicar los cambios:       TS_NODE_TRANSPILE_ONLY=1 npx ts-node src/scripts/importarDirectorioTramitadores.ts "<ruta del HTML>" --aplicar
// =====================================

const APLICAR = process.argv.includes('--aplicar')
const RUTA = process.argv.slice(2).find(a => !a.startsWith('--'))

type Persona = {
  nombre: string, cedula: string, celular: string, correoPersonal: string, residencia: string, direccion: string,
  cobertura: string, obs: string, banco: string, tarjeta: string, tiempo: string, dia: string, mes: string
}
type Datos = {
  dir: { personas: Persona[], munis: [string, string, string, string, number][] }
  listas: { sucursales: { n: string, ciudad: string, dir: string, cel: string, horario: string }[], lineas: { n: string, cc: string | number | null }[] }
  publicado: string
}
type Municipio = { id: number, nombre: string, departamento: string, regional: string | null, N: string, D: string }

const norm = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim()
const texto = (s: unknown, max: number) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max) || null

const leerDatos = (ruta: string): Datos => {
  const contenido = fs.readFileSync(ruta, 'utf8')
  if (ruta.toLowerCase().endsWith('.json')) return JSON.parse(contenido)
  // El contenedor define los datos en una sola línea; las apps internas tienen otras "const DATOS"
  const linea = contenido.split('\n').filter(l => l.startsWith('const DATOS = ')).pop()
  if (!linea) throw new Error('El archivo no tiene "const DATOS = …": ¿es el HTML de Ayudas Torre de Control?')
  return JSON.parse(linea.slice('const DATOS = '.length).replace(/;\s*$/, ''))
}

// ── Reconocer municipios en el texto libre de cobertura (misma lógica del HTML del directorio) ──

const CAPITALES = new Set(['MEDELLIN|ANTIOQUIA', 'BARRANQUILLA|ATLANTICO', 'BOGOTA|BOGOTA D C', 'CARTAGENA|BOLIVAR', 'TUNJA|BOYACA',
  'MANIZALES|CALDAS', 'FLORENCIA|CAQUETA', 'POPAYAN|CAUCA', 'VALLEDUPAR|CESAR', 'MONTERIA|CORDOBA', 'QUIBDO|CHOCO', 'NEIVA|HUILA',
  'RIOHACHA|LA GUAJIRA', 'SANTA MARTA|MAGDALENA', 'VILLAVICENCIO|META', 'PASTO|NARINO', 'CUCUTA|NORTE DE SANTANDER', 'ARMENIA|QUINDIO',
  'PEREIRA|RISARALDA', 'BUCARAMANGA|SANTANDER', 'SINCELEJO|SUCRE', 'IBAGUE|TOLIMA', 'CALI|VALLE DEL CAUCA', 'ARAUCA|ARAUCA', 'YOPAL|CASANARE',
  'MOCOA|PUTUMAYO', 'LETICIA|AMAZONAS', 'INIRIDA|GUAINIA', 'SAN JOSE DEL GUAVIARE|GUAVIARE', 'MITU|VAUPES', 'PUERTO CARRENO|VICHADA'])
const ALIAS_DEPTO: Record<string, string> = { VALLE: 'VALLE DEL CAUCA', GUAJIRA: 'LA GUAJIRA', 'NORTE SANTANDER': 'NORTE DE SANTANDER',
  'N SANTANDER': 'NORTE DE SANTANDER', CUND: 'CUNDINAMARCA', ANT: 'ANTIOQUIA', STDER: 'SANTANDER', BOY: 'BOYACA' }

// Nombre corriente → nombre oficial en la tabla de municipios
const ALIAS_MUNICIPIO: Record<string, string> = { BOGOTA: 'BOGOTA D C', 'BOGOTA DC': 'BOGOTA D C', CARTAGENA: 'CARTAGENA DE INDIAS' }

const crearReconocedor = (municipios: Municipio[], abreviaturas: [string, string][]) => {
  const porNombre = new Map<string, Municipio[]>()
  for (const m of municipios) porNombre.set(m.N, [...(porNombre.get(m.N) ?? []), m])
  for (const [corriente, oficial] of Object.entries(ALIAS_MUNICIPIO)) {
    if (porNombre.has(oficial) && !porNombre.has(corriente)) porNombre.set(corriente, porNombre.get(oficial)!)
  }
  const deptos = new Set(municipios.map(m => m.D))
  const regionalDe = new Map(municipios.map(m => [m.D, m.regional]))
  const alias = new Map<string, string>([...deptos].map(d => [d, d]))
  for (const [abr, dep] of abreviaturas) if (abr && deptos.has(dep) && !alias.has(abr)) alias.set(abr, dep)
  for (const [a, d] of Object.entries(ALIAS_DEPTO)) if (deptos.has(d) && !alias.has(a)) alias.set(a, d)
  const aliasOrden = [...alias.keys()].sort((a, b) => b.length - a.length)
  const filtrar = (c: Municipio[], pista: string | null) => { if (!pista) return c; const f = c.filter(m => m.D === pista); return f.length ? f : c }

  const buscar = (entrada: string): { cands?: Municipio[], pista?: string | null, soloDepto?: string, interpretado?: boolean } | null => {
    let t = entrada
    let pista: string | null = null
    const par = t.match(/\(([^)]*)\)/)
    if (par) { const a = norm(par[1]); if (alias.has(a)) pista = alias.get(a)!; t = t.replace(/\([^)]*\)/g, ' ') }
    let n = norm(t)
    if (!n) return null
    const teniaMunicipio = /\bMUNICIPIO\b/.test(n)
    n = n.replace(/\bMUNICIPIOS?( DE)?\b/g, ' ').replace(/\s+/g, ' ').trim()
    if (!n) return null
    if (porNombre.has(n)) return { cands: filtrar(porNombre.get(n)!, pista), pista }
    if (!teniaMunicipio && alias.has(n)) return { soloDepto: alias.get(n) }
    for (const a of aliasOrden) {
      if (n.endsWith(' ' + a)) {
        const base = n.slice(0, -(a.length + 1)).trim()
        if (porNombre.has(base)) { const p = alias.get(a)!; return { cands: filtrar(porNombre.get(base)!, p), pista: p } }
      }
    }
    const sinEsp = (x: string) => x.replace(/ /g, '')
    const intentar = (q: string) => municipios.filter(m => sinEsp(m.N) === sinEsp(q) || m.N === 'EL ' + q || m.N === 'LA ' + q
      || 'EL ' + m.N === q || 'LA ' + m.N === q || (q.length >= 4 && m.N.endsWith(' ' + q)))
    let f = intentar(n)
    if (!f.length) {
      for (const a of aliasOrden) {
        if (n.endsWith(' ' + a)) { const base = n.slice(0, -(a.length + 1)).trim(); f = intentar(base); if (f.length) { pista = alias.get(a)!; f = filtrar(f, pista); break } }
      }
    }
    return f.length ? { cands: filtrar(f, pista), pista, interpretado: true } : { cands: [] }
  }

  const partir = (s: string) => {
    const crudos = s.split(/\r?\n|;|,|\/|-|\s+y\s+/i).map(x => x.trim()).filter(Boolean)
    const out: string[] = []
    for (let i = 0; i < crudos.length; i++) {
      if (i + 1 < crudos.length && porNombre.has(norm(crudos[i] + ' ' + crudos[i + 1]))) { out.push(crudos[i] + ' ' + crudos[i + 1]); i++ }
      else out.push(crudos[i])
    }
    return out
  }

  const resolver = (cands: Municipio[], ctxD: Set<string>) => {
    if (cands.length === 1) return { m: cands[0] }
    let pool = cands.filter(m => ctxD.has(m.D))
    if (pool.length === 1) return { m: pool[0] }
    if (!pool.length) pool = cands
    const caps = pool.filter(m => CAPITALES.has(m.N + '|' + m.D))
    if (caps.length === 1) return { m: caps[0] }
    const ctxR = new Set([...ctxD].map(d => regionalDe.get(d)).filter(Boolean))
    const r = pool.filter(m => ctxR.has(m.regional))
    if (r.length === 1) return { m: r[0] }
    return { m: (r.length ? r : pool)[0], ambiguo: pool }
  }

  // Cobertura y residencia de una persona, con las notas de lo que no se pudo leer con seguridad
  return (p: Persona) => {
    const notas: string[] = []
    const entradas: { tok: string, cands: Municipio[], pista?: string | null, interpretado?: boolean }[] = []
    const ctxD = new Set<string>()
    for (const tok of partir(p.cobertura ?? '')) {
      const r = buscar(tok)
      if (!r) continue
      if (r.soloDepto) { ctxD.add(r.soloDepto); continue }
      entradas.push({ tok, cands: r.cands ?? [], pista: r.pista, interpretado: r.interpretado })
    }
    entradas.forEach(e => { if (e.pista) ctxD.add(e.pista); if (e.cands.length === 1) ctxD.add(e.cands[0].D) })
    const res = p.residencia ? buscar(p.residencia) : null
    if (res?.cands?.length === 1) ctxD.add(res.cands[0].D)

    const cobertura: Municipio[] = []
    for (const e of entradas) {
      if (!e.cands.length) { notas.push(`«${e.tok}» no es un municipio`); continue }
      const r = resolver(e.cands, ctxD)
      if (r.ambiguo) notas.push(`«${e.tok}» está en varios departamentos (${r.ambiguo.map(m => m.departamento).join(', ')}): se tomó ${r.m.departamento}`)
      else if (e.interpretado) notas.push(`«${e.tok}» se tomó como ${r.m.nombre} (${r.m.departamento})`)
      if (!cobertura.includes(r.m)) cobertura.push(r.m)
    }
    const residencia = res?.cands?.length ? resolver(res.cands, ctxD).m : null
    if (p.residencia && !residencia) notas.push(`Residencia «${p.residencia}» no es un municipio`)
    return { cobertura, residencia, notas }
  }
}

// ── Valores de cada campo ──

const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']
const mes = (v: string) => {
  const n = parseInt(v, 10)
  if (n >= 1 && n <= 12) return n
  const i = MESES.indexOf(norm(v).slice(0, 3))
  return i >= 0 ? i + 1 : null
}
// Nodex guarda el WhatsApp con el indicativo del país
const whatsapp = (v: string) => {
  const d = String(v ?? '').replace(/\D/g, '')
  return d.length === 10 ? '57' + d : d.length >= 11 && d.length <= 15 ? d : null
}
const siNo = (v: string) => { const n = norm(v); return n === 'SI' ? true : n === 'NO' ? false : null }

const valoresDirectorio = (p: Persona, residencia: Municipio | null) => {
  const dia = parseInt(p.dia, 10)
  const m = mes(p.mes)
  const nota = norm(p.obs) === 'MENSAJERO PROPIO' ? null : texto(p.obs, 500)
  return {
    numeroTramitador: whatsapp(p.celular),
    direccion: texto(p.direccion, 200),
    ciudad: texto(p.residencia, 100),
    banco: texto(p.banco, 100),
    correoPersonal: /@/.test(p.correoPersonal ?? '') ? texto(p.correoPersonal, 150)!.toLowerCase() : null,
    municipioResidenciaId: residencia?.id ?? null,
    cumpleDia: dia >= 1 && dia <= 31 && m ? dia : null,
    cumpleMes: dia >= 1 && dia <= 31 && m ? m : null,
    tarjetaAmparada: siNo(p.tarjeta),
    tiempoPago: texto(p.tiempo, 200),
    notaDirectorio: nota
  }
}

const main = async () => {
  if (!RUTA) throw new Error('Indique la ruta del HTML de Ayudas Torre de Control (o del JSON extraído)')
  const datos = leerDatos(RUTA)
  console.log(`Directorio publicado el ${datos.publicado}: ${datos.dir.personas.length} personas`)
  // Las mismas columnas y la tabla de cobertura que crea el arranque del backend (no toca datos)
  await ajustarEsquemaTramitadores()
  await CoberturaTramitador.sync()
  console.log(APLICAR ? '>>> APLICANDO CAMBIOS\n' : '>>> SOLO REVISIÓN (agregue --aplicar para guardar)\n')

  // Una sola copia de cada municipio (la tabla puede tenerlos repetidos: la de menor id, como el buscador)
  const municipios = (await db.query<{ id: number, nombre: string, departamento: string, regional: string | null }>(`
    SELECT DISTINCT ON (UPPER(TRIM("nombreMunicipio")), UPPER(TRIM(departamento)))
      id, "nombreMunicipio" AS nombre, departamento,
      COALESCE(regional, (SELECT d.regional FROM "Municipios" d WHERE UPPER(TRIM(d."nombreMunicipio")) = UPPER(TRIM(m."nombreMunicipio"))
        AND UPPER(TRIM(d.departamento)) = UPPER(TRIM(m.departamento)) AND d.regional IS NOT NULL LIMIT 1)) AS regional
    FROM "Municipios" m
    ORDER BY UPPER(TRIM("nombreMunicipio")), UPPER(TRIM(departamento)), id
  `, { type: QueryTypes.SELECT }))
    .map(m => ({ ...m, N: norm(m.nombre), D: norm(m.departamento) }))
    .sort((a, b) => a.id - b.id)
    // Con y sin tilde ("CHÍA" y "CHIA") es el mismo municipio: queda el de menor id
    .filter((m, i, todos) => todos.findIndex(x => x.N === m.N && x.D === m.D) === i)
  const leer = crearReconocedor(municipios, datos.dir.munis.map(r => [norm(r[2]), norm(r[1])]))

  const tramitadores = await Tramitador.findAll()
  const porCedula = new Map(tramitadores.map(t => [String(t.identificacion ?? '').replace(/\D/g, ''), t]))
  const porNombre = new Map(tramitadores.map(t => [norm(t.nombreTramitador), t]))

  const transaction: Transaction | undefined = APLICAR ? await db.transaction() : undefined
  try {
    const sinPareja: string[] = []
    const avisos: string[] = []
    let actualizados = 0, coberturas = 0

    for (const p of datos.dir.personas) {
      const ced = String(p.cedula ?? '').replace(/\D/g, '')
      const t = (ced && porCedula.get(ced)) || porNombre.get(norm(p.nombre))
      if (!t) { sinPareja.push(`${p.nombre} (${ced || 'sin cédula'})`); continue }

      const { cobertura, residencia, notas } = leer(p)
      const nuevos = valoresDirectorio(p, residencia)
      // El directorio manda, pero un dato vacío no borra lo que ya hay en Nodex
      const cambios = Object.fromEntries(Object.entries(nuevos).filter(([campo, valor]) =>
        valor !== null && String(valor) !== String(t.get(campo) ?? '')))
      const coberturaActual = (await CoberturaTramitador.findAll({ where: { tramitadorId: t.id }, transaction })).map(c => c.municipioId).sort()
      const coberturaNueva = cobertura.map(m => m.id).sort()
      const cambiaCobertura = coberturaNueva.length > 0 && coberturaNueva.join() !== coberturaActual.join()

      const encabezado = `${t.nombreTramitador} (#${t.id}${ced && porCedula.get(ced) ? '' : ', por nombre'})`
      if (Object.keys(cambios).length || cambiaCobertura || notas.length) {
        console.log(encabezado)
        for (const [campo, valor] of Object.entries(cambios)) console.log(`   ${campo}: ${t.get(campo) ?? '—'} → ${valor}`)
        if (cambiaCobertura) console.log(`   cobertura (${coberturaActual.length} → ${coberturaNueva.length}): ${cobertura.map(m => m.nombre).join(', ')}`)
        notas.forEach(n => console.log(`   ⚠ ${n}`))
      }
      if (/MENSAJERO PROPIO/.test(norm(p.obs)) !== Boolean(t.esMensajero)) {
        avisos.push(`${t.nombreTramitador}: en el directorio ${/MENSAJERO PROPIO/.test(norm(p.obs)) ? 'es' : 'no es'} mensajero propio y en Nodex ${t.esMensajero ? 'sí' : 'no'} (no se cambia: revíselo en Catálogos)`)
      }
      if (ced && porCedula.get(ced) !== t) avisos.push(`${t.nombreTramitador}: la cédula del directorio (${ced}) no coincide con la de Nodex (${t.identificacion})`)

      if (APLICAR) {
        if (Object.keys(cambios).length) await t.update(cambios, { transaction })
        if (cambiaCobertura) {
          await CoberturaTramitador.destroy({ where: { tramitadorId: t.id }, transaction })
          await CoberturaTramitador.bulkCreate(coberturaNueva.map(municipioId => ({ tramitadorId: t.id, municipioId })), { transaction })
        }
      }
      if (Object.keys(cambios).length) actualizados++
      if (cambiaCobertura) coberturas++
    }

    // ── Oficinas GPA (sedes): se emparejan por ciudad; la que falte se crea ──
    console.log('\nOficinas GPA')
    const sedes = await SedeMensajeria.findAll({ transaction })
    for (const s of datos.listas.sucursales) {
      const ciudad = norm(s.ciudad)
      const sede = sedes.find(x => norm(x.ciudad) === ciudad || norm(x.nombre).includes(ciudad))
      const valores = { direccion: texto(s.dir, 300)!, ciudad: texto(s.ciudad, 100), celular: texto(String(s.cel ?? '').replace(/\D/g, ''), 20), horario: texto(s.horario, 300) }
      if (!sede) {
        console.log(`   + ${s.n}: se crea (${valores.direccion}). Ubíquela en el mapa en Rutas de mensajeros`)
        if (APLICAR) await SedeMensajeria.create({ nombre: texto(s.n, 100), ...valores }, { transaction })
        continue
      }
      const cambios = Object.fromEntries(Object.entries(valores).filter(([c, v]) => v !== null && String(v) !== String(sede.get(c) ?? '')))
      if (Object.keys(cambios).length) {
        console.log(`   ${sede.nombre}: ${Object.entries(cambios).map(([c, v]) => `${c} → ${v}`).join(' · ')}`)
        if (APLICAR) await sede.update(cambios, { transaction })
      }
    }

    // ── Líneas de negocio = operaciones de Nodex, con su centro de costos ──
    console.log('\nLíneas de negocio (operaciones)')
    const operaciones = await Operaciones.findAll({ transaction })
    for (const l of datos.listas.lineas) {
      const cc = texto(l.cc, 10)
      const op = operaciones.find(o => norm(o.nombreOperacion) === norm(l.n))
      if (!op) {
        console.log(`   + ${l.n} (centro de costos ${cc ?? '—'}): se crea`)
        if (APLICAR) await Operaciones.create({ nombreOperacion: texto(l.n, 100), centroDeCostos: cc }, { transaction })
      } else if (cc && cc !== String(op.centroDeCostos ?? '')) {
        console.log(`   ${op.nombreOperacion}: centro de costos ${op.centroDeCostos ?? '—'} → ${cc}`)
        if (APLICAR) await op.update({ centroDeCostos: cc }, { transaction })
      }
    }

    console.log(`\nResumen: ${actualizados} tramitadores con datos nuevos, ${coberturas} con cobertura nueva`)
    if (sinPareja.length) console.log(`No están en Nodex (créelos en Catálogos → Tramitadores y vuelva a importar): ${sinPareja.join('; ')}`)
    avisos.forEach(a => console.log(`⚠ ${a}`))
    console.log('El directorio no trae número ni tipo de cuenta bancaria: esos datos se siguen llenando en Catálogos → Tramitadores.')

    if (transaction) { await transaction.commit(); console.log('\n✅ Cambios guardados') }
  } catch (error) {
    if (transaction) await transaction.rollback()
    throw error
  }
}

main()
  .then(() => db.close())
  .then(() => process.exit(0))
  .catch(error => { console.error('❌', error); process.exit(1) })
