import type { Model, Transaction } from 'sequelize'
import SolicitudTramites from '../models/solicitudTramites'
import Programacion from '../models/programacion'
import Logistica from '../models/logistica'
import CuentaCobros from '../models/cuentaCobro'
import EstadosTramites from '../models/estadosTramites'
import SubEstadosSolicitud from '../models/subEstadosSolicitud'
import Trazabilidad from '../models/trazabilidad'
import HistorialTramite, { type CambioCampo } from '../models/historialTramite'
import Estados from '../models/estados'
import TiposRechazo from '../models/tiposRechazos'
import SubEstados from '../models/subEstados'
import Usuarios from '../models/usuarios'
import Tramitador from '../models/tramitador'
import Clientes from '../models/clientes'
import Tramite from '../models/tramite'
import Operaciones from '../models/operaciones'
import Entidad from '../models/entidad'
import Municipios from '../models/municipios'
import Transportadora from '../models/trasnportadora'
import DocumentoSolicitud from '../models/documentosSolicitud'
import ReporteRealizado from '../models/tramitadores/reporteRealizado'
import { contextoActual, type ContextoPeticion } from '../utils/contextoPeticion'

// =====================================
// HISTORIAL DEL TRÁMITE (línea de tiempo)
// Los cambios se capturan con hooks de los modelos, así quedan registrados vengan de donde
// vengan (formulario, gestión masiva, Excel, app del tramitador) sin tocar cada controlador.
// Quién los hizo sale del contexto de la petición (utils/contextoPeticion).
// =====================================

type Formato = 'texto' | 'fecha' | 'fechaHora' | 'moneda' | 'siNo'

type Referencia = { buscar: (id: number) => Promise<string | null | undefined> }

type Campo = { etiqueta: string, formato?: Formato, referencia?: Referencia }

const nombreDe = <T extends Model>(modelo: { findByPk: (id: number, o: object) => Promise<T | null> }, atributo: string): Referencia => ({
  buscar: async id => {
    const fila = await modelo.findByPk(id, { attributes: ['id', atributo] })
    return fila ? String(fila.get(atributo) ?? '').trim() : null
  }
})

const REF = {
  tramitador: nombreDe(Tramitador, 'nombreTramitador'),
  usuario: nombreDe(Usuarios, 'nombreUsuario'),
  cliente: nombreDe(Clientes, 'nombreCliente'),
  tramite: nombreDe(Tramite, 'nombreTramite'),
  operacion: nombreDe(Operaciones, 'nombreOperacion'),
  entidad: nombreDe(Entidad, 'nombreEntidad'),
  municipio: nombreDe(Municipios, 'nombreMunicipio'),
  transportadora: nombreDe(Transportadora, 'nombreTransportadora'),
  estado: nombreDe(Estados, 'nombreEstado'),
  rechazo: nombreDe(TiposRechazo, 'nombre'),
  subestado: nombreDe(SubEstados, 'nombre')
}

// Campos del trámite que se registran. El tramitador y el analista van en su propia sección
// (cambian solos y son lo que más se consulta). No se registran el estado actual (ya queda en
// EstadosTramites) ni la ubicación en el mapa.
const CAMPOS_DATOS: Record<string, Campo> = {
  clienteId: { etiqueta: 'Cliente', referencia: REF.cliente },
  tramiteId: { etiqueta: 'Tipo de trámite', referencia: REF.tramite },
  operacionesId: { etiqueta: 'Operación', referencia: REF.operacion },
  entidadId: { etiqueta: 'Entidad', referencia: REF.entidad },
  municipiosId: { etiqueta: 'Municipio', referencia: REF.municipio },
  direccionTramite: { etiqueta: 'Dirección' },
  detalleSolicitud: { etiqueta: 'Detalle' },
  descripcionTramite: { etiqueta: 'Descripción' },
  documentosAportados: { etiqueta: 'Documentos aportados' },
  placa: { etiqueta: 'Placa' },
  matriculaInmobiliaria: { etiqueta: 'Matrícula inmobiliaria' },
  fechaAsignacion: { etiqueta: 'Fecha de asignación', formato: 'fecha' },
  fechaDiligenciamiento: { etiqueta: 'Fecha de diligenciamiento', formato: 'fecha' },
  fechaEntregaResultado: { etiqueta: 'Entrega del resultado', formato: 'fecha' }
}

const CAMPOS_TRAMITADOR: Record<string, Campo> = { tramitadorId: { etiqueta: 'Tramitador', referencia: REF.tramitador } }
const CAMPOS_ANALISTA: Record<string, Campo> = { analistaAsignado: { etiqueta: 'Analista', referencia: REF.usuario } }

const CAMPOS_PROGRAMACION: Record<string, Campo> = {
  fechaProbableEntrega: { etiqueta: 'Fecha de diligencia', formato: 'fecha' },
  fechaRealizacionDiligencia: { etiqueta: 'Realización de la diligencia', formato: 'fecha' },
  fechaFinalizacionServicio: { etiqueta: 'Finalización del servicio', formato: 'fechaHora' },
  valorTramite: { etiqueta: 'Valor trámite', formato: 'moneda' },
  valorViaticos: { etiqueta: 'Viáticos', formato: 'moneda' },
  conceptoHonorarios: { etiqueta: 'Concepto honorarios' },
  conceptoViaticos: { etiqueta: 'Concepto viáticos' },
  requiereCita: { etiqueta: 'Requiere cita', formato: 'siNo' },
  fechaCita: { etiqueta: 'Fecha de la cita', formato: 'fecha' },
  horaCita: { etiqueta: 'Hora de la cita' }
}

const CAMPOS_LOGISTICA: Record<string, Campo> = {
  transportadoraId: { etiqueta: 'Transportadora', referencia: REF.transportadora },
  numeroGuia: { etiqueta: 'Número de guía' },
  destinatario: { etiqueta: 'Destinatario' },
  valorEnvio: { etiqueta: 'Valor del envío', formato: 'moneda' },
  fechaProgramacionLogistica: { etiqueta: 'Programación', formato: 'fecha' },
  fechaEntregaTransportadora: { etiqueta: 'Entrega a transportadora', formato: 'fecha' }
}

const CAMPOS_CUENTA_COBRO: Record<string, Campo> = {
  numeroCuentaCobro: { etiqueta: 'Número' },
  valorCuentaCobro: { etiqueta: 'Valor', formato: 'moneda' },
  fechaRadicacionCuentaCobro: { etiqueta: 'Radicación', formato: 'fecha' },
  fechaMaximaPagoCuentaCobro: { etiqueta: 'Fecha máxima de pago', formato: 'fecha' },
  fechaPagoCuentaCobro: { etiqueta: 'Fecha de pago', formato: 'fecha' },
  fechaRecibidaCuentaCobroTramitador: { etiqueta: 'Recibida del tramitador', formato: 'fecha' }
}

const CAMPOS_ESTADO: Record<string, Campo> = {
  estadoId: { etiqueta: 'Estado', referencia: REF.estado },
  tipoRechazoId: { etiqueta: 'Tipo de rechazo', referencia: REF.rechazo }
}

const CAMPOS_SUBESTADO: Record<string, Campo> = {
  subEstadoId: { etiqueta: 'Subestado', referencia: REF.subestado },
  observacion: { etiqueta: 'Observación' }
}

const CAMPOS_TRAZABILIDAD: Record<string, Campo> = { observacionTrazabilidad: { etiqueta: 'Observación' } }

// ── Formato de valores ──

const dosDigitos = (n: number) => String(n).padStart(2, '0')

// Fechas sin hora: se guardan como medianoche UTC o como texto YYYY-MM-DD
const textoFecha = (valor: unknown) => {
  const iso = valor instanceof Date ? valor.toISOString() : String(valor)
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

const textoFechaHora = (valor: unknown) => {
  const fecha = valor instanceof Date ? valor : new Date(String(valor))
  if (isNaN(fecha.getTime())) return String(valor)
  const p = Object.fromEntries(new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(fecha).map(x => [x.type, x.value]))
  return `${p.day}/${p.month}/${p.year} ${dosDigitos(Number(p.hour))}:${p.minute}`
}

const formatoMoneda = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

const formatear = async (valor: unknown, campo: Campo): Promise<string | null> => {
  if (valor === null || valor === undefined || (typeof valor === 'string' && valor.trim() === '')) return null
  if (campo.referencia) {
    const id = Number(valor)
    if (!id) return null
    return (await campo.referencia.buscar(id)) || `#${id}`
  }
  switch (campo.formato) {
    case 'fecha': return textoFecha(valor)
    case 'fechaHora': return textoFechaHora(valor)
    case 'moneda': return isNaN(Number(valor)) ? String(valor) : formatoMoneda.format(Number(valor))
    case 'siNo': return valor === true || valor === 'true' ? 'Sí' : 'No'
    default: return String(valor).trim()
  }
}

// Para decidir si un campo cambió sin resolver nombres: "5" y 5, o la misma fecha como Date
// y como texto, no son un cambio
const clave = (valor: unknown, campo: Campo) => {
  if (valor === null || valor === undefined || (typeof valor === 'string' && valor.trim() === '')) return ''
  if (campo.referencia || campo.formato === 'moneda') return String(Number(valor))
  if (campo.formato === 'fecha') return textoFecha(valor)
  if (campo.formato === 'fechaHora') return valor instanceof Date ? valor.toISOString() : new Date(String(valor)).toISOString()
  // "No" y vacío valen lo mismo: así el valor por defecto no aparece como cambio al crear
  if (campo.formato === 'siNo') return valor === true || valor === 'true' ? 'si' : ''
  return String(valor).trim()
}

// ── Registro ──

type CambioCrudo = { campo: Campo, antes: unknown, despues: unknown }

type Pendiente = {
  solicitudTramiteId: number
  seccion: string
  accion: 'CREADO' | 'MODIFICADO' | 'ELIMINADO'
  registroId: number | null
  cambios: CambioCrudo[]
}

const guardar = async (pendiente: Pendiente, contexto: ContextoPeticion) => {
  try {
    const cambios: CambioCampo[] = []
    for (const c of pendiente.cambios) {
      const [antes, despues] = await Promise.all([formatear(c.antes, c.campo), formatear(c.despues, c.campo)])
      if (antes !== despues) cambios.push({ campo: c.campo.etiqueta, antes, despues })
    }
    // Un MODIFICADO sin diferencias visibles no se registra
    if (pendiente.accion === 'MODIFICADO' && !cambios.length) return

    await HistorialTramite.create({
      solicitudTramiteId: pendiente.solicitudTramiteId,
      seccion: pendiente.seccion,
      accion: pendiente.accion,
      registroId: pendiente.registroId,
      cambios,
      usuarioId: contexto.usuarioId,
      tramitadorId: contexto.tramitadorId,
      nombreUsuario: contexto.nombre,
      origen: contexto.origen
    })
  } catch (error) {
    // El historial nunca frena la operación que lo generó
    console.error('❌ Historial del trámite:', error)
  }
}

// Se guarda después de confirmar la transacción: si la operación se revierte, no queda rastro
// de un cambio que no ocurrió, y un error del historial no revierte la operación
const programar = (pendiente: Pendiente, transaction?: Transaction | null) => {
  if (!pendiente.solicitudTramiteId) return
  if (pendiente.accion === 'MODIFICADO' && !pendiente.cambios.length) return
  const contexto = contextoActual()
  if (transaction) transaction.afterCommit(() => guardar(pendiente, contexto))
  else void guardar(pendiente, contexto)
}

// Campos con valor distinto entre el registro anterior y el actual
const cambiosDe = (instancia: Model, campos: Record<string, Campo>, accion: Pendiente['accion']): CambioCrudo[] =>
  Object.entries(campos).flatMap(([atributo, campo]) => {
    const anterior = accion === 'CREADO' ? null : instancia.previous(atributo as never)
    const actual = accion === 'ELIMINADO' ? null : instancia.get(atributo)
    return clave(anterior, campo) === clave(actual, campo) ? [] : [{ campo, antes: anterior, despues: actual }]
  })

type Opciones = { transaction?: Transaction | null }

type ModeloConHooks = {
  addHook: (evento: string, nombre: string, fn: (...args: any[]) => unknown) => unknown
}

// Registra un modelo con una fila por trámite (programación, logística...) o con varias
// (estados, subestados, trazabilidad)
const vigilar = (
  modelo: ModeloConHooks,
  seccion: string,
  campos: Record<string, Campo>,
  tramiteDe: (instancia: Model) => number,
  opciones: { conId?: boolean, creacionConCampos?: boolean } = {}
) => {
  const registrar = (accion: Pendiente['accion']) => (instancia: Model, o: Opciones) => programar({
    solicitudTramiteId: tramiteDe(instancia),
    seccion,
    accion,
    registroId: opciones.conId ? Number(instancia.get('id')) : null,
    // Estados, subestados y trazabilidades nuevas se leen de su tabla: solo hace falta quién
    cambios: accion === 'CREADO' && !opciones.creacionConCampos ? [] : cambiosDe(instancia, campos, accion)
  }, o.transaction)

  modelo.addHook('afterCreate', 'historial', registrar('CREADO'))
  modelo.addHook('afterUpdate', 'historial', registrar('MODIFICADO'))
  modelo.addHook('afterDestroy', 'historial', registrar('ELIMINADO'))
  // Model.update(...) y Model.destroy(...) en bloque no pasan por los hooks de cada fila
  // si no se pide: así también quedan registrados
  modelo.addHook('beforeBulkUpdate', 'historial', (o: { individualHooks?: boolean }) => { o.individualHooks = true })
  modelo.addHook('beforeBulkDestroy', 'historial', (o: { individualHooks?: boolean }) => { o.individualHooks = true })
}

let activo = false

export const activarHistorialTramites = () => {
  if (activo) return
  activo = true

  // El trámite: crear no se registra (la fecha y el creador están en el trámite). Al editar,
  // tramitador, analista y demás datos quedan como entradas separadas.
  const modificarTramite = (instancia: Model, o: Opciones) => {
    const solicitudTramiteId = Number(instancia.get('id'))
    for (const [seccion, campos] of [['TRAMITADOR', CAMPOS_TRAMITADOR], ['ANALISTA', CAMPOS_ANALISTA], ['DATOS', CAMPOS_DATOS]] as const) {
      programar({ solicitudTramiteId, seccion, accion: 'MODIFICADO', registroId: null, cambios: cambiosDe(instancia, campos, 'MODIFICADO') }, o.transaction)
    }
  }
  const tramite = SolicitudTramites as unknown as ModeloConHooks
  tramite.addHook('afterUpdate', 'historial', modificarTramite)
  tramite.addHook('beforeBulkUpdate', 'historial', (o: { individualHooks?: boolean }) => { o.individualHooks = true })

  const delTramite = (instancia: Model) => Number(instancia.get('solicitudTramiteId'))
  vigilar(Programacion as unknown as ModeloConHooks, 'PROGRAMACION', CAMPOS_PROGRAMACION, delTramite, { creacionConCampos: true })
  vigilar(Logistica as unknown as ModeloConHooks, 'LOGISTICA', CAMPOS_LOGISTICA, delTramite, { creacionConCampos: true })
  vigilar(CuentaCobros as unknown as ModeloConHooks, 'CUENTA_COBRO', CAMPOS_CUENTA_COBRO, delTramite, { creacionConCampos: true })
  vigilar(EstadosTramites as unknown as ModeloConHooks, 'ESTADO', CAMPOS_ESTADO, delTramite, { conId: true })
  vigilar(SubEstadosSolicitud as unknown as ModeloConHooks, 'SUBESTADO', CAMPOS_SUBESTADO, delTramite, { conId: true })
  vigilar(Trazabilidad as unknown as ModeloConHooks, 'TRAZABILIDAD', CAMPOS_TRAZABILIDAD, delTramite, { conId: true })
}

// =====================================
// LÍNEA DE TIEMPO
// Une lo que ya estaba en sus tablas (estados, trazabilidad, subestados, documentos, reportes
// del tramitador) con la bitácora. Los registros anteriores a la bitácora salen sin usuario
// (salvo la trazabilidad, que guardaba el nombre, y los documentos).
// =====================================

export type EventoHistorial = {
  clave: string
  fecha: string
  tipo: string
  titulo: string
  detalle: string | null
  cambios: CambioCampo[]
  usuario: string | null
  origen: string | null
  // Lo hizo quien creó el trámite (para distinguir sus ediciones de las de Torre de control)
  esCreador: boolean
}

const TITULOS: Record<string, Record<string, string>> = {
  PROGRAMACION: { CREADO: 'Programó el trámite', MODIFICADO: 'Cambió la programación', ELIMINADO: 'Eliminó la programación' },
  LOGISTICA: { CREADO: 'Registró la logística', MODIFICADO: 'Cambió la logística', ELIMINADO: 'Eliminó la logística' },
  CUENTA_COBRO: { CREADO: 'Registró la cuenta de cobro', MODIFICADO: 'Cambió la cuenta de cobro', ELIMINADO: 'Eliminó la cuenta de cobro' },
  DATOS: { MODIFICADO: 'Editó el trámite' },
  ESTADO: { MODIFICADO: 'Corrigió un estado', ELIMINADO: 'Eliminó un estado' },
  SUBESTADO: { MODIFICADO: 'Corrigió un subestado', ELIMINADO: 'Eliminó un subestado' },
  TRAZABILIDAD: { MODIFICADO: 'Editó una trazabilidad', ELIMINADO: 'Eliminó una trazabilidad' }
}

const tituloAsignacion = (quien: string, cambio?: CambioCampo) =>
  !cambio?.antes ? `Asignó el ${quien}` : !cambio.despues ? `Quitó el ${quien}` : `Cambió el ${quien}`

const fechaISO = (valor: unknown) => (valor instanceof Date ? valor : new Date(String(valor))).toISOString()

export const obtenerHistorial = async (solicitudTramiteId: number): Promise<EventoHistorial[]> => {
  const donde = { where: { solicitudTramiteId } }

  const [tramite, bitacora, estados, trazabilidades, subestados, documentos, reportes] = await Promise.all([
    SolicitudTramites.findByPk(solicitudTramiteId, {
      attributes: ['id', 'createdAt', 'usuarioId'],
      include: [{ model: Usuarios, attributes: ['nombreUsuario'] }]
    }),
    HistorialTramite.findAll({ ...donde, order: [['createdAt', 'DESC']] }),
    EstadosTramites.findAll({
      ...donde,
      include: [{ model: Estados, attributes: ['nombreEstado'] }, { model: TiposRechazo, attributes: ['nombre'] }]
    }),
    Trazabilidad.findAll(donde),
    SubEstadosSolicitud.findAll({ ...donde, include: [{ model: SubEstados, attributes: ['nombre'] }] }),
    DocumentoSolicitud.findAll({
      ...donde,
      attributes: ['id', 'nombreOriginal', 'tipoDocumento', 'usuarioId', 'createdAt'],
      include: [{ model: Usuarios, attributes: ['nombreUsuario'] }, { model: Tramitador, attributes: ['nombreTramitador'] }]
    }),
    ReporteRealizado.findAll({
      ...donde,
      include: [{ model: Tramitador, attributes: ['nombreTramitador'] }, { model: Usuarios, as: 'revisor', attributes: ['nombreUsuario'] }]
    })
  ])
  if (!tramite) return []
  const delCreador = (usuarioId?: number | null) => !!usuarioId && usuarioId === tramite.usuarioId

  // Quién creó cada estado, subestado o trazabilidad (desde que existe la bitácora)
  const creador = new Map<string, HistorialTramite>()
  for (const h of bitacora) if (h.accion === 'CREADO' && h.registroId) creador.set(`${h.seccion}-${h.registroId}`, h)
  const autor = (seccion: string, id: number) => creador.get(`${seccion}-${id}`)

  const eventos: EventoHistorial[] = [{
    clave: `creado-${tramite.id}`,
    fecha: fechaISO(tramite.get('createdAt')),
    tipo: 'CREADO',
    titulo: 'Creó el trámite',
    detalle: null,
    cambios: [],
    usuario: tramite.usuario?.nombreUsuario ?? null,
    origen: null,
    esCreador: false
  }]

  for (const e of estados) {
    const h = autor('ESTADO', e.id)
    eventos.push({
      clave: `estado-${e.id}`,
      fecha: fechaISO(e.get('createdAt')),
      tipo: 'ESTADO',
      titulo: `Cambió el estado a ${e.estado?.nombreEstado ?? 'Sin estado'}`,
      detalle: e.tipoRechazo?.nombre ?? null,
      cambios: [],
      usuario: h?.nombreUsuario ?? null,
      origen: h?.origen ?? null,
      esCreador: delCreador(h?.usuarioId)
    })
  }

  for (const t of trazabilidades) {
    const h = autor('TRAZABILIDAD', t.id)
    eventos.push({
      clave: `trazabilidad-${t.id}`,
      fecha: fechaISO(t.get('createdAt')),
      tipo: 'TRAZABILIDAD',
      titulo: 'Agregó una trazabilidad',
      detalle: t.observacionTrazabilidad ?? null,
      cambios: [],
      usuario: h?.nombreUsuario ?? (t.nombreUsuario || null),
      origen: h?.origen ?? null,
      esCreador: delCreador(h?.usuarioId)
    })
  }

  for (const s of subestados) {
    const h = autor('SUBESTADO', s.id)
    eventos.push({
      clave: `subestado-${s.id}`,
      fecha: fechaISO(s.get('createdAt')),
      tipo: 'SUBESTADO',
      titulo: `Subestado: ${s.subEstado?.nombre ?? '—'}`,
      detalle: s.observacion || null,
      cambios: [],
      usuario: h?.nombreUsuario ?? null,
      origen: h?.origen ?? null,
      esCreador: delCreador(h?.usuarioId)
    })
  }

  for (const d of documentos) {
    const deTramitador = d.tramitador?.nombreTramitador?.trim()
    eventos.push({
      clave: `documento-${d.id}`,
      fecha: fechaISO(d.get('createdAt')),
      tipo: 'DOCUMENTO',
      titulo: 'Subió un documento',
      detalle: d.nombreOriginal,
      cambios: [],
      usuario: d.usuario?.nombreUsuario ?? deTramitador ?? null,
      origen: deTramitador && !d.usuario ? 'APP_TRAMITADOR' : null,
      esCreador: delCreador(d.usuarioId)
    })
  }

  for (const r of reportes) {
    eventos.push({
      clave: `realizado-${r.id}`,
      fecha: fechaISO(r.get('createdAt')),
      tipo: 'REALIZADO',
      titulo: 'Reportó el trámite como realizado',
      detalle: r.observacion || null,
      cambios: [],
      usuario: r.tramitador?.nombreTramitador?.trim() ?? null,
      origen: 'APP_TRAMITADOR',
      esCreador: false
    })
    if (r.fechaRevision) {
      eventos.push({
        clave: `realizado-revision-${r.id}`,
        fecha: fechaISO(r.fechaRevision),
        tipo: 'REALIZADO',
        titulo: r.estado === 'DEVUELTO' ? 'Devolvió el trámite al tramitador' : 'Revisó el reporte de realizado',
        detalle: r.notaRevision || null,
        cambios: [],
        usuario: r.revisor?.nombreUsuario ?? null,
        origen: null,
        esCreador: delCreador(r.revisadoPor)
      })
    }
  }

  // Cambios de la bitácora (las creaciones de estados, subestados y trazabilidad ya salieron arriba)
  for (const h of bitacora) {
    if (h.accion === 'CREADO' && ['ESTADO', 'SUBESTADO', 'TRAZABILIDAD'].includes(h.seccion)) continue
    const titulo = h.seccion === 'TRAMITADOR' ? tituloAsignacion('tramitador', h.cambios[0])
      : h.seccion === 'ANALISTA' ? tituloAsignacion('analista', h.cambios[0])
        : TITULOS[h.seccion]?.[h.accion] ?? 'Cambio en el trámite'
    eventos.push({
      clave: `historial-${h.id}`,
      fecha: fechaISO(h.get('createdAt')),
      tipo: h.seccion,
      titulo,
      detalle: null,
      cambios: h.cambios,
      usuario: h.nombreUsuario,
      origen: h.origen,
      esCreador: delCreador(h.usuarioId)
    })
  }

  return eventos.sort((a, b) => b.fecha.localeCompare(a.fecha))
}
