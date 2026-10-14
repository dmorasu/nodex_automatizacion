import { Op, WhereOptions, literal } from 'sequelize'
import SolicitudTramites from '../../models/solicitudTramites'
import Estados from '../../models/estados'
import EstadosTramites from '../../models/estadosTramites'
import Clientes from '../../models/clientes'
import Tramite from '../../models/tramite'
import Municipios from '../../models/municipios'
import Entidad from '../../models/entidad'
import Operaciones from '../../models/operaciones'
import Programacion from '../../models/programacion'
import Logistica from '../../models/logistica'
import Transportadora from '../../models/trasnportadora'
import Trazabilidad from '../../models/trazabilidad'
import SubEstadosSolicitud from '../../models/subEstadosSolicitud'
import SubEstados from '../../models/subEstados'
import DocumentoSolicitud from '../../models/documentosSolicitud'
import Tramitador from '../../models/tramitador'
import Usuarios from '../../models/usuarios'
import ComentarioTramite from '../../models/tramitadores/comentarioTramite'
import ReporteRealizado, { ESTADOS_REPORTE } from '../../models/tramitadores/reporteRealizado'
import { ErrorGastos as ErrorNegocio } from '../gastos/errores'
import { obtenerArchivo } from '../azureFileStorage'
import { type TipoDocumentoTramite } from './nombresDocumento'
import { registrarDocumentosTramite } from './documentosTramite'
import { gastosDelTramite, subirSoporte } from './soportesTramitador'
import { avisarComentarioEquipo, avisarTramiteDevuelto } from './avisosPush'

// Estados en los que el trámite ya terminó: no se puede reportar como realizado
export const ESTADOS_CERRADOS = ['Finalizado', 'Desistido']

export const TAMANO_PAGINA = 20

export type FiltroTramites = 'activos' | 'cerrados' | 'todos' | 'sinFactura'

// Reporte de realizado pendiente de revisar (para marcarlo en listas)
const REPORTE_PENDIENTE = literal(`EXISTS (
  SELECT 1 FROM tramitadores_reportes_realizado r
  WHERE r.solicitud_tramite_id = "SolicitudTramites"."id" AND r.estado = '${ESTADOS_REPORTE.PENDIENTE}'
)`)

// Gastos del trámite ya pagados a los que les falta la factura (y no hay una en revisión).
// La factura se sube en el trámite y llega sola al gasto.
const SQL_GASTOS_SIN_FACTURA = `(
  SELECT COUNT(*)::int FROM gastos_solicitudes g
  JOIN gastos_estados_gasto e ON e.id = g.estado_id AND e.codigo = 'PAGADO'
  WHERE g.solicitud_tramite_id = "SolicitudTramites"."id"
    AND NOT EXISTS (
      SELECT 1 FROM tramitadores_soportes s
      WHERE s.solicitud_gasto_id = g.id AND s.tipo = 'FACTURA' AND s.estado = 'PENDIENTE'
    )
)`

// =====================================
// MIS TRÁMITES (app del tramitador)
// =====================================
export const listarTramitesDelTramitador = async (
  tramitadorId: number,
  { filtro = 'activos', busqueda, pagina = 1 }: { filtro?: FiltroTramites, busqueda?: string | null, pagina?: number }
) => {
  const condiciones: WhereOptions[] = [{ tramitadorId }]

  if (filtro === 'activos') {
    condiciones.push({
      [Op.or]: [
        { estadoActualTramite: null },
        { '$estadoActual.nombreEstado$': { [Op.notIn]: ESTADOS_CERRADOS } }
      ]
    })
  } else if (filtro === 'cerrados') {
    condiciones.push({ '$estadoActual.nombreEstado$': { [Op.in]: ESTADOS_CERRADOS } })
  } else if (filtro === 'sinFactura') {
    condiciones.push(literal(`${SQL_GASTOS_SIN_FACTURA} > 0`))
  }

  const texto = busqueda?.trim()
  if (texto) {
    const parecido = { [Op.iLike]: `%${texto}%` }
    condiciones.push({
      [Op.or]: [
        ...(/^\d+$/.test(texto) ? [{ id: Number(texto) }] : []),
        { placa: parecido },
        { matriculaInmobiliaria: parecido },
        { '$clientes.nombreCliente$': parecido }
      ]
    })
  }

  const { count, rows } = await SolicitudTramites.findAndCountAll({
    where: { [Op.and]: condiciones },
    attributes: [
      'id', 'placa', 'matriculaInmobiliaria', 'detalleSolicitud', 'direccionTramite', 'fechaAsignacion', 'createdAt',
      [REPORTE_PENDIENTE, 'reportePendiente'],
      [literal(SQL_GASTOS_SIN_FACTURA), 'gastosSinFactura']
    ],
    include: [
      { model: Estados, as: 'estadoActual', attributes: ['id', 'nombreEstado'] },
      { model: Clientes, attributes: ['nombreCliente'] },
      { model: Tramite, attributes: ['nombreTramite'] },
      { model: Municipios, attributes: ['nombreMunicipio', 'departamento'] },
      { model: Programacion, attributes: ['fechaRealizacionDiligencia', 'fechaProbableEntrega', 'requiereCita', 'fechaCita', 'horaCita'] }
    ],
    // Primero lo que tiene diligencia más cercana; los demás, del más reciente al más antiguo
    order: [[{ model: Programacion, as: 'programacion' }, 'fechaRealizacionDiligencia', 'ASC NULLS LAST'], ['id', 'DESC']],
    limit: TAMANO_PAGINA,
    offset: (Math.max(1, pagina) - 1) * TAMANO_PAGINA,
    distinct: true,
    subQuery: false
  })

  return { total: count, pagina, tamano: TAMANO_PAGINA, registros: rows }
}

// Trámite del tramitador: si no es suyo responde 404 (no revela que existe)
const tramiteDelTramitador = async (tramitadorId: number, solicitudTramiteId: number) => {
  const tramite = await SolicitudTramites.findOne({
    where: { id: solicitudTramiteId, tramitadorId },
    include: [{ model: Estados, as: 'estadoActual', attributes: ['nombreEstado'] }]
  })
  if (!tramite) throw new ErrorNegocio('Trámite no encontrado', 404)
  return tramite
}

// Comentarios y reportes del trámite, del más reciente al más antiguo (se ve igual en ambas apps)
export const obtenerSeguimiento = async (solicitudTramiteId: number) => {
  const [comentarios, reportes] = await Promise.all([
    ComentarioTramite.findAll({
      where: { solicitudTramiteId },
      include: [
        { model: Tramitador, attributes: ['id', 'nombreTramitador'] },
        { model: Usuarios, attributes: ['id', 'nombreUsuario'] }
      ],
      order: [['createdAt', 'DESC']]
    }),
    ReporteRealizado.findAll({
      where: { solicitudTramiteId },
      include: [
        { model: Tramitador, attributes: ['id', 'nombreTramitador'] },
        { model: Usuarios, as: 'revisor', attributes: ['id', 'nombreUsuario'] }
      ],
      order: [['createdAt', 'DESC']]
    })
  ])

  return {
    comentarios: comentarios.map(c => ({
      id: c.id,
      comentario: c.comentario,
      fecha: c.createdAt,
      autor: c.tramitador
        ? { tipo: 'TRAMITADOR' as const, id: c.tramitador.id, nombre: c.tramitador.nombreTramitador }
        : { tipo: 'USUARIO' as const, id: c.usuario?.id ?? null, nombre: c.usuario?.nombreUsuario ?? 'Usuario' }
    })),
    reportes: reportes.map(r => ({
      id: r.id,
      observacion: r.observacion,
      estado: r.estado,
      fecha: r.createdAt,
      tramitador: r.tramitador?.nombreTramitador ?? null,
      revisor: r.revisor?.nombreUsuario ?? null,
      fechaRevision: r.fechaRevision,
      notaRevision: r.notaRevision
    }))
  }
}

// Detalle del trámite para el tramitador: lo que necesita para hacerlo, sin valores de dinero
export const obtenerTramiteDelTramitador = async (tramitadorId: number, solicitudTramiteId: number) => {
  await tramiteDelTramitador(tramitadorId, solicitudTramiteId)

  const [tramite, seguimiento] = await Promise.all([
    SolicitudTramites.findByPk(solicitudTramiteId, {
      attributes: [
        'id', 'placa', 'matriculaInmobiliaria', 'detalleSolicitud', 'descripcionTramite', 'documentosAportados',
        'direccionTramite', 'fechaAsignacion', 'fechaDiligenciamiento', 'fechaEntregaResultado', 'createdAt'
      ],
      include: [
        { model: Estados, as: 'estadoActual', attributes: ['id', 'nombreEstado'] },
        { model: Clientes, attributes: ['nombreCliente', 'identificacionCliente', 'telefono', 'telefonoMovil'] },
        { model: Tramite, attributes: ['nombreTramite'] },
        { model: Entidad, attributes: ['nombreEntidad'] },
        { model: Municipios, attributes: ['nombreMunicipio', 'departamento'] },
        { model: Operaciones, attributes: ['nombreOperacion'] },
        {
          model: Programacion,
          attributes: ['fechaRealizacionDiligencia', 'fechaProbableEntrega', 'fechaFinalizacionServicio', 'requiereCita', 'fechaCita', 'horaCita']
        },
        {
          model: Logistica,
          attributes: ['numeroGuia', 'destinatario', 'fechaProgramacionLogistica', 'fechaEntregaTransportadora'],
          include: [{ model: Transportadora, attributes: ['nombreTransportadora'] }]
        },
        {
          model: EstadosTramites,
          attributes: ['id', 'createdAt'],
          include: [{ model: Estados, attributes: ['nombreEstado'] }],
          separate: true,
          order: [['createdAt', 'DESC']]
        },
        {
          model: SubEstadosSolicitud,
          attributes: ['id', 'observacion', 'createdAt'],
          include: [{ model: SubEstados, attributes: ['nombre'] }],
          separate: true,
          order: [['createdAt', 'DESC']]
        },
        {
          model: Trazabilidad,
          attributes: ['id', 'observacionTrazabilidad', 'nombreUsuario', 'createdAt'],
          separate: true,
          order: [['createdAt', 'DESC']],
          limit: 30
        },
        {
          model: DocumentoSolicitud,
          attributes: ['id', 'nombreOriginal', 'tipoArchivo', 'tamano', 'tramitadorId', 'tipoDocumento', 'createdAt'],
          include: [{ model: Usuarios, attributes: ['nombreUsuario'] }],
          separate: true,
          order: [['createdAt', 'DESC']]
        }
      ]
    }),
    obtenerSeguimiento(solicitudTramiteId)
  ])

  // Gastos del trámite: le indican si debe subir la factura o una boleta de reintegro
  const gastos = await gastosDelTramite(tramitadorId, solicitudTramiteId)

  return { tramite, ...seguimiento, gastos }
}

// =====================================
// DOCUMENTOS DEL TRÁMITE
// Van a la misma tabla que los de Nodex Trámites (se ven allá de inmediato),
// marcados con el tramitador que los subió
// =====================================
export type { TipoDocumentoTramite }

// Una Factura o una Boleta de reintegro subida en el trámite llega sola al gasto del
// trámite que la necesita (queda por revisar en Legalización). Así no se sube dos veces.
//  · Si un solo gasto la necesita, va a ese.
//  · Si varios la necesitan, el tramitador elige a cuál (solicitudGastoId).
//  · Si ninguno la necesita, queda solo como documento del trámite.
export const subirDocumentosTramite = async (
  tramitadorId: number,
  solicitudTramiteId: number,
  tipoDocumento: TipoDocumentoTramite,
  archivos: Express.Multer.File[],
  solicitudGastoId: number | null = null
) => {
  await tramiteDelTramitador(tramitadorId, solicitudTramiteId)
  if (archivos.length === 0) throw new ErrorNegocio('Debe adjuntar al menos un archivo')

  const vaAlGasto = tipoDocumento === 'FACTURA' || tipoDocumento === 'BOLETA_REINTEGRO'
  if (!vaAlGasto) {
    const documentos = await registrarDocumentosTramite(solicitudTramiteId, tramitadorId, tipoDocumento, archivos)
    return { cantidad: documentos.length, gasto: null }
  }

  const gastos = await gastosDelTramite(tramitadorId, solicitudTramiteId)
  const candidatos = tipoDocumento === 'FACTURA'
    ? gastos.filter(g => g.puedeSubirFactura)
    : gastos.filter(g => g.reintegrosPorSoportar.length > 0)

  let destino = null
  if (solicitudGastoId) {
    destino = candidatos.find(g => g.id === solicitudGastoId)
    if (!destino) {
      throw new ErrorNegocio(tipoDocumento === 'FACTURA'
        ? 'Ese gasto ya tiene la factura registrada o en revisión'
        : 'Ese gasto no tiene reintegros pendientes por soportar')
    }
  } else if (candidatos.length === 1) {
    destino = candidatos[0]
  } else if (candidatos.length > 1) {
    throw new ErrorNegocio('Este trámite tiene varios gastos: seleccione a cuál corresponde el documento')
  }

  if (!destino) {
    const documentos = await registrarDocumentosTramite(solicitudTramiteId, tramitadorId, tipoDocumento, archivos)
    return { cantidad: documentos.length, gasto: null }
  }

  // Soporte del gasto (para Legalización) + copia en los documentos del trámite
  await subirSoporte(tramitadorId, destino.id, {
    tipo: tipoDocumento === 'FACTURA' ? 'FACTURA' : 'REINTEGRO',
    reintegroId: tipoDocumento === 'FACTURA' ? null : destino.reintegrosPorSoportar[0]
  }, archivos)

  return { cantidad: archivos.length, gasto: destino.codigo }
}

// Documento de un trámite del tramitador (lo haya subido él o el equipo)
export const documentoDelTramitador = async (tramitadorId: number, solicitudTramiteId: number, documentoId: number) => {
  await tramiteDelTramitador(tramitadorId, solicitudTramiteId)
  const documento = await DocumentoSolicitud.findOne({ where: { id: documentoId, solicitudTramiteId } })
  if (!documento) throw new ErrorNegocio('El documento no existe', 404)

  const rutaDirectorio = documento.rutaArchivo.substring(0, documento.rutaArchivo.lastIndexOf('/'))
  return { documento, contenido: await obtenerArchivo(rutaDirectorio, documento.nombreArchivo) }
}

export const comentarComoTramitador = async (tramitadorId: number, solicitudTramiteId: number, comentario: string) => {
  await tramiteDelTramitador(tramitadorId, solicitudTramiteId)
  return ComentarioTramite.create({ solicitudTramiteId, tramitadorId, comentario: comentario.trim() })
}

// El tramitador reporta que hizo el trámite. Queda pendiente de revisión; el estado no cambia
export const reportarRealizado = async (tramitadorId: number, solicitudTramiteId: number, observacion: string) => {
  const tramite = await tramiteDelTramitador(tramitadorId, solicitudTramiteId)

  if (ESTADOS_CERRADOS.includes(tramite.estadoActual?.nombreEstado)) {
    throw new ErrorNegocio(`El trámite ya está ${tramite.estadoActual.nombreEstado.toLowerCase()}`)
  }

  const pendiente = await ReporteRealizado.findOne({
    where: { solicitudTramiteId, estado: ESTADOS_REPORTE.PENDIENTE }
  })
  if (pendiente) throw new ErrorNegocio('Ya reportó este trámite como realizado; está pendiente de revisión')

  return ReporteRealizado.create({ solicitudTramiteId, tramitadorId, observacion: observacion.trim() })
}

// =====================================
// EQUIPO INTERNO (Nodex Trámites)
// `soloDelUsuario`: Gestión de activos sin Torre de control solo ve los trámites que creó
// =====================================
const tramiteVisibleParaUsuario = async (solicitudTramiteId: number, soloDelUsuario: number | null) => {
  const tramite = await SolicitudTramites.findOne({
    where: { id: solicitudTramiteId, ...(soloDelUsuario ? { usuarioId: soloDelUsuario } : {}) },
    attributes: ['id']
  })
  if (!tramite) throw new ErrorNegocio('Trámite no encontrado', 404)
}

export const seguimientoParaUsuario = async (solicitudTramiteId: number, soloDelUsuario: number | null) => {
  await tramiteVisibleParaUsuario(solicitudTramiteId, soloDelUsuario)
  return obtenerSeguimiento(solicitudTramiteId)
}

export const comentarComoUsuario = async (
  usuarioId: number, solicitudTramiteId: number, comentario: string, soloDelUsuario: number | null
) => {
  await tramiteVisibleParaUsuario(solicitudTramiteId, soloDelUsuario)
  const creado = await ComentarioTramite.create({ solicitudTramiteId, usuarioId, comentario: comentario.trim() })
  // Push al tramitador en segundo plano: no frena la respuesta y nunca lanza
  void avisarComentarioEquipo(solicitudTramiteId, usuarioId, comentario)
  return creado
}

// Bandeja de trámites reportados como realizados
export const listarReportes = async (estado: string, soloDelUsuario: number | null) => {
  const reportes = await ReporteRealizado.findAll({
    where: { estado },
    include: [
      { model: Tramitador, attributes: ['id', 'nombreTramitador'] },
      { model: Usuarios, as: 'revisor', attributes: ['id', 'nombreUsuario'] },
      {
        model: SolicitudTramites,
        required: true,
        where: soloDelUsuario ? { usuarioId: soloDelUsuario } : undefined,
        attributes: ['id', 'placa', 'matriculaInmobiliaria', 'detalleSolicitud'],
        include: [
          { model: Estados, as: 'estadoActual', attributes: ['nombreEstado'] },
          { model: Clientes, attributes: ['nombreCliente'] },
          { model: Tramite, attributes: ['nombreTramite'] }
        ]
      }
    ],
    order: [['createdAt', estado === ESTADOS_REPORTE.PENDIENTE ? 'ASC' : 'DESC']],
    limit: 200
  })

  return reportes.map(r => ({
    id: r.id,
    observacion: r.observacion,
    estado: r.estado,
    fecha: r.createdAt,
    tramitador: r.tramitador?.nombreTramitador ?? null,
    revisor: r.revisor?.nombreUsuario ?? null,
    fechaRevision: r.fechaRevision,
    notaRevision: r.notaRevision,
    tramite: {
      id: r.solicitudTramite.id,
      placa: r.solicitudTramite.placa,
      matriculaInmobiliaria: r.solicitudTramite.matriculaInmobiliaria,
      detalleSolicitud: r.solicitudTramite.detalleSolicitud,
      estado: r.solicitudTramite.estadoActual?.nombreEstado ?? 'Sin Iniciar',
      cliente: r.solicitudTramite.clientes?.nombreCliente ?? null,
      tipo: r.solicitudTramite.tramite?.nombreTramite ?? null
    }
  }))
}

// Marca el reporte como revisado. El estado del trámite se cambia aparte, con el flujo normal
export const revisarReporte = async (reporteId: number, usuarioId: number, nota: string | null, soloDelUsuario: number | null) => {
  const reporte = await ReporteRealizado.findByPk(reporteId)
  if (!reporte) throw new ErrorNegocio('Reporte no encontrado', 404)
  await tramiteVisibleParaUsuario(reporte.solicitudTramiteId, soloDelUsuario)
  if (reporte.estado !== ESTADOS_REPORTE.PENDIENTE) throw new ErrorNegocio('El reporte ya fue revisado')

  await reporte.update({
    estado: ESTADOS_REPORTE.REVISADO,
    revisadoPor: usuarioId,
    fechaRevision: new Date(),
    notaRevision: nota?.trim() || null
  })
  return reporte
}

// Devolver el trámite al tramitador: el reporte de realizado no se acepta. El motivo es
// obligatorio, le llega por push y lo ve en la app; puede volver a reportarlo cuando lo corrija.
export const devolverReporte = async (reporteId: number, usuarioId: number, motivo: string, soloDelUsuario: number | null) => {
  const texto = motivo?.trim()
  if (!texto) throw new ErrorNegocio('Escriba el motivo de la devolución')
  const reporte = await ReporteRealizado.findByPk(reporteId)
  if (!reporte) throw new ErrorNegocio('Reporte no encontrado', 404)
  await tramiteVisibleParaUsuario(reporte.solicitudTramiteId, soloDelUsuario)
  if (reporte.estado !== ESTADOS_REPORTE.PENDIENTE) throw new ErrorNegocio('El reporte ya fue revisado o devuelto')

  await reporte.update({
    estado: ESTADOS_REPORTE.DEVUELTO,
    revisadoPor: usuarioId,
    fechaRevision: new Date(),
    notaRevision: texto
  })
  // En segundo plano: no frena la respuesta y nunca lanza
  void avisarTramiteDevuelto(reporte.solicitudTramiteId, reporte.tramitadorId, usuarioId, texto)
  return reporte
}
