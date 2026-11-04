// =====================================
// RÓTULO DE ENVÍO: REGLAS (Ayudas Torre de Control, fase 3, 2026-11-04)
// Lo que hacía el "Generador de rótulos" de Torre de control (manual de Milton Grandet del
// 2026-10-22): quién envía y quién recibe, quién paga el envío y a quién se factura, qué datos
// faltan y las observaciones de devolución. Función pura: los registros ya vienen cargados.
// =====================================

export const GPA = {
  razon: 'Gómez Pineda Abogados S.A.S',
  nit: '900176931-2',
  correo: 'facturacion@gomezpinedaabogados.com',
  obsHorario: 'Hacer la devolución solo en el horario de atención de Gómez Pineda Abogados: lunes de 7:00 a.m. a 5:00 p.m., martes a jueves de 7:30 a.m. a 5:00 p.m. y viernes de 7:30 a.m. a 4:00 p.m. No se reciben paquetes los sábados ni domingos.'
}

export const ORIGENES = ['gpa', 'tram'] as const
export const DESTINOS = ['cliente', 'tram', 'gpa', 'tercero'] as const
export type Origen = typeof ORIGENES[number]
export type Destino = typeof DESTINOS[number]

export const TIPOS_ENVIO = ['Sobre con Documentos', 'Sobre pequeño (Tarjeta de propiedad)', 'Caja']
export const CONTENIDOS = ['Documentos para Traspaso', 'Poder para firma de escritura', 'Placas vehiculares', 'Tarjeta de Propiedad', 'Autorización', 'Escritura Original', 'CTL original', 'Poder para compra de carpeta']
export const TRANSPORTADORAS_SUGERIDAS = ['Envía', 'Servientrega', 'Interrapidísimo', 'Coordinadora', 'Mensajero propio']

const NOMBRE_FLUJO: Record<string, string> = {
  'gpa-cliente': 'GPA a cliente', 'gpa-tram': 'GPA a tramitador', 'gpa-gpa': 'Entre oficinas GPA',
  'tram-gpa': 'Tramitador a GPA', 'tram-cliente': 'Tramitador a cliente', 'gpa-tercero': 'GPA a tercero'
}

// Un tramitador no le envía a otro tramitador ni a un tercero
export const flujoPermitido = (origen: Origen, destino: Destino) => !(origen === 'tram' && (destino === 'tram' || destino === 'tercero'))

export const normalizar = (texto: string | null | undefined) =>
  String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()

// "573157880283" o "3157880283" → "315 788 0283"
export const formatoTelefono = (valor: string | null | undefined) => {
  const digitos = String(valor ?? '').replace(/\D/g, '')
  const local = digitos.length === 12 && digitos.startsWith('57') ? digitos.slice(2) : digitos
  return local.length === 10 ? `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}` : String(valor ?? '').trim()
}

export const correoValido = (correo: string) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(correo)
export const esCorreoGpa = (correo: string) => /@gomezpinedaabogados\.com$/i.test(correo.trim())

export type SedeRotulo = { id: number, nombre: string, ciudad: string | null, direccion: string | null, celular: string | null, horario: string | null }
export type TramitadorRotulo = { id: number, nombre: string, cedula: string | null, celular: string | null, direccion: string | null, municipio: string | null, departamento: string | null, correo: string | null }

export type EntradaRotulo = {
  origen: Origen
  destino: Destino
  tramites: { id: number, placa?: string | null }[]
  tipo?: string | null
  contenido?: string | null
  detalle?: string | null
  operacionId?: number | null
  solicitante?: string | null
  transportadora?: string | null
  contraentrega?: boolean
  asegurado?: boolean
  valorDeclarado?: number | null
  remitente?: { sedeId?: number | null, contacto?: string | null, telefono?: string | null, tramitadorId?: number | null }
  destinatario?: {
    sedeId?: number | null, tramitadorId?: number | null, nombre?: string | null, documento?: string | null, contacto?: string | null,
    telefono?: string | null, correo?: string | null, direccion?: string | null, municipioId?: number | null
  }
  // null: las de siempre según el flujo; texto (aunque sea vacío): las que escribió el usuario
  observaciones?: string | null
  // null: carta, o pequeño si es un sobre de tarjeta de propiedad
  tamano?: 'carta' | 'peq' | null
}

export type ContextoRotulo = {
  sedes: SedeRotulo[]
  tramitadores: Map<number, TramitadorRotulo>
  operacion: { nombre: string, centroDeCostos: string | null } | null
  municipioDestino: { nombre: string, departamento: string } | null
}

export type Persona = { titulo: string, doc: string, linea2: string, dir: string, ciudad: string, contacto: string, tel: string }
export type Rotulo = {
  flujo: string
  origen: Origen
  destino: Destino
  tramites: { id: number, placa: string }[]
  tipo: string
  contenido: string
  detalle: string
  linea: string
  cc: string
  solicitante: string
  transportadora: string
  contraentrega: boolean
  asegurado: boolean
  valorDeclarado: number | null
  rem: Persona
  dest: Persona & { correo: string, dep: string }
  paga: 'GPA' | 'DESTINATARIO'
  pago: string
  factura: { nombre: string, identificacion: string, correo: string, esNit: boolean }
  tituloObservaciones: string
  observaciones: string
  tamano: 'carta' | 'peq'
  impreso: string
}

// Quién asume el envío:
//  - Postobón: siempre GPA (nunca se cobra al cliente).
//  - Entre oficinas y GPA → tercero (notarías, entidades): GPA.
//  - Tramitador → oficina GPA: GPA como destinatario (contraentrega en la oficina).
//  - GPA → cliente, GPA → tramitador y tramitador → cliente: si es contraentrega paga el
//    destinatario (obligatorios su identificación y su correo de facturación); si no, GPA.
export const reglaPago = (origen: Origen, destino: Destino, linea: string, contraentrega: boolean) => {
  const flujo = `${origen}-${destino}`
  const postobon = normalizar(linea).includes('POSTOBON')
  if (postobon) return { contraentrega: false, paga: 'GPA' as const, fijo: 'Postobón: siempre lo asume Gómez Pineda Abogados.', postobon }
  if (flujo === 'gpa-gpa') return { contraentrega: false, paga: 'GPA' as const, fijo: 'Entre oficinas lo asume la oficina GPA que envía.', postobon }
  if (flujo === 'gpa-tercero') return { contraentrega: false, paga: 'GPA' as const, fijo: 'Envíos a terceros los asume Gómez Pineda Abogados.', postobon }
  if (flujo === 'tram-gpa') return { contraentrega: true, paga: 'GPA' as const, fijo: 'Lo asume Gómez Pineda Abogados al recibirlo en la oficina.', postobon }
  return { contraentrega, paga: contraentrega ? 'DESTINATARIO' as const : 'GPA' as const, fijo: '', postobon }
}

const tamanoAutomatico = (tipo: string, contenido: string) =>
  /SOBRE PEQUENO/.test(normalizar(tipo)) || /TARJETA DE PROPIEDAD/.test(normalizar(contenido)) ? 'peq' : 'carta'

const sedeMedellin = (sedes: SedeRotulo[]) => sedes.find(s => normalizar(s.nombre).includes('MEDELLIN') || normalizar(s.ciudad).includes('MEDELLIN')) ?? sedes[0]
const una = (texto: string | null | undefined) => String(texto ?? '').replace(/\s+/g, ' ').trim()

// Observaciones de siempre: tramitador → cliente devuelve a la oficina de Medellín (paga GPA)
export const observacionesAutomaticas = (origen: Origen, destino: Destino, sedes: SedeRotulo[]) => {
  if (origen === 'tram' && destino === 'cliente') {
    const s = sedeMedellin(sedes)
    const tel = s?.celular ? ` · Tel. ${formatoTelefono(s.celular)}` : ''
    return `Devolver a ${GPA.razon} - ${s?.nombre ?? 'GPA Medellín'}: ${una(s?.direccion)}, ${s?.ciudad ?? 'Medellín'}${tel}. NO devolver al tramitador remitente. El costo del retorno lo asume Gómez Pineda Abogados: se paga contraentrega al recibirlo en la oficina de Medellín y la factura de la devolución debe expedirse a nombre de ${GPA.razon}, NIT ${GPA.nit}, correo ${GPA.correo}. Recepción: lunes de 7:00 a.m. a 5:00 p.m., martes a jueves de 7:30 a.m. a 5:00 p.m. y viernes de 7:30 a.m. a 4:00 p.m. No se reciben paquetes los sábados ni domingos.`
  }
  return GPA.obsHorario
}

const ciudadTramitador = (t: TramitadorRotulo) => [t.municipio, t.departamento].filter(Boolean).join(', ')

export const armarRotulo = (e: EntradaRotulo, ctx: ContextoRotulo, impreso = new Date()): { rotulo: Rotulo, faltan: string[] } => {
  const faltan: string[] = []
  const origen = e.origen, destino = e.destino
  if (!flujoPermitido(origen, destino)) faltan.push('Un tramitador no puede enviarle a otro tramitador ni a un tercero')

  const tramites = (e.tramites ?? []).map(t => ({ id: Number(t.id), placa: una(t.placa).toUpperCase() }))
  if (!tramites.length) faltan.push('Al menos un trámite de Nodex')

  const tipo = una(e.tipo), contenido = una(e.contenido), solicitante = una(e.solicitante)
  const linea = ctx.operacion?.nombre ?? ''
  const cc = ctx.operacion?.centroDeCostos ? String(ctx.operacion.centroDeCostos) : ''
  const sedes = ctx.sedes
  const sede = (id: number | null | undefined, porDefecto: number) => sedes.find(s => s.id === Number(id)) ?? sedes[porDefecto] ?? sedes[0]

  // ── Remitente ──
  let rem: Persona = { titulo: '', doc: '', linea2: '', dir: '', ciudad: '', contacto: '', tel: '' }
  if (origen === 'gpa') {
    const s = sede(e.remitente?.sedeId, 0)
    if (!s) faltan.push('Oficina GPA que envía')
    rem = {
      titulo: `${GPA.razon}${s ? ` · ${s.nombre}` : ''}`, doc: `NIT ${GPA.nit}`, linea2: '', dir: una(s?.direccion), ciudad: una(s?.ciudad),
      contacto: una(e.remitente?.contacto), tel: formatoTelefono(una(e.remitente?.telefono) || s?.celular)
    }
    if (!rem.contacto) faltan.push('Contacto remitente')
  } else {
    const t = e.remitente?.tramitadorId ? ctx.tramitadores.get(Number(e.remitente.tramitadorId)) : undefined
    if (!t) faltan.push('Tramitador que envía')
    else {
      const aCliente = destino === 'cliente'
      rem = {
        titulo: aCliente ? GPA.razon : t.nombre,
        doc: aCliente ? `NIT ${GPA.nit}` : (t.cedula ? `C.C. ${t.cedula}` : ''),
        linea2: aCliente ? `A través de: ${t.nombre}${t.cedula ? ` · C.C. ${t.cedula}` : ''}` : '',
        dir: una(t.direccion), ciudad: ciudadTramitador(t), contacto: t.nombre, tel: formatoTelefono(t.celular)
      }
      if (!rem.dir) faltan.push(`Dirección de ${t.nombre} (Catálogos → Tramitadores)`)
    }
  }

  // ── Destinatario ──
  const d = e.destinatario ?? {}
  let dest: Rotulo['dest'] = { titulo: '', doc: '', linea2: '', dir: '', ciudad: '', dep: '', contacto: '', tel: '', correo: '' }
  if (destino === 'cliente' || destino === 'tercero') {
    const m = ctx.municipioDestino
    dest = {
      titulo: una(d.nombre), doc: una(d.documento), linea2: '', contacto: una(d.contacto), tel: formatoTelefono(d.telefono),
      correo: una(d.correo), dir: una(d.direccion), ciudad: m?.nombre ?? '', dep: m?.departamento ?? ''
    }
    if (!dest.titulo) faltan.push('Nombre del destinatario')
    if (!dest.dir) faltan.push('Dirección del destinatario')
    if (!m) faltan.push('Municipio de destino')
    if (!dest.tel) faltan.push('Teléfono del destinatario')
  } else if (destino === 'tram') {
    const t = d.tramitadorId ? ctx.tramitadores.get(Number(d.tramitadorId)) : undefined
    if (!t) faltan.push('Tramitador que recibe')
    else {
      dest = {
        titulo: t.nombre, doc: t.cedula ? `C.C. ${t.cedula}` : '', linea2: '', contacto: t.nombre, tel: formatoTelefono(t.celular),
        dir: una(t.direccion), ciudad: t.municipio ?? '', dep: t.departamento ?? '', correo: una(d.correo)
      }
      if (!dest.dir) faltan.push(`Dirección de ${t.nombre} (Catálogos → Tramitadores)`)
    }
  } else {
    const s = sede(d.sedeId, 1)
    if (!s) faltan.push('Oficina GPA que recibe')
    dest = {
      titulo: `${GPA.razon}${s ? ` · ${s.nombre}` : ''}`, doc: `NIT ${GPA.nit}`, linea2: '', contacto: una(d.contacto),
      tel: formatoTelefono(d.telefono), dir: una(s?.direccion), ciudad: una(s?.ciudad), dep: '', correo: ''
    }
    if (!dest.contacto) faltan.push('Contacto que recibe en la oficina')
  }

  if (!tipo) faltan.push('Tipo de envío')
  if (!contenido) faltan.push('Contenido del envío')
  if (!ctx.operacion) faltan.push('Línea de negocio')
  if (!solicitante) faltan.push('Solicitante del envío')
  const asegurado = Boolean(e.asegurado)
  const valorDeclarado = asegurado && Number(e.valorDeclarado) > 0 ? Math.round(Number(e.valorDeclarado)) : null
  if (asegurado && !valorDeclarado) faltan.push('Valor declarado (envío asegurado)')

  // ── Quién paga y a quién se factura ──
  const regla = reglaPago(origen, destino, linea, Boolean(e.contraentrega))
  let pago: string, factura: Rotulo['factura']
  if (regla.paga === 'DESTINATARIO') {
    factura = { nombre: dest.titulo, identificacion: dest.doc.replace(/^(NIT|C\.C\.) /, ''), correo: dest.correo, esNit: false }
    if (!dest.doc) faltan.push('Identificación o NIT del destinatario (obligatorio en contraentrega)')
    if (!dest.correo) faltan.push('Correo de facturación del destinatario (obligatorio en contraentrega)')
    else if (!correoValido(dest.correo)) faltan.push('El correo de facturación del destinatario no es válido')
    else if (esCorreoGpa(dest.correo)) faltan.push('En contraentrega el correo de facturación debe ser del destinatario, no de Gómez Pineda Abogados')
    pago = 'Pago contraentrega: el costo de este envío lo asume el destinatario. Facturar a nombre del destinatario.'
  } else {
    factura = { nombre: GPA.razon, identificacion: GPA.nit, correo: GPA.correo, esNit: true }
    pago = regla.postobon ? 'Los envíos de Postobón los asume Gómez Pineda Abogados; por ningún motivo se cobran al cliente. Gasto reembolsable.'
      : origen === 'tram' && destino === 'gpa' ? 'El costo de este envío lo asume Gómez Pineda Abogados como destinatario (pago contraentrega en la oficina).'
        : 'El costo de este envío es asumido por Gómez Pineda Abogados; por ningún motivo se debe cobrar al destinatario.'
  }

  const devolucion = origen === 'gpa' || destino === 'gpa' || (origen === 'tram' && destino === 'cliente')
  const observaciones = e.observaciones == null ? observacionesAutomaticas(origen, destino, sedes) : String(e.observaciones).trim()

  return {
    faltan,
    rotulo: {
      flujo: NOMBRE_FLUJO[`${origen}-${destino}`] ?? '',
      origen, destino, tramites, tipo, contenido, detalle: una(e.detalle), linea, cc, solicitante,
      transportadora: una(e.transportadora),
      contraentrega: regla.contraentrega, asegurado, valorDeclarado,
      rem, dest, paga: regla.paga, pago, factura,
      tituloObservaciones: devolucion ? 'En caso de devolución' : 'Observaciones',
      observaciones,
      tamano: e.tamano === 'carta' || e.tamano === 'peq' ? e.tamano : tamanoAutomatico(tipo, contenido),
      impreso: impreso.toISOString()
    }
  }
}
