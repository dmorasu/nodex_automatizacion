import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb, type RGB } from 'pdf-lib'
import { LOGO_GPA_PNG } from './logoGpa'
import type { Rotulo } from './reglasRotulo'

// =====================================
// PDF DEL RÓTULO DE ENVÍO (fase 3, 2026-11-04)
// Mismo diseño que el "Generador de rótulos" de Torre de control: encabezado con el logo y el
// trámite, remitente, destinatario en letra grande, detalle del envío, quién paga y a quién se
// factura, observaciones de devolución y pie con quién lo solicitó y cuándo se imprimió.
// Carta (8,5 × 11 in, se reduce si no cabe) o pequeño (15 cm de ancho, para el sobre de la
// tarjeta de propiedad). Cada bloque se mide primero y luego se dibuja.
// =====================================

const NEGRO = rgb(0.067, 0.067, 0.067)
const GRIS = rgb(0.33, 0.33, 0.33)
const GRIS_CLARO = rgb(0.4, 0.4, 0.4)
const LINEA = rgb(0.73, 0.73, 0.73)
const BLANCO = rgb(1, 1, 1)
const CM = 72 / 2.54

// Tamaños en puntos (los del HTML pasados de px a pt)
const MEDIDAS = {
  carta: {
    ancho: 612, alto: 792, margenX: 36, margenArriba: 29, margenAbajo: 25,
    logo: 63, marca: 15.75, marcaSub: 9, tipoK: 7.5, tipoV: 13.5, separacionEncabezado: 10.5, bordeEncabezado: 2.25, bajoEncabezado: 7.5,
    entreSecciones: 10.5, bordeSeccion: 1.1, radio: 7.5, tituloSeccion: 9.4, tituloPadY: 5.25, tituloPadX: 10.5, cuerpoPadY: 8.25, cuerpoPadX: 12,
    remNombre: 13.5, kv: 10, kvSepX: 16.5, kvSepY: 3.75,
    destNombre: 22.5, destId: 11.25, destDir: 16.5, destCiudad: 18,
    tramites: 10.5, envK: 7.9, envV: 10.5, envSepX: 13.5, envSepY: 9,
    pago: 11, pagoPadY: 9, pagoPadX: 12, bordePago: 1.5, factura: 10.5,
    obs: 9.4, pie: 8.6, sobrePie: 4.5
  },
  peq: {
    ancho: 15 * CM, alto: 10 * CM, margenX: 0.45 * CM, margenArriba: 0.35 * CM, margenAbajo: 0.35 * CM,
    logo: 30, marca: 7.9, marcaSub: 6, tipoK: 6, tipoV: 8.25, separacionEncabezado: 6, bordeEncabezado: 1.5, bajoEncabezado: 3.75,
    entreSecciones: 4.5, bordeSeccion: 0.75, radio: 4.5, tituloSeccion: 6, tituloPadY: 1.5, tituloPadX: 6, cuerpoPadY: 3.75, cuerpoPadX: 6,
    remNombre: 7.5, kv: 6, kvSepX: 7.5, kvSepY: 0.5,
    destNombre: 9.4, destId: 6.4, destDir: 8.25, destCiudad: 8.6,
    tramites: 6.4, envK: 4.9, envV: 6, envSepX: 6, envSepY: 1.5,
    pago: 6.75, pagoPadY: 3, pagoPadX: 6, bordePago: 1.1, factura: 6,
    obs: 5.6, pie: 5.6, sobrePie: 3
  }
}
type Medidas = typeof MEDIDAS.carta

type Tramo = { t: string, b?: boolean }

// Lápiz que mide o dibuja. `y` baja desde el borde superior del contenido
class Lapiz {
  y = 0
  private caracteres = new Map<string, boolean>()
  constructor(
    private pagina: PDFPage | null,
    private normal: PDFFont,
    private negrita: PDFFont,
    private logo: PDFImage | null,
    private m: Medidas,
    private z: number,
    private arriba: number,
    readonly x0: number,
    readonly ancho: number
  ) {}

  tam = (base: number) => base * this.z
  fuente = (b?: boolean) => (b ? this.negrita : this.normal)

  // Quita lo que Helvetica no puede escribir (emojis, flechas…)
  limpio(texto: string) {
    let salida = ''
    for (const c of texto.replace(/\r/g, '')) {
      if (c === '\n') { salida += c; continue }
      let ok = this.caracteres.get(c)
      if (ok === undefined) {
        try { this.normal.widthOfTextAtSize(c, 10); ok = true } catch { ok = false }
        this.caracteres.set(c, ok)
      }
      salida += ok ? c : (/\s/.test(c) ? ' ' : '')
    }
    return salida
  }

  medir = (texto: string, tam: number, b?: boolean) => this.fuente(b).widthOfTextAtSize(texto, tam)

  // Renglones de un párrafo con tramos en negrita y normal; las palabras muy largas se parten
  renglones(tramos: Tramo[], tam: number, ancho: number) {
    type Palabra = { t: string, b?: boolean, espacio: boolean }
    const lineas: Palabra[][] = [[]]
    for (const tramo of tramos) {
      const partes = this.limpio(tramo.t).split(/(\n|\s+)/)
      for (const p of partes) {
        if (p === '\n') { lineas.push([]); continue }
        if (!p) continue
        if (/^\s+$/.test(p)) { const l = lineas[lineas.length - 1]; if (l.length) l[l.length - 1].espacio = true; continue }
        lineas[lineas.length - 1].push({ t: p, b: tramo.b, espacio: false })
      }
    }
    const espacio = (b?: boolean) => this.medir(' ', tam, b)
    const salida: { t: string, b?: boolean, x: number }[][] = []
    for (const palabras of lineas) {
      let actual: { t: string, b?: boolean, x: number }[] = []
      let x = 0
      const cerrar = () => { salida.push(actual); actual = []; x = 0 }
      palabras.forEach((p, i) => {
        let texto = p.t
        let w = this.medir(texto, tam, p.b)
        if (x > 0 && x + w > ancho) cerrar()
        while (w > ancho && texto.length > 1) {
          let corte = texto.length - 1
          while (corte > 1 && this.medir(texto.slice(0, corte), tam, p.b) > ancho - x) corte--
          actual.push({ t: texto.slice(0, corte), b: p.b, x }); cerrar()
          texto = texto.slice(corte); w = this.medir(texto, tam, p.b)
        }
        actual.push({ t: texto, b: p.b, x })
        x += w + (p.espacio && i < palabras.length - 1 ? espacio(p.b) : 0)
      })
      cerrar()
    }
    return salida
  }

  // Escribe un párrafo desde (x, this.y) y baja el lápiz
  parrafo(tramos: Tramo[], base: number, { x = this.x0, ancho = this.ancho, alto = 1.25, color = NEGRO }: { x?: number, ancho?: number, alto?: number, color?: RGB } = {}) {
    const tam = this.tam(base)
    const lineas = this.renglones(tramos, tam, ancho)
    for (const linea of lineas) {
      if (this.pagina) {
        for (const p of linea) this.pagina.drawText(p.t, { x: x + p.x, y: this.arriba - this.y - tam * 0.8, size: tam, font: this.fuente(p.b), color })
      }
      this.y += tam * alto
    }
    return lineas.length
  }

  // Alto que tendría un párrafo, sin moverse
  altoDe(tramos: Tramo[], base: number, ancho: number, alto = 1.25) {
    const tam = this.tam(base)
    return this.renglones(tramos, tam, ancho).length * tam * alto
  }

  texto(valor: string, base: number, x: number, b?: boolean, color = NEGRO, alineacion: 'izq' | 'der' = 'izq') {
    const tam = this.tam(base)
    const t = this.limpio(valor).replace(/\n/g, ' ')
    const xx = alineacion === 'der' ? x - this.medir(t, tam, b) : x
    this.pagina?.drawText(t, { x: xx, y: this.arriba - this.y - tam * 0.8, size: tam, font: this.fuente(b), color })
  }

  linea(x1: number, x2: number, grosor: number, color = NEGRO, enY = this.y) {
    this.pagina?.drawLine({ start: { x: x1, y: this.arriba - enY }, end: { x: x2, y: this.arriba - enY }, thickness: grosor, color })
  }

  vertical(x: number, y1: number, y2: number, grosor: number, color = NEGRO) {
    this.pagina?.drawLine({ start: { x, y: this.arriba - y1 }, end: { x, y: this.arriba - y2 }, thickness: grosor, color })
  }

  imagenLogo(x: number, alto: number) {
    if (!this.logo) return 0
    const ancho = alto * this.logo.width / this.logo.height
    this.pagina?.drawImage(this.logo, { x, y: this.arriba - this.y - alto, width: ancho, height: alto })
    return ancho
  }

  // Rectángulo con esquinas redondeadas desde (x, y) hacia abajo
  caja(x: number, y: number, ancho: number, alto: number, { radio, borde, relleno, guiones, soloArriba }: { radio: number, borde?: number, relleno?: RGB, guiones?: number[], soloArriba?: boolean }) {
    if (!this.pagina) return
    const r = Math.min(radio, alto / 2, ancho / 2)
    const camino = soloArriba
      ? `M ${r} 0 H ${ancho - r} A ${r} ${r} 0 0 1 ${ancho} ${r} V ${alto} H 0 V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`
      : `M ${r} 0 H ${ancho - r} A ${r} ${r} 0 0 1 ${ancho} ${r} V ${alto - r} A ${r} ${r} 0 0 1 ${ancho - r} ${alto} H ${r} A ${r} ${r} 0 0 1 0 ${alto - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`
    this.pagina.drawSvgPath(camino, {
      x, y: this.arriba - y,
      color: relleno, borderColor: borde ? NEGRO : undefined, borderWidth: borde, borderDashArray: guiones
    })
  }
}

const fechaImpresion = (iso: string) => {
  const f = new Date(iso)
  const dia = f.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Bogota' })
  const hora = f.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' })
  return `${dia}, ${hora}`
}
const pesos = (valor: number) => `$${valor.toLocaleString('es-CO')}`

// Dibuja (o mide, si el lápiz no tiene página) el rótulo completo. Devuelve el alto usado sin el pie
const contenido = (L: Lapiz, R: Rotulo, m: Medidas) => {
  const t = L.tam
  const peq = R.tamano === 'peq'

  // ── Encabezado: logo · RÓTULO DE ENVÍO / flujo · trámite y placa ──
  const inicio = L.y
  const anchoLogo = L.imagenLogo(L.x0, t(m.logo))
  const xMarca = L.x0 + anchoLogo + t(m.separacionEncabezado)
  const altoMarca = t(m.marca) * 1.1 + t(m.marcaSub) * 1.3
  const yMarca = inicio + (t(m.logo) - altoMarca) / 2
  L.y = yMarca
  L.texto('RÓTULO DE ENVÍO', m.marca, xMarca + t(m.separacionEncabezado), true)
  L.y = yMarca + t(m.marca) * 1.1
  L.texto(R.flujo.toUpperCase(), m.marcaSub, xMarca + t(m.separacionEncabezado), false, GRIS)
  L.vertical(xMarca, yMarca - t(2), yMarca + altoMarca + t(2), t(1.1), LINEA)
  const derecha = L.x0 + L.ancho
  const varios = R.tramites.length > 1
  const placa = R.tramites.length === 1 ? R.tramites[0].placa : ''
  const bloque: [string, string][] = [[varios ? `${R.tramites.length} TRÁMITES NODEX` : 'TRÁMITE NODEX',
    varios ? `#${R.tramites[0].id} y ${R.tramites.length - 1} más` : R.tramites[0] ? `#${R.tramites[0].id}` : '—']]
  if (placa) bloque.push(['PLACA / MATRÍCULA', placa])
  const altoBloque = bloque.length * (t(m.tipoK) * 1.3 + t(m.tipoV) * 1.2)
  L.y = inicio + Math.max(0, (t(m.logo) - altoBloque) / 2)
  for (const [k, v] of bloque) {
    L.texto(k, m.tipoK, derecha, true, GRIS, 'der'); L.y += t(m.tipoK) * 1.3
    L.texto(v, m.tipoV, derecha, true, NEGRO, 'der'); L.y += t(m.tipoV) * 1.2
  }
  L.y = inicio + Math.max(t(m.logo), altoBloque) + t(m.bajoEncabezado)
  L.linea(L.x0, derecha, t(m.bordeEncabezado))
  L.y += t(m.bordeEncabezado)

  // ── Sección con título negro y borde redondeado ──
  const seccion = (titulo: string, cuerpo: (x: number, ancho: number) => void) => {
    L.y += t(m.entreSecciones)
    const y0 = L.y
    const altoTitulo = t(m.tituloSeccion) + 2 * t(m.tituloPadY)
    L.caja(L.x0, y0, L.ancho, altoTitulo, { radio: t(m.radio), relleno: NEGRO, soloArriba: true })
    L.y = y0 + t(m.tituloPadY)
    L.texto(titulo, m.tituloSeccion, L.x0 + t(m.tituloPadX), true, BLANCO)
    L.y = y0 + altoTitulo + t(m.cuerpoPadY)
    cuerpo(L.x0 + t(m.cuerpoPadX), L.ancho - 2 * t(m.cuerpoPadX))
    L.y += t(m.cuerpoPadY)
    L.caja(L.x0, y0, L.ancho, L.y - y0, { radio: t(m.radio), borde: t(m.bordeSeccion) })
  }

  // Pares "Etiqueta: valor" en dos columnas
  const pares = (items: [string, string][], x: number, ancho: number, base: number) => {
    const visibles = items.filter(([, v]) => v)
    const col = (ancho - t(m.kvSepX)) / 2
    for (let i = 0; i < visibles.length; i += 2) {
      const y0 = L.y
      let fin = y0
      visibles.slice(i, i + 2).forEach(([k, v], j) => {
        L.y = y0
        L.parrafo(k ? [{ t: `${k} `, b: true }, { t: v }] : [{ t: v }], base, { x: x + j * (col + t(m.kvSepX)), ancho: col })
        fin = Math.max(fin, L.y)
      })
      L.y = fin + t(m.kvSepY)
    }
  }

  seccion('REMITENTE', (x, ancho) => {
    L.parrafo([{ t: R.rem.titulo || '—', b: true }], m.remNombre, { x, ancho, alto: 1.2 })
    L.y += t(2)
    pares([
      ['Identificación:', R.rem.doc], ['Tel.:', R.rem.tel], ['Dirección:', R.rem.dir], ['Ciudad:', R.rem.ciudad],
      ['', R.rem.linea2], ['Contacto:', R.origen === 'gpa' ? R.rem.contacto : '']
    ], x, ancho, m.kv)
  })

  seccion('DESTINATARIO', (x, ancho) => {
    L.parrafo([{ t: R.dest.titulo || '—', b: true }], m.destNombre, { x, ancho, alto: 1.15 })
    const id: Tramo[] = []
    const sep = () => { if (id.length) id.push({ t: '   ·   ' }) }
    if (R.dest.doc) id.push({ t: 'Identificación: ', b: true }, { t: R.dest.doc })
    if (R.dest.tel) { sep(); id.push({ t: 'Tel.: ', b: true }, { t: R.dest.tel }) }
    if (R.dest.contacto && R.dest.contacto !== R.dest.titulo) { sep(); id.push({ t: 'Contacto: ', b: true }, { t: R.dest.contacto }) }
    if (id.length) { L.y += t(2); L.parrafo(id, m.destId, { x, ancho, color: rgb(0.13, 0.13, 0.13) }) }
    L.y += t(peq ? 1 : 4.5)
    L.parrafo([{ t: R.dest.dir || '—', b: true }], m.destDir, { x, ancho })
    L.y += t(peq ? 0 : 3)
    L.parrafo([{ t: [R.dest.ciudad, R.dest.dep].filter(Boolean).join(' · ').toUpperCase(), b: true }], m.destCiudad, { x, ancho, alto: 1.2 })
  })

  if (varios) {
    L.y += t(peq ? 3 : 7.5)
    L.parrafo([{ t: 'Trámites incluidos: ', b: true }, { t: R.tramites.map(x => `#${x.id}${x.placa ? ` (${x.placa})` : ''}`).join(' · ') }], m.tramites)
  }

  seccion('DETALLE DEL ENVÍO', (x, ancho) => {
    const items: [string, string][] = [
      ['Tipo', R.tipo], ['Contenido', R.contenido], ['Detalle', R.detalle],
      ['Línea de negocio', R.linea], ['Centro de costos', R.cc], ['Solicitante', R.solicitante],
      ['Transportadora', R.transportadora], ['Contraentrega', R.contraentrega ? 'SÍ' : 'NO'],
      ['Asegurado', R.asegurado ? `SÍ${R.valorDeclarado ? ` · ${pesos(R.valorDeclarado)}` : ''}` : 'NO']
    ]
    const col = (ancho - 2 * t(m.envSepX)) / 3
    for (let i = 0; i < items.length; i += 3) {
      const y0 = L.y
      let fin = y0
      items.slice(i, i + 3).forEach(([k, v], j) => {
        L.y = y0
        const xx = x + j * (col + t(m.envSepX))
        L.parrafo([{ t: k.toUpperCase(), b: true }], m.envK, { x: xx, ancho: col, color: GRIS })
        L.parrafo([{ t: v || '—', b: true }], m.envV, { x: xx, ancho: col, alto: 1.2 })
        fin = Math.max(fin, L.y)
      })
      L.y = fin + (i + 3 < items.length ? t(m.envSepY) : 0)
    }
  })

  // ── Quién paga (recuadro punteado) ──
  L.y += t(m.entreSecciones)
  const y0 = L.y
  const xp = L.x0 + t(m.pagoPadX), ap = L.ancho - 2 * t(m.pagoPadX)
  L.y += t(m.pagoPadY)
  L.parrafo([{ t: R.pago, b: true }], m.pago, { x: xp, ancho: ap })
  L.y += t(peq ? 2 : 4)
  L.linea(xp, xp + ap, 0.6, LINEA)
  L.y += t(peq ? 2 : 4)
  L.parrafo([
    { t: 'Facturar a: ', b: true }, { t: `${R.factura.nombre || '—'} · ${R.factura.esNit ? 'NIT' : 'Identificación'} ${R.factura.identificacion || '—'} · ` },
    { t: 'Correo factura electrónica: ', b: true }, { t: R.factura.correo || '—' }
  ], m.factura, { x: xp, ancho: ap })
  L.y += t(m.pagoPadY)
  L.caja(L.x0, y0, L.ancho, L.y - y0, { radio: t(m.radio), borde: t(m.bordePago), guiones: [t(4), t(3)] })

  if (R.observaciones) {
    L.y += t(peq ? 3 : 7.5)
    L.parrafo([{ t: `${R.tituloObservaciones}: `, b: true }, { t: R.observaciones }], m.obs, { color: rgb(0.2, 0.2, 0.2), alto: 1.3 })
  }
}

const pie = (L: Lapiz, R: Rotulo, m: Medidas, yPie: number) => {
  L.y = yPie
  L.linea(L.x0, L.x0 + L.ancho, 0.75, LINEA)
  L.y += L.tam(m.sobrePie)
  const izquierda = `Solicitó: ${R.solicitante || '—'}${R.tamano === 'peq' ? '' : ` · Centro de costos ${R.cc || '—'}`}`
  L.texto(izquierda, m.pie, L.x0, false, GRIS_CLARO)
  L.texto(`Impreso: ${fechaImpresion(R.impreso)}`, m.pie, L.x0 + L.ancho, false, GRIS_CLARO, 'der')
}
const altoPie = (m: Medidas, z: number) => (m.pie * 1.3 + m.sobrePie) * z + 0.75

// Una página con el rótulo. En carta se achica (hasta 55 %) si no cabe; el pequeño crece en alto
export const agregarPaginaRotulo = async (pdf: PDFDocument, R: Rotulo, fuentes?: { normal: PDFFont, negrita: PDFFont, logo: PDFImage | null }) => {
  const f = fuentes ?? {
    normal: await pdf.embedFont(StandardFonts.Helvetica),
    negrita: await pdf.embedFont(StandardFonts.HelveticaBold),
    logo: await pdf.embedPng(Buffer.from(LOGO_GPA_PNG, 'base64')).catch(() => null)
  }
  const m: Medidas = MEDIDAS[R.tamano]
  const anchoUtil = m.ancho - 2 * m.margenX
  const medir = (z: number) => {
    const L = new Lapiz(null, f.normal, f.negrita, f.logo, m, z, 0, m.margenX, anchoUtil)
    contenido(L, R, m)
    return L.y
  }

  let z = 1
  let alto = m.alto
  if (R.tamano === 'carta') {
    const disponible = m.alto - m.margenArriba - m.margenAbajo
    while (z > 0.55 && medir(z) + altoPie(m, z) + 6 > disponible) z = Math.round((z - 0.03) * 100) / 100
  } else {
    alto = Math.max(m.alto, medir(1) + altoPie(m, 1) + 6 + m.margenArriba + m.margenAbajo)
  }

  const pagina = pdf.addPage([m.ancho, alto])
  const arriba = alto - m.margenArriba
  const L = new Lapiz(pagina, f.normal, f.negrita, f.logo, m, z, arriba, m.margenX, anchoUtil)
  contenido(L, R, m)
  pie(L, R, m, alto - m.margenArriba - m.margenAbajo - altoPie(m, z))
  return f
}

export const generarPdfRotulo = async (R: Rotulo) => {
  const pdf = await PDFDocument.create()
  pdf.setTitle(`Rótulo de envío ${R.tramites.map(t => `#${t.id}`).join(' ')}`)
  pdf.setAuthor('Nodex · Gómez Pineda Abogados')
  await agregarPaginaRotulo(pdf, R)
  return Buffer.from(await pdf.save())
}

// "Rotulo_5697_ABC123_JUAN PEREZ.pdf" (como el generador anterior)
export const nombreArchivoRotulo = (R: Rotulo) => {
  const limpio = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 -]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40)
  return `${['Rotulo', R.tramites[0] ? String(R.tramites[0].id) : '', limpio(R.tramites[0]?.placa ?? ''), limpio(R.dest.titulo)].filter(Boolean).join('_')}.pdf`
}
