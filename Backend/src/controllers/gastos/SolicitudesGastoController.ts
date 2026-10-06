import type { Request, Response } from 'express'
import { Op, Order, WhereOptions, col, fn, literal } from 'sequelize'
import SolicitudesGasto from '../../models/gastos/solicitudesGasto'
import EstadosGasto from '../../models/gastos/estadosGasto'
import TiposGasto from '../../models/gastos/tiposGasto'
import FormasPago from '../../models/gastos/formasPago'
import Terceros from '../../models/gastos/terceros'
import Bolsas from '../../models/gastos/bolsas'
import TrazabilidadGastos from '../../models/gastos/trazabilidadGastos'
import DocumentosGasto from '../../models/gastos/documentosGasto'
import TiposDocumentoGasto from '../../models/gastos/tiposDocumentoGasto'
import Operaciones from '../../models/operaciones'
import Tramitador from '../../models/tramitador'
import Usuarios from '../../models/usuarios'
import Reintegros from '../../models/gastos/reintegros'
import EstadosReintegro from '../../models/gastos/estadosReintegro'
import CuentasCobroGastos from '../../models/gastos/cuentasCobroGastos'
import CuentasCobro from '../../models/gastos/cuentasCobro'
import EstadosCuentaCobro from '../../models/gastos/estadosCuentaCobro'
import FacturasGasto from '../../models/gastos/facturasGasto'
import { actualizarGasto, anularGasto, crearGasto } from '../../services/gastos/solicitudesGasto'
import { registrarFactura } from '../../services/gastos/facturas'
import { codigoEstadoGasto, idEstadoGasto, CodigoEstadoGasto } from '../../services/gastos/estadosGasto'
import { ESTADOS_GASTO, ESTADOS_SIN_PAGO, ROLES } from '../../services/gastos/constantes'
import { ErrorGastos } from '../../services/gastos/errores'
import { notificarGastosCreados } from '../../services/gastos/notificacionesGastos'
import { ATRIBUTOS_USUARIO, esAdmin, idsTiposCertificados, puedeGestionarFactura, puedeVerTodos, responderError, soloCertificados } from './utilidades'
import SolicitudTramites from '../../models/solicitudTramites'
import { soloTramitesPropios } from '../../middleware/auth'

// Busca el gasto y verifica que el usuario pueda verlo.
// A quien no puede verlo se le responde 404 (no se revela que existe).
export const obtenerGastoConAcceso = async (req: Request, id: number) => {
  const gasto = await SolicitudesGasto.findByPk(id)

  if (!gasto || (!puedeVerTodos(req) && gasto.creadoPor !== req.usuario.id)) {
    throw new ErrorGastos('El gasto no existe', 404)
  }
  // Tesorería - Certificados solo abre compras de certificados (o los gastos que ella creó)
  if (soloCertificados(req) && gasto.creadoPor !== req.usuario.id && !(await idsTiposCertificados()).includes(gasto.tipoGastoId)) {
    throw new ErrorGastos('El gasto no existe', 404)
  }

  return gasto
}

const esCreadorOAdmin = (req: Request, gasto: SolicitudesGasto) =>
  gasto.creadoPor === req.usuario.id || esAdmin(req)

const INCLUDES_BASE = [
  { model: EstadosGasto, attributes: ['id', 'codigo', 'nombre'] },
  { model: TiposGasto, attributes: ['id', 'codigo', 'nombre'] },
  { model: Operaciones, attributes: ['id', 'nombreOperacion', 'centroDeCostos'] },
  { model: Bolsas, attributes: ['id', 'nombre'] },
  { model: Usuarios, as: 'creador', attributes: ATRIBUTOS_USUARIO }
]

const INCLUDES_LISTADO = [
  ...INCLUDES_BASE,
  { model: Terceros, attributes: ['id', 'identificacion', 'nombre'] },
  { model: FacturasGasto, attributes: ['id', 'numeroFactura', 'valorFactura', 'cuatroXMil', 'valorLegalizado'] },
  { model: Tramitador, attributes: ['id', 'nombreTramitador'] }
]

// Seguimiento desde la app de tramitadores, para Legalización:
// · soporteTramitador: estado del último documento de factura que subió el tramitador
// · estadoTramite: estado actual del trámite en Nodex Trámites
// · reporteRealizado: estado del último reporte "realizado" del tramitador (PENDIENTE / REVISADO)
const ATRIBUTOS_SEGUIMIENTO_TRAMITADOR: [ReturnType<typeof literal>, string][] = [
  [literal(`(
    SELECT s.estado FROM tramitadores_soportes s
    WHERE s.solicitud_gasto_id = "SolicitudesGasto"."id" AND s.tipo = 'FACTURA'
    ORDER BY s.created_at DESC LIMIT 1
  )`), 'soporteTramitador'],
  [literal(`(
    SELECT COALESCE(e."nombreEstado", 'Sin Iniciar') FROM "SolicitudTramites" t
    LEFT JOIN "Estados" e ON e.id = t."estadoActualTramite"
    WHERE t.id = "SolicitudesGasto"."solicitud_tramite_id"
  )`), 'estadoTramite'],
  [literal(`(
    SELECT r.estado FROM tramitadores_reportes_realizado r
    WHERE r.solicitud_tramite_id = "SolicitudesGasto"."solicitud_tramite_id"
    ORDER BY r.created_at DESC LIMIT 1
  )`), 'reporteRealizado']
]

// Factura subida por el tramitador desde su app (pendiente de revisión o aprobada)
const CON_FACTURA_TRAMITADOR = `EXISTS (
  SELECT 1 FROM tramitadores_soportes s
  WHERE s.solicitud_gasto_id = "SolicitudesGasto"."id" AND s.tipo = 'FACTURA' AND s.estado IN ('PENDIENTE', 'APROBADO')
)`

const desdeBogota = (fecha: string) => new Date(`${fecha}T00:00:00-05:00`)
const hastaBogota = (fecha: string) => new Date(`${fecha}T23:59:59.999-05:00`)

// Filtros del listado de gastos (bandejas de cada módulo y panel de administración):
//  alcance=mios|todos · estado · pagados=si (todo lo ya pagado) · tipoGastoId · bolsaId · operacionId
//  tramitadorId · creadoPor · reembolsable=si|no · sinCuentaCobro=si · soporteTramitador=si|no
//  conTramite=si|no · reintegroPendiente=si · desde/hasta (creación) · pagoDesde/pagoHasta · busqueda
const condicionesListado = async (req: Request) => {
  const q = req.query
  const condiciones: WhereOptions[] = []

  // Sin rol solo se ven los propios, aunque pida "todos"
  if (q.alcance !== 'todos' || !puedeVerTodos(req)) condiciones.push({ creadoPor: req.usuario.id })

  // Compras de certificados (CTL y Cámara de Comercio): las paga Tesorería - Certificados.
  // certificados=si → solo esas · certificados=no → todas menos esas. Quien solo tiene ese rol, solo ve esas.
  const tiposCertificados = await idsTiposCertificados()
  if (q.certificados === 'si' || soloCertificados(req)) condiciones.push({ tipoGastoId: tiposCertificados })
  else if (q.certificados === 'no') condiciones.push({ tipoGastoId: { [Op.notIn]: tiposCertificados } })

  if (q.estado) condiciones.push({ estadoId: await idEstadoGasto(q.estado as CodigoEstadoGasto) })
  // Ya pagados: cualquier estado desde Pagado (sin programados, aprobados sin confirmar ni anulados)
  if (q.pagados === 'si') {
    condiciones.push({
      estadoId: { [Op.notIn]: await Promise.all(ESTADOS_SIN_PAGO.map(codigo => idEstadoGasto(codigo as CodigoEstadoGasto))) }
    })
  }

  if (q.tipoGastoId) condiciones.push({ tipoGastoId: Number(q.tipoGastoId) })
  if (q.bolsaId) condiciones.push({ bolsaId: Number(q.bolsaId) })
  if (q.operacionId) condiciones.push({ operacionId: Number(q.operacionId) })
  if (q.tramitadorId) condiciones.push({ tramitadorId: Number(q.tramitadorId) })
  if (q.creadoPor) condiciones.push({ creadoPor: Number(q.creadoPor) })
  if (q.reembolsable) condiciones.push({ reembolsable: q.reembolsable === 'si' })
  if (q.conTramite) condiciones.push({ solicitudTramiteId: q.conTramite === 'si' ? { [Op.ne]: null } : null })

  // Gastos que no están en ninguna cuenta de cobro activa (no reembolsables por contabilizar)
  if (q.sinCuentaCobro === 'si') {
    condiciones.push({
      id: {
        [Op.notIn]: literal(`(
          SELECT l.solicitud_gasto_id
          FROM gastos_cuentas_cobro_gastos l
          JOIN gastos_cuentas_cobro c ON c.id = l.cuenta_cobro_id
          JOIN gastos_estados_cuenta_cobro ec ON ec.id = c.estado_id
          WHERE ec.codigo <> 'ANULADA'
        )`)
      }
    })
  }

  // Con o sin factura subida por el tramitador desde su app
  if (q.soporteTramitador === 'si') condiciones.push(literal(CON_FACTURA_TRAMITADOR))
  if (q.soporteTramitador === 'no') condiciones.push(literal(`NOT ${CON_FACTURA_TRAMITADOR}`))

  if (q.reintegroPendiente === 'si') {
    condiciones.push(literal(`EXISTS (
      SELECT 1 FROM gastos_reintegros r
      JOIN gastos_estados_reintegro er ON er.id = r.estado_id AND er.codigo = 'PENDIENTE'
      WHERE r.solicitud_gasto_id = "SolicitudesGasto"."id"
    )`))
  }

  // Fechas en hora de Colombia
  if (q.desde) condiciones.push({ createdAt: { [Op.gte]: desdeBogota(String(q.desde)) } })
  if (q.hasta) condiciones.push({ createdAt: { [Op.lte]: hastaBogota(String(q.hasta)) } })
  if (q.pagoDesde) condiciones.push({ fechaPago: { [Op.gte]: String(q.pagoDesde) } })
  if (q.pagoHasta) condiciones.push({ fechaPago: { [Op.lte]: String(q.pagoHasta) } })

  const busqueda = String(q.busqueda ?? '').trim()
  if (busqueda) {
    const patron = { [Op.iLike]: `%${busqueda}%` }
    condiciones.push({
      [Op.or]: [
        { codigo: patron },
        { conceptoPago: patron },
        { placa: patron },
        { matriculaInmobiliaria: patron },
        { numeroFactura: patron },
        { '$beneficiario.nombre$': patron },
        { '$beneficiario.identificacion$': patron },
        ...(/^\d+$/.test(busqueda) ? [{ solicitudTramiteId: Number(busqueda) }] : [])
      ]
    })
  }

  return condiciones
}

const ORDENES: Record<string, Order> = {
  recientes: [['createdAt', 'DESC']],
  antiguos: [['createdAt', 'ASC']],
  pagoReciente: [['fechaPago', 'DESC NULLS LAST'], ['createdAt', 'DESC']],
  valorMayor: [['valorSolicitadoPago', 'DESC']],
  valorMenor: [['valorSolicitadoPago', 'ASC']]
}

export class SolicitudesGastoController {

  // GET /solicitudes  (ver condicionesListado para todos los filtros)
  //   &orden=recientes|antiguos|pagoReciente|valorMayor|valorMenor  &totales=si  &pagina=&tamano=
  static getAll = async (req: Request, res: Response) => {
    try {
      const pagina = Number(req.query.pagina ?? 1)
      const tamano = Number(req.query.tamano ?? 20)
      const where = { [Op.and]: await condicionesListado(req) }

      const [{ count, rows }, sumas] = await Promise.all([
        SolicitudesGasto.findAndCountAll({
          where,
          include: INCLUDES_LISTADO,
          attributes: [
            'id', 'codigo', 'conceptoPago', 'placa', 'matriculaInmobiliaria', 'numeroFactura', 'reembolsable',
            'valorSolicitadoPago', 'valorRealmentePagado',
            'fechaPago', 'createdAt', 'solicitudTramiteId',
            ...ATRIBUTOS_SEGUIMIENTO_TRAMITADOR
          ],
          order: ORDENES[String(req.query.orden)] ?? ORDENES.recientes,
          limit: tamano,
          offset: (pagina - 1) * tamano
        }),
        // Totales de todo lo filtrado (no solo de la página): para el panel de administración
        req.query.totales === 'si'
          ? SolicitudesGasto.findOne({
            where,
            include: [{ model: Terceros, attributes: [] }],
            attributes: [
              [fn('COALESCE', fn('SUM', col('valor_solicitado_pago')), 0), 'solicitado'],
              [fn('COALESCE', fn('SUM', col('valor_realmente_pagado')), 0), 'pagado']
            ],
            raw: true
          })
          : Promise.resolve(null)
      ])

      res.json({
        total: count,
        pagina,
        tamano,
        registros: rows,
        ...(sumas && {
          totales: {
            solicitado: Number((sumas as Record<string, unknown>).solicitado),
            pagado: Number((sumas as Record<string, unknown>).pagado)
          }
        })
      })
    } catch (error) {
      responderError(res, error)
    }
  }

  static getById = async (req: Request, res: Response) => {
    try {
      const { id } = await obtenerGastoConAcceso(req, Number(req.params.id))

      const gasto = await SolicitudesGasto.findByPk(id, {
        include: [
          ...INCLUDES_BASE,
          { model: FormasPago, attributes: ['id', 'codigo', 'nombre'] },
          { model: Tramitador, attributes: ['id', 'nombreTramitador', 'identificacion'] },
          { model: Terceros },
          { model: Usuarios, as: 'actualizador', attributes: ATRIBUTOS_USUARIO },
          { model: Usuarios, as: 'contabilizador', attributes: ATRIBUTOS_USUARIO },
          {
            model: FacturasGasto,
            include: [{ model: Usuarios, as: 'registrador', attributes: ATRIBUTOS_USUARIO }]
          },
          {
            model: TrazabilidadGastos,
            include: [
              { model: EstadosGasto, as: 'estadoAnterior', attributes: ['codigo', 'nombre'] },
              { model: EstadosGasto, as: 'estadoNuevo', attributes: ['codigo', 'nombre'] },
              { model: Usuarios, attributes: ATRIBUTOS_USUARIO }
            ]
          },
          {
            model: Reintegros,
            attributes: ['id', 'valorReintegro', 'fechaReintegro', 'observacion', 'createdAt'],
            include: [
              { model: EstadosReintegro, attributes: ['id', 'codigo', 'nombre'] },
              { model: Usuarios, as: 'registrador', attributes: ATRIBUTOS_USUARIO }
            ]
          },
          {
            // Cuentas de cobro donde ha estado el gasto (incluye anuladas como historial)
            model: CuentasCobroGastos,
            attributes: ['id', 'tieneFacturaReal', 'valorFactura', 'cuatroXMil', 'valorLegalizado', 'nombreTerceroReal', 'identificacionTerceroReal'],
            include: [{
              model: CuentasCobro,
              attributes: ['id', 'numeroCuentaCobro', 'fechaRadicacion'],
              include: [{ model: EstadosCuentaCobro, attributes: ['id', 'codigo', 'nombre'] }]
            }]
          },
          {
            model: DocumentosGasto,
            attributes: ['id', 'nombreOriginal', 'tipoArchivo', 'tamano', 'subidoPor', 'createdAt'],
            include: [
              { model: TiposDocumentoGasto, attributes: ['id', 'nombre'] },
              { model: Usuarios, attributes: ATRIBUTOS_USUARIO }
            ]
          }
        ],
        // sequelize-typescript nombra la relación con el nombre de la propiedad del modelo
        order: [
          [{ model: TrazabilidadGastos, as: 'trazabilidad' }, 'createdAt', 'ASC'],
          [{ model: DocumentosGasto, as: 'documentos' }, 'createdAt', 'DESC']
        ]
      })

      const estado = await codigoEstadoGasto(gasto.estadoId)
      const creadorOAdmin = esCreadorOAdmin(req, gasto)

      // Soportes de los reintegros
      const documentosReintegros = gasto.reintegros.length
        ? await DocumentosGasto.findAll({
          where: { reintegroId: gasto.reintegros.map(r => r.id) },
          attributes: ['id', 'reintegroId', 'nombreOriginal', 'tipoArchivo', 'tamano', 'subidoPor', 'createdAt'],
          include: [
            { model: TiposDocumentoGasto, attributes: ['id', 'nombre'] },
            { model: Usuarios, attributes: ATRIBUTOS_USUARIO }
          ]
        })
        : []

      // Soportes del pago: están en el lote, no en el gasto
      const documentosPago = gasto.lotePagoId
        ? await DocumentosGasto.findAll({
          where: { lotePagoId: gasto.lotePagoId },
          attributes: ['id', 'nombreOriginal', 'tipoArchivo', 'tamano', 'subidoPor', 'createdAt'],
          include: [
            { model: TiposDocumentoGasto, attributes: ['id', 'nombre'] },
            { model: Usuarios, attributes: ATRIBUTOS_USUARIO }
          ],
          order: [['createdAt', 'DESC']]
        })
        : []

      // El frontend usa estos permisos para mostrar u ocultar botones;
      // las rutas igual los validan
      const json = gasto.toJSON()
      const esLegalizacion = puedeGestionarFactura(req, gasto.reembolsable)

      res.json({
        ...json,
        reintegros: json.reintegros.map((r: { id: number }) => ({
          ...r,
          documentos: documentosReintegros.filter(d => d.reintegroId === r.id)
        })),
        documentosPago,
        permisos: {
          // La factura se registra o corrige mientras el gasto no esté en una cuenta de cobro
          registrarFactura: esLegalizacion && (
            ([ESTADOS_GASTO.PAGADO, ESTADOS_GASTO.FACTURADO] as string[]).includes(estado) ||
            // un no reembolsable legalizado puede corregir su factura hasta que se contabilice
            (!gasto.reembolsable && estado === ESTADOS_GASTO.LEGALIZADO)
          ),
          editar: creadorOAdmin && estado === ESTADOS_GASTO.SOLICITADO,
          anular: creadorOAdmin && estado === ESTADOS_GASTO.SOLICITADO,
          subirDocumentos: estado !== ESTADOS_GASTO.ANULADO && estado !== ESTADOS_GASTO.CONTABILIZADO
        }
      })
    } catch (error) {
      responderError(res, error)
    }
  }

  static create = async (req: Request, res: Response) => {
    try {
      const gasto = await crearGasto(req.body, req.usuario.id)

      // Fuera de la transacción: un fallo en el correo no revierte el gasto
      void notificarGastosCreados([gasto.id])

      res.status(201).json({ id: gasto.id, codigo: gasto.codigo })
    } catch (error) {
      responderError(res, error)
    }
  }

  static update = async (req: Request, res: Response) => {
    try {
      const gasto = await obtenerGastoConAcceso(req, Number(req.params.id))

      if (!esCreadorOAdmin(req, gasto)) {
        throw new ErrorGastos('Solo quien creó el gasto puede editarlo', 403)
      }

      await actualizarGasto(gasto, req.body, req.usuario.id)
      res.json({ id: gasto.id, codigo: gasto.codigo })
    } catch (error) {
      responderError(res, error)
    }
  }

  // PUT /solicitudes/:id/factura  — solo Legalización
  // GET /tramites/:id/gastos — gastos de un trámite (pestaña Gastos del frontend de trámites)
  static porTramite = async (req: Request, res: Response) => {
    try {
      const tramite = await SolicitudTramites.findByPk(Number(req.params.id), { attributes: ['id', 'usuarioId'] })

      // Gestión de activos solo ve los gastos de sus propios trámites
      if (!tramite || (soloTramitesPropios(req) && tramite.usuarioId !== req.usuario.id)) {
        throw new ErrorGastos('El trámite no existe', 404)
      }

      const gastos = await SolicitudesGasto.findAll({
        where: { solicitudTramiteId: tramite.id },
        attributes: [
          'id', 'codigo', 'conceptoPago', 'placa', 'matriculaInmobiliaria', 'numeroFactura',
          'valorSolicitadoPago', 'valorRealmentePagado', 'fechaPago', 'numeroEgreso', 'createdAt'
        ],
        include: [
          ...INCLUDES_LISTADO,
          { model: Reintegros, attributes: ['id', 'valorReintegro'], include: [{ model: EstadosReintegro, attributes: ['codigo', 'nombre'] }] }
        ],
        order: [['createdAt', 'DESC']]
      })

      res.json(gastos)
    } catch (error) {
      responderError(res, error)
    }
  }

  // Legalización registra la factura de los reembolsables; Contabilidad la de los no reembolsables
  static registrarFactura = async (req: Request, res: Response) => {
    try {
      const gasto = await SolicitudesGasto.findByPk(Number(req.params.id), { attributes: ['id', 'reembolsable'] })
      if (!gasto) throw new ErrorGastos('El gasto no existe', 404)
      if (!puedeGestionarFactura(req, gasto.reembolsable)) {
        throw new ErrorGastos(gasto.reembolsable
          ? 'La factura de un gasto reembolsable la registra Legalización'
          : 'La factura de un gasto no reembolsable la registra Contabilidad', 403)
      }

      const { diferencia } = await registrarFactura(Number(req.params.id), req.body, req.usuario.id)
      res.json({ diferencia })
    } catch (error) {
      responderError(res, error)
    }
  }

  static anular = async (req: Request, res: Response) => {
    try {
      const gasto = await obtenerGastoConAcceso(req, Number(req.params.id))

      if (!esCreadorOAdmin(req, gasto)) {
        throw new ErrorGastos('Solo quien creó el gasto puede anularlo', 403)
      }

      await anularGasto(gasto, req.body.motivo, req.usuario.id)
      res.json('Gasto anulado correctamente')
    } catch (error) {
      responderError(res, error)
    }
  }
}
