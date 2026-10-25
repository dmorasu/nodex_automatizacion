import { notificationQueue } from '../../queues/notificacionesQueues'
import Notificacion from '../../models/notificaciones'
import Usuarios from '../../models/usuarios'
import Tramitador from '../../models/tramitador'
import CuentaCobroTramitador, { numeroCuentaTramitador } from '../../models/cuentasCobroTramitador/cuentaCobroTramitador'
import { enviarAvisoTramitador } from '../tramitadores/avisosPush'
import { correoBase, ficha, html, MARCAS, nota, type Tono } from '../template/correoBase'
import { pesos } from './cuentasCobro'

// =====================================
// AVISOS DE LAS CUENTAS DE COBRO DE TRAMITADORES
// Push en la app y correo al tramitador; correo al analista que la envió (con copia a Torre de
// control) cuando el tramitador responde; correo a Tesorería con el visto bueno de la semana.
// Se llaman después de guardar y nunca lanzan: un aviso no debe frenar la operación.
// =====================================

const correoTorreControl = () => process.env.CORREO_TORRE_CONTROL || 'torredecontrol@gomezpinedaabogados.com'
const correoTesoreria = () => process.env.CORREO_TESORERIA || 'grupotesoreria@gomezpinedaabogados.com'
const url = (variable: string, ruta: string) => {
  const base = process.env[variable]?.replace(/\/+$/, '')
  return base ? `${base}${ruta}` : null
}

const encolar = async (tipo: string, to: string, subject: string, mensaje: string, ccTorreControl: boolean) => {
  const notificacion = await Notificacion.create({ solicitudTramiteId: null, tipo, canal: 'EMAIL', destinatario: to, mensaje, estado: 'PENDIENTE' })
  await notificationQueue.add('send', { notificacionId: notificacion.id, canal: 'EMAIL', to, subject, message: mensaje, ccTorreControl })
}

const sinError = (nombre: string, fn: () => Promise<unknown>) =>
  fn().catch(error => console.error(`⚠️ Aviso de cuenta de cobro (${nombre}):`, error))

const cargar = async (cuentaId: number) => {
  const cuenta = await CuentaCobroTramitador.findByPk(cuentaId, { include: [{ model: Tramitador, attributes: ['id', 'nombreTramitador', 'correoTramitador'] }] })
  if (!cuenta) return null
  return { cuenta, numero: numeroCuentaTramitador(cuenta.consecutivo), nombre: cuenta.tramitador.nombreTramitador.trim() }
}

// Al tramitador: push y correo
const avisarTramitador = async (cuentaId: number, contenido: { titulo: string, cuerpoPush: string, tono: Tono, estado: string, intro: string, notaTexto?: string }) => {
  const datos = await cargar(cuentaId)
  if (!datos) return
  const { cuenta, numero, nombre } = datos
  await enviarAvisoTramitador(cuenta.tramitadorId, {
    titulo: contenido.titulo,
    cuerpo: contenido.cuerpoPush,
    url: `/cuentas-cobro/${cuenta.id}`,
    etiqueta: `cuenta-cobro-${cuenta.id}`
  })
  const correo = cuenta.tramitador.correoTramitador?.trim()
  if (!correo) return
  const mensaje = correoBase({
    marca: MARCAS.TRAMITES,
    estado: { texto: contenido.estado, tono: contenido.tono },
    titulo: contenido.titulo,
    saludo: `Hola <strong>${html(nombre)}</strong>,`,
    intro: contenido.intro,
    cuerpo: ficha({ titulo: `Cuenta de cobro ${numero}`, valor: pesos(cuenta.total), detalles: [['Estado', html(contenido.estado)]] }) +
      (contenido.notaTexto ? nota('neutro', html(contenido.notaTexto)) : ''),
    boton: { texto: 'Abrir la app', url: url('URL_NODEX_TRAMITADORES', `/cuentas-cobro/${cuenta.id}`) }
  })
  await encolar('CUENTA_COBRO_TRAMITADOR', correo, `${contenido.titulo} · ${numero}`, mensaje, false)
}

export const avisarEnviada = (cuentaId: number) => sinError('enviada', () => avisarTramitador(cuentaId, {
  titulo: 'Tiene una cuenta de cobro por aprobar',
  cuerpoPush: 'Revísela, descárguela y apruébela o pida corrección',
  tono: 'info',
  estado: 'Por aprobar',
  intro: 'Torre de control preparó su cuenta de cobro con los trámites finalizados. Revísela en la app: si está bien, apruébela con su firma; si no, pida la corrección.'
}))

export const avisarRetirada = (cuentaId: number, anulada: boolean, motivo: string) => sinError('retirada', () => avisarTramitador(cuentaId, {
  titulo: anulada ? 'Su cuenta de cobro fue anulada' : 'Su cuenta de cobro se está corrigiendo',
  cuerpoPush: anulada ? 'Los trámites entrarán en una cuenta nueva' : 'Torre de control se la enviará de nuevo',
  tono: 'alerta',
  estado: anulada ? 'Anulada' : 'En corrección',
  intro: anulada ? 'Torre de control anuló la cuenta. Sus trámites entrarán en una cuenta nueva.' : 'Torre de control retiró la cuenta para corregirla y se la enviará de nuevo.',
  notaTexto: motivo || undefined
}))

export const avisarEnTesoreria = (cuentaId: number) => sinError('tesorería', () => avisarTramitador(cuentaId, {
  titulo: 'Su cuenta de cobro pasó a pago',
  cuerpoPush: 'Torre de control dio el visto bueno: está en Tesorería',
  tono: 'exito',
  estado: 'En Tesorería',
  intro: 'Torre de control dio el visto bueno a su cuenta de cobro y pasó a Tesorería para el pago.'
}))

export const avisarPagadaTramitador = (cuentaId: number) => sinError('pagada', () => avisarTramitador(cuentaId, {
  titulo: 'Su cuenta de cobro fue pagada',
  cuerpoPush: 'Tesorería registró el pago',
  tono: 'exito',
  estado: 'Pagada',
  intro: 'Tesorería registró el pago de su cuenta de cobro.'
}))

// Al analista que la envió (con copia a Torre de control): el tramitador aprobó, pidió corrección
// o agregó un adicional con soporte (las dos últimas devuelven la cuenta al analista)
type Respuesta = 'APROBADA' | 'CORRECCION' | 'ADICIONAL'
const RESPUESTAS: Record<Respuesta, { verbo: string, estado: string, tono: Tono, notaTitulo: string, tipo: string }> = {
  APROBADA: { verbo: 'aprobó su cuenta de cobro', estado: 'Aprobada por el tramitador', tono: 'exito', notaTitulo: '', tipo: 'CUENTA_COBRO_APROBADA' },
  CORRECCION: { verbo: 'pidió corregir su cuenta de cobro', estado: 'Por corregir', tono: 'alerta', notaTitulo: 'Lo que pide corregir', tipo: 'CUENTA_COBRO_CORRECCION' },
  ADICIONAL: { verbo: 'agregó un adicional a su cuenta de cobro', estado: 'Por revisar', tono: 'alerta', notaTitulo: 'Adicional', tipo: 'CUENTA_COBRO_ADICIONAL' }
}

export const avisarRespuestaTramitador = (cuentaId: number, respuesta: Respuesta, comentario?: string) => sinError('respuesta', async () => {
  const datos = await cargar(cuentaId)
  if (!datos) return
  const { cuenta, numero, nombre } = datos
  const analista = cuenta.enviadaPor ? await Usuarios.findByPk(cuenta.enviadaPor, { attributes: ['nombreUsuario', 'correoUsuario'] }) : null
  const conAnalista = Boolean(analista?.correoUsuario)
  const r = RESPUESTAS[respuesta]
  const aprobada = respuesta === 'APROBADA'
  const titulo = `${nombre} ${r.verbo}`
  const mensaje = correoBase({
    marca: MARCAS.TRAMITES,
    estado: { texto: r.estado, tono: r.tono },
    titulo,
    saludo: conAnalista ? `Hola <strong>${html(analista!.nombreUsuario)}</strong>,` : 'Hola Torre de Control,',
    intro: aprobada
      ? 'La cuenta queda lista para el visto bueno de la semana en Cuentas de cobro.'
      : 'La cuenta volvió a "Por corregir" en Cuentas de cobro.',
    cuerpo: ficha({ titulo: `Cuenta de cobro ${numero}`, valor: pesos(cuenta.total), detalles: [['Tramitador', html(nombre)]] }) +
      (comentario ? nota('alerta', html(comentario).replace(/\n/g, '<br>'), r.notaTitulo) : ''),
    boton: { texto: 'Ver la cuenta', url: url('URL_NODEX_TRAMITES', `/center/cuentasCobro?cuenta=${cuenta.id}`) }
  })
  await encolar(r.tipo, conAnalista ? analista!.correoUsuario : correoTorreControl(), `${titulo} · ${numero}`, mensaje, conAnalista)
})

// A Tesorería: las cuentas que recibieron el visto bueno (un correo por visto bueno)
export const avisarTesoreria = (cuentaIds: number[], usuarioNombre: string) => sinError('tesorería', async () => {
  const cuentas = await CuentaCobroTramitador.findAll({
    where: { id: cuentaIds },
    include: [{ model: Tramitador, attributes: ['nombreTramitador'] }],
    order: [['consecutivo', 'ASC']]
  })
  if (cuentas.length === 0) return
  const total = cuentas.reduce((a, c) => a + Number(c.total), 0)
  const lista = cuentas.map(c => `• <strong>${numeroCuentaTramitador(c.consecutivo)}</strong> · ${html(c.tramitador.nombreTramitador.trim())} · ${pesos(c.total)}`).join('<br>')
  const titulo = cuentas.length === 1 ? 'Cuenta de cobro de tramitador para pago' : `${cuentas.length} cuentas de cobro de tramitadores para pago`
  const mensaje = correoBase({
    marca: MARCAS.GASTOS,
    estado: { texto: 'Pendiente de pago', tono: 'info' },
    titulo,
    saludo: 'Hola Tesorería,',
    intro: `${html(usuarioNombre)} dio el visto bueno en Torre de control. Cada cuenta tiene su PDF con el anexo y el formato de distribución de centros de costos.`,
    cuerpo: ficha({ titulo: 'Total', valor: pesos(total), detalles: [] }) + nota('neutro', lista, 'Cuentas'),
    boton: { texto: 'Abrir en Nodex Gastos', url: url('URL_NODEX_GASTOS', '/tesoreria/cuentas-tramitadores') }
  })
  await encolar('CUENTA_COBRO_TESORERIA', correoTesoreria(), titulo, mensaje, false)
})

// A quien dio el visto bueno: Tesorería la pagó
export const avisarPagadaTorre = (cuentaId: number) => sinError('pagada torre', async () => {
  const datos = await cargar(cuentaId)
  if (!datos?.cuenta.vistoBuenoPor) return
  const { cuenta, numero, nombre } = datos
  const usuario = await Usuarios.findByPk(cuenta.vistoBuenoPor!, { attributes: ['nombreUsuario', 'correoUsuario'] })
  if (!usuario?.correoUsuario) return
  const mensaje = correoBase({
    marca: MARCAS.TRAMITES,
    estado: { texto: 'Pagada', tono: 'exito' },
    titulo: `Tesorería pagó la cuenta ${numero}`,
    saludo: `Hola <strong>${html(usuario.nombreUsuario)}</strong>,`,
    intro: `La cuenta de cobro de ${html(nombre)} quedó pagada${cuenta.fechaPago ? ` el ${cuenta.fechaPago}` : ''}.`,
    cuerpo: ficha({ titulo: `Cuenta de cobro ${numero}`, valor: pesos(cuenta.total), detalles: [['Tramitador', html(nombre)]] }),
    boton: { texto: 'Ver la cuenta', url: url('URL_NODEX_TRAMITES', `/center/cuentasCobro?cuenta=${cuenta.id}`) }
  })
  await encolar('CUENTA_COBRO_PAGADA', usuario.correoUsuario, `Cuenta de cobro pagada · ${numero}`, mensaje, false)
})
