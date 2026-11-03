import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib'
import { buscarCuenta, datosDelTramitador, distribucionDe, agruparPorTramite, lineasDe } from './cuentasCobro'
import { numeroCuentaTramitador, ESTADOS_CUENTA_TRAMITADOR as ESTADOS } from '../../models/cuentasCobroTramitador/cuentaCobroTramitador'
import { obtenerArchivo } from '../azureFileStorage'
import { pesosEnLetras } from '../../utils/numeroALetras'
import Usuarios from '../../models/usuarios'

// =====================================
// PDF DE LA CUENTA DE COBRO: la cuenta (página 1), el Anexo 1 con el detalle de los trámites y el
// Formato de distribución de centros de costos (GA-F-GCO 0101), con los formatos que ya usaba
// la empresa. Lo descargan el analista, el tramitador y Tesorería.
// =====================================

const EMPRESA = { nombre: 'GOMEZ PINEDA ABOGADOS S.A.S', nit: '900.176.931' }
const NOTA_383 = 'Manifiesto bajo la gravedad de juramento que el servicio prestado cumple la definición de empleado establecida en el artículo 329 del Estatuto Tributario, y solicito que la retención en la fuente se practique conforme a la tabla del artículo 383 del Estatuto Tributario. Declaro, además, que el 80% o más de mis ingresos provienen de la presente relación contractual.'
const CONDICIONES = [
  'Los valores aquí relacionados corresponden exclusivamente a los servicios previamente pactados entre las partes.',
  'Cualquier cobro adicional por conceptos no contemplados en la negociación inicial deberá estar debidamente soportado (ejemplo: constancias, comprobantes, aprobaciones previas).',
  'El presente anexo hace parte integral de la Cuenta de Cobro arriba mencionada y debe ser firmado por el tramitador como constancia de veracidad de la información.',
  'La empresa se reserva el derecho de verificación de la documentación que respalde los trámites aquí relacionados.'
]

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const fechaLarga = (fecha: string) => {
  const [a, m, d] = fecha.split('-')
  return `${d} de ${MESES[Number(m) - 1]} de ${a}`
}
const fechaCorta = (fecha: string) => fecha.split('-').reverse().join('/')
const fechaBogota = (fecha: Date) => fecha.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
const pesos = (centavos: number) => `$${Math.round(centavos / 100).toLocaleString('es-CO')}`

const NEGRO = rgb(0, 0, 0)
const GRIS = rgb(0.35, 0.35, 0.35)
const BORDE = rgb(0.55, 0.55, 0.55)
const FONDO = rgb(0.9, 0.9, 0.9)
const OSCURO = rgb(0.33, 0.33, 0.33)
const ANCHO = 595.28
const ALTO = 841.89
const MARGEN = 50

type Fuentes = { normal: PDFFont, negrita: PDFFont }

// Corta el texto en renglones que caben en el ancho
const renglones = (texto: string, fuente: PDFFont, tamano: number, ancho: number) => {
  const salida: string[] = []
  for (const parrafo of texto.split('\n')) {
    let actual = ''
    for (const palabra of parrafo.split(/\s+/).filter(Boolean)) {
      const prueba = actual ? `${actual} ${palabra}` : palabra
      if (fuente.widthOfTextAtSize(prueba, tamano) <= ancho) actual = prueba
      else {
        if (actual) salida.push(actual)
        actual = palabra
      }
    }
    salida.push(actual)
  }
  return salida
}

// Texto que no cabe se recorta con puntos suspensivos (celdas de una línea)
const recortar = (texto: string, fuente: PDFFont, tamano: number, ancho: number) => {
  if (fuente.widthOfTextAtSize(texto, tamano) <= ancho) return texto
  let corto = texto
  while (corto.length > 1 && fuente.widthOfTextAtSize(`${corto}…`, tamano) > ancho) corto = corto.slice(0, -1)
  return `${corto}…`
}

const texto = (pagina: PDFPage, valor: string, x: number, y: number, fuente: PDFFont, tamano = 10, color = NEGRO) =>
  pagina.drawText(valor, { x, y, size: tamano, font: fuente, color })

const centrado = (pagina: PDFPage, valor: string, y: number, fuente: PDFFont, tamano: number, x0 = 0, ancho = ANCHO) =>
  texto(pagina, valor, x0 + (ancho - fuente.widthOfTextAtSize(valor, tamano)) / 2, y, fuente, tamano)

const derecha = (pagina: PDFPage, valor: string, xDerecha: number, y: number, fuente: PDFFont, tamano = 10) =>
  texto(pagina, valor, xDerecha - fuente.widthOfTextAtSize(valor, tamano), y, fuente, tamano)

const caja = (pagina: PDFPage, x: number, y: number, ancho: number, alto: number, relleno?: ReturnType<typeof rgb>) =>
  pagina.drawRectangle({ x, y, width: ancho, height: alto, borderColor: BORDE, borderWidth: 0.7, color: relleno })

const marco = (pagina: PDFPage) => pagina.drawRectangle({ x: 25, y: 25, width: ANCHO - 50, height: ALTO - 50, borderColor: NEGRO, borderWidth: 1 })

// Datos que necesita el PDF
const cargarCuenta = async (id: number) => {
  const cuenta = await buscarCuenta(id)
  const lineas = await lineasDe(cuenta.id)
  const datos = cuenta.datosTramitador ?? datosDelTramitador(cuenta.tramitador)
  let firma: Buffer | null = null
  if (cuenta.firmaRuta && cuenta.firmaNombre) firma = await obtenerArchivo(cuenta.firmaRuta, cuenta.firmaNombre).catch(() => null)
  const solicitante = cuenta.vistoBuenoPor ?? cuenta.enviadaPor
  const usuario = solicitante ? await Usuarios.findByPk(solicitante, { attributes: ['nombreUsuario'] }) : null
  // Fecha del documento: la de la aprobación del tramitador; antes, la del envío (o hoy en el borrador)
  const fecha = fechaBogota(cuenta.aprobadaEn ?? cuenta.enviadaEn ?? new Date())
  return { cuenta, lineas, datos, firma, fecha, solicitante: usuario?.nombreUsuario ?? '' }
}

type Cargada = Awaited<ReturnType<typeof cargarCuenta>>

const firmar = async (pdf: PDFDocument, pagina: PDFPage, firma: Buffer | null, x: number, y: number) => {
  if (!firma) return
  const imagen = await pdf.embedPng(firma)
  const escala = Math.min(170 / imagen.width, 60 / imagen.height)
  pagina.drawImage(imagen, { x, y, width: imagen.width * escala, height: imagen.height * escala })
}

// ── Página 1: cuenta de cobro ──
const paginaCuenta = async (pdf: PDFDocument, f: Fuentes, { cuenta, datos, firma, fecha }: Cargada, numero: string) => {
  const p = pdf.addPage([ANCHO, ALTO])
  marco(p)
  let y = ALTO - 90
  texto(p, `${datos.ciudad ?? ''}, ${fechaLarga(fecha)}`, MARGEN + 20, y, f.negrita, 11)

  y -= 40
  centrado(p, 'Cuenta de cobro N°', y, f.negrita, 11, 0, ANCHO - 80)
  caja(p, ANCHO / 2 + 40, y - 6, 80, 22)
  centrado(p, numero, y, f.normal, 10, ANCHO / 2 + 40, 80)

  y -= 40
  centrado(p, EMPRESA.nombre, y, f.negrita, 11)
  centrado(p, `NIT ${EMPRESA.nit}`, y - 14, f.negrita, 11)
  y -= 44
  centrado(p, 'Debe a:', y, f.negrita, 11)

  const campos: [string, string][] = [
    ['Nombre:', datos.nombre],
    ['Identificación:', datos.identificacion],
    ['Dirección:', datos.direccion ?? ''],
    ['Email:', datos.correo ?? ''],
    ['Teléfono:', datos.telefono ?? '']
  ]
  y -= 30
  for (const [etiqueta, valor] of campos) {
    derecha(p, etiqueta, 238, y, f.negrita, 11)
    caja(p, 245, y - 7, 260, 22)
    texto(p, recortar(valor, f.normal, 10, 250), 250, y, f.normal, 10)
    y -= 30
  }

  y -= 20
  const total = Number(cuenta.total)
  caja(p, MARGEN + 20, y - 7, 300, 22)
  texto(p, recortar(pesosEnLetras(total / 100), f.normal, 10, 290), MARGEN + 25, y, f.normal, 10)
  texto(p, 'M/L $', 385, y, f.negrita, 11)
  caja(p, 420, y - 7, 105, 22)
  texto(p, Math.round(total / 100).toLocaleString('es-CO'), 425, y, f.normal, 10)

  y -= 26
  centrado(p, 'Por Concepto de:', y, f.negrita, 11)
  y -= 8
  caja(p, MARGEN + 20, y - 48, ANCHO - 2 * MARGEN - 40, 48)
  texto(p, 'Gestión de Trámites. Ver detalle en anexo 1.', MARGEN + 25, y - 14, f.normal, 10)

  y -= 85
  const cuentaBanco = [datos.numeroCuenta, datos.banco, datos.tipoCuenta && datos.tipoCuenta !== 'BILLETERA' ? datos.tipoCuenta.toLowerCase() : null].filter(Boolean).join(' ')
  texto(p, 'Favor consignar a la cuenta', MARGEN + 20, y, f.normal, 10)
  texto(p, 'N°', 205, y, f.negrita, 10)
  caja(p, 222, y - 7, 210, 22)
  texto(p, recortar(cuentaBanco, f.normal, 10, 200), 227, y, f.normal, 10)
  texto(p, 'a', 470, y, f.normal, 10)
  texto(p, 'Nombre de', MARGEN + 20, y - 12, f.normal, 10)
  y -= 34
  caja(p, MARGEN + 20, y - 7, ANCHO - 2 * MARGEN - 40, 20)
  texto(p, datos.nombre, MARGEN + 25, y, f.normal, 10)

  y -= 36
  if (datos.declaracionArt383 !== false) {
    const lineasNota = renglones(`Nota: ${NOTA_383}`, f.normal, 9.5, ANCHO - 2 * MARGEN - 40)
    lineasNota.forEach((linea, i) => {
      if (i === 0) {
        texto(p, 'Nota:', MARGEN + 20, y, f.negrita, 9.5)
        texto(p, linea.slice(5), MARGEN + 20 + f.negrita.widthOfTextAtSize('Nota:', 9.5), y, f.normal, 9.5)
      } else texto(p, linea, MARGEN + 20, y, f.normal, 9.5)
      y -= 12
    })
  }

  y -= 14
  texto(p, 'Cordialmente,', MARGEN + 20, y, f.negrita, 11)
  await firmar(pdf, p, firma, MARGEN + 20, y - 72)
  y -= 92
  texto(p, `Nombre: ${datos.nombre}`, MARGEN + 20, y, f.negrita, 11)
  texto(p, `Identificación: ${datos.identificacion}`, MARGEN + 20, y - 20, f.negrita, 11)
  if (!firma) texto(p, cuenta.estado === ESTADOS.BORRADOR || cuenta.estado === ESTADOS.POR_CORREGIR ? 'BORRADOR · sin firma' : 'Pendiente de la firma del tramitador', MARGEN + 20, y + 40, f.normal, 9, GRIS)
}

// ── Anexo 1 (una o varias páginas) ──
const paginasAnexo = async (pdf: PDFDocument, f: Fuentes, { lineas, datos, firma, fecha }: Cargada, numero: string) => {
  const grupos = agruparPorTramite(lineas)
  const fechasTramite = lineas.filter(l => l.tipo === 'TRAMITE').map(l => l.fecha).sort()
  const periodo = fechasTramite.length ? `Del ${fechaCorta(fechasTramite[0])} al ${fechaCorta(fechasTramite[fechasTramite.length - 1])}` : ''

  // Columnas: #, consecutivo, placa, detalle, fecha, valor
  const X = [30, 62, 132, 222, 395, 470, ANCHO - 30]
  const tamano = 8.5
  let p!: PDFPage
  let y = 0

  const nuevaPagina = (primera: boolean) => {
    p = pdf.addPage([ANCHO, ALTO])
    marco(p)
    y = ALTO - 80
    centrado(p, primera ? 'ANEXO 1 – DETALLE DE TRÁMITES FACTURADOS' : 'ANEXO 1 – DETALLE DE TRÁMITES FACTURADOS (continuación)', y, f.negrita, 10)
    y -= 30
    texto(p, `Anexo Cuenta de Cobro Nº ${numero}`, MARGEN + 20, y, f.negrita, 10)
    texto(p, `Tramitador: ${datos.nombre}`, MARGEN + 20, y - 18, f.negrita, 10)
    texto(p, 'Periodo Trámites Finalizados:', MARGEN + 20, y - 36, f.negrita, 10)
    texto(p, periodo, MARGEN + 20 + f.negrita.widthOfTextAtSize('Periodo Trámites Finalizados:', 10) + 4, y - 36, f.normal, 10)
    y -= 60
    // Encabezado de la tabla
    const titulos = ['#', 'Consecutivo del Trámite', 'Placa y/o Matrícula Inmobiliaria', 'Detalle del trámite', 'Fecha de realización', 'Valor del servicio']
    const alto = 34
    titulos.forEach((t, i) => {
      caja(p, X[i], y - alto, X[i + 1] - X[i], alto)
      renglones(t, f.negrita, 8, X[i + 1] - X[i] - 6).forEach((r, j) => centrado(p, r, y - 12 - j * 9, f.negrita, 8, X[i], X[i + 1] - X[i]))
    })
    y -= alto
  }

  nuevaPagina(true)
  grupos.forEach((grupo, indice) => {
    const varias = grupo.lineas.length > 1
    const alto = Math.max(18, grupo.lineas.length * 13 + 6)
    if (y - alto < 200) nuevaPagina(false)
    for (let i = 0; i < 6; i++) caja(p, X[i], y - alto, X[i + 1] - X[i], alto)
    derecha(p, `${indice + 1})`, X[1] - 4, y - 12, f.normal, tamano)
    centrado(p, String(grupo.tramiteId), y - 12, f.normal, tamano, X[1], X[2] - X[1])
    centrado(p, recortar(grupo.placa ?? '', f.normal, tamano, X[3] - X[2] - 6), y - 12, f.normal, tamano, X[2], X[3] - X[2])
    grupo.lineas.forEach((l, j) => {
      const yy = y - 12 - j * 13
      const prefijo = varias ? `${j + 1}) ` : ''
      centrado(p, recortar(`${prefijo}${l.concepto}`, f.normal, tamano, X[4] - X[3] - 6), yy, f.normal, tamano, X[3], X[4] - X[3])
      centrado(p, `${prefijo}${fechaCorta(l.fecha)}`, yy, f.normal, tamano, X[4], X[5] - X[4])
      derecha(p, `${prefijo}${pesos(l.valor)}`, X[6] - 8, yy, f.normal, tamano)
    })
    y -= alto
  })

  if (y < 260) nuevaPagina(false)
  caja(p, X[4], y - 22, X[5] - X[4], 22)
  caja(p, X[5], y - 22, X[6] - X[5], 22)
  centrado(p, 'Total', y - 14, f.negrita, 10, X[4], X[5] - X[4])
  derecha(p, pesos(lineas.reduce((a, l) => a + Number(l.valor), 0)), X[6] - 8, y - 14, f.negrita, 10)
  y -= 50

  texto(p, 'Condiciones', MARGEN + 20, y, f.negrita, 10)
  y -= 14
  CONDICIONES.forEach((condicion, i) => {
    renglones(condicion, f.normal, 9, ANCHO - 2 * MARGEN - 70).forEach((r, j) => {
      if (j === 0) texto(p, `${i + 1}.`, MARGEN + 30, y, f.normal, 9)
      texto(p, r, MARGEN + 45, y, f.normal, 9)
      y -= 11
    })
    y -= 5
  })

  y -= 10
  await firmar(pdf, p, firma, MARGEN + 20, y - 62)
  y -= 78
  texto(p, 'Firma del tramitador:', MARGEN + 20, y, f.negrita, 10)
  texto(p, 'C.C. / NIT:', MARGEN + 20, y - 18, f.negrita, 10)
  texto(p, datos.identificacion, MARGEN + 20 + f.negrita.widthOfTextAtSize('C.C. / NIT:', 10) + 4, y - 18, f.normal, 10)
  texto(p, 'Fecha:', MARGEN + 20, y - 36, f.negrita, 10)
  texto(p, fechaCorta(fecha).replace(/\//g, ' / '), MARGEN + 20 + f.negrita.widthOfTextAtSize('Fecha:', 10) + 4, y - 36, f.normal, 10)
}

// ── Formato de distribución de centros de costos ──
const paginaDistribucion = (pdf: PDFDocument, f: Fuentes, { lineas, datos, fecha, solicitante }: Cargada, numero: string) => {
  const p = pdf.addPage([ANCHO, ALTO])
  const izq = 40
  const der = ANCHO - 40
  let y = ALTO - 50

  // Encabezado: nombre de la empresa, título y control del formato
  caja(p, izq, y - 60, 130, 60)
  centrado(p, 'GÓMEZ PINEDA', y - 26, f.negrita, 11, izq, 130)
  centrado(p, 'ABOGADOS', y - 40, f.normal, 8, izq, 130)
  caja(p, izq + 130, y - 60, 250, 60, OSCURO)
  p.drawText('FORMATO DISTRIBUCIÓN DE CENTROS DE COSTOS', {
    x: izq + 130 + (250 - f.negrita.widthOfTextAtSize('FORMATO DISTRIBUCIÓN DE CENTROS DE COSTOS', 9)) / 2, y: y - 34, size: 9, font: f.negrita, color: rgb(1, 1, 1)
  })
  const control = ['Versión: 001', 'Código: GA-F-GCO 0101', 'Fecha de aprobación: 01/03/2021']
  control.forEach((t, i) => {
    caja(p, izq + 380, y - 20 * (i + 1), der - izq - 380, 20)
    texto(p, t, izq + 384, y - 20 * (i + 1) + 6, f.normal, 8.5)
  })

  y -= 90
  const fila = (etiqueta: string, valor: string, x: number, ancho: number, yy: number) => {
    caja(p, x, yy - 18, 115, 18, OSCURO)
    p.drawText(etiqueta, { x: x + 4, y: yy - 13, size: 8.5, font: f.negrita, color: rgb(1, 1, 1) })
    caja(p, x + 115, yy - 18, ancho - 115, 18)
    centrado(p, recortar(valor, f.normal, 8.5, ancho - 125), yy - 13, f.normal, 8.5, x + 115, ancho - 115)
  }
  fila('Fecha:', fechaCorta(fecha), izq, 300, y)
  fila('Nombre de quien solicita:', solicitante, izq, 300, y - 18)

  y -= 52
  const total = lineas.reduce((a, l) => a + Number(l.valor), 0)
  fila('Nombre del proveedor:', datos.nombre, izq, 300, y)
  fila('NIT:', datos.identificacion, izq, 300, y - 18)
  fila('Servicio o compra:', `Gestión de trámites · Cuenta ${numero}`, izq, 300, y - 36)
  const xT = izq + 320
  const totales = [['Subtotal:', pesos(total)], ['IVA:', ''], ['Total:', pesos(total)]]
  totales.forEach(([e, v], i) => {
    caja(p, xT, y - 18 * (i + 1), 70, 18, FONDO)
    texto(p, e, xT + 4, y - 18 * (i + 1) + 5, f.negrita, 8.5)
    caja(p, xT + 70, y - 18 * (i + 1), der - xT - 70, 18)
    derecha(p, v, der - 6, y - 18 * (i + 1) + 5, f.normal, 8.5)
  })

  y -= 80
  const C = [izq, izq + 110, izq + 360, der]
  const titulos = ['% Distribución', 'Centro de costos', 'Valor']
  titulos.forEach((t, i) => {
    caja(p, C[i], y - 18, C[i + 1] - C[i], 18, FONDO)
    centrado(p, t, y - 13, f.negrita, 9, C[i], C[i + 1] - C[i])
  })
  y -= 18
  const distribucion = distribucionDe(lineas)
  const filas = Math.max(8, distribucion.length)
  for (let i = 0; i < filas; i++) {
    const d = distribucion[i]
    for (let j = 0; j < 3; j++) caja(p, C[j], y - 16, C[j + 1] - C[j], 16)
    if (d) {
      centrado(p, `${d.porcentaje.toLocaleString('es-CO', { maximumFractionDigits: 2 })}%`, y - 11, f.normal, 8.5, C[0], C[1] - C[0])
      centrado(p, recortar(d.centroCostos, f.normal, 8.5, C[2] - C[1] - 8), y - 11, f.normal, 8.5, C[1], C[2] - C[1])
      derecha(p, pesos(d.valor), C[3] - 6, y - 11, f.normal, 8.5)
    }
    y -= 16
  }
  const repartido = distribucion.reduce((a, d) => a + d.valor, 0)
  const cierre = [['Total:', pesos(repartido)], ['Validación:', pesos(total - repartido)]]
  cierre.forEach(([e, v]) => {
    caja(p, C[2] - 100, y - 16, 100, 16, FONDO)
    texto(p, e, C[2] - 96, y - 11, f.negrita, 8.5)
    caja(p, C[2], y - 16, C[3] - C[2], 16, FONDO)
    derecha(p, v, C[3] - 6, y - 11, f.negrita, 8.5)
    y -= 16
  })
}

export const generarPdfCuenta = async (id: number) => {
  const cargada = await cargarCuenta(id)
  const numero = numeroCuentaTramitador(cargada.cuenta.consecutivo)
  const pdf = await PDFDocument.create()
  pdf.setTitle(`Cuenta de cobro ${numero}`)
  const fuentes = { normal: await pdf.embedFont(StandardFonts.Helvetica), negrita: await pdf.embedFont(StandardFonts.HelveticaBold) }

  await paginaCuenta(pdf, fuentes, cargada, numero)
  await paginasAnexo(pdf, fuentes, cargada, numero)
  paginaDistribucion(pdf, fuentes, cargada, numero)

  const nombre = `Cuenta de cobro ${numero} - ${cargada.datos.nombre}.pdf`
  return { contenido: Buffer.from(await pdf.save()), nombre, tramitadorId: cargada.cuenta.tramitadorId, estado: cargada.cuenta.estado }
}
