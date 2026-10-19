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
import { ATRIBUTOS_USUARIO, esAdmin, esAuxiliarCaja, idsTiposCertificados, puedeGestionarFactura, puedeVerTodos, responderError, soloCertificados } from './utilidades'
import { cajaDelUsuario } from '../../services/gastos/cajaMenor'
import LegalizacionesCaja from '../../models/gastos/legalizacionesCaja'
import ReembolsosCaja from '../../models/gastos/reembolsosCaja'
import SolicitudTramites from '../../models/solicitudTramites'
import Anticipos from '../../models/gastos/anticipos'
import { creadoresPermitidos, usuariosDeMiArea } from '../../middleware/auth'
import { avisoSaldoCliente, saldoDelCliente } from '../../services/gastos/anticipos'
import { obtenerAnticipoConAcceso } from './AnticiposController'
import { tiposDocumentoDelGasto } from '../../services/gastos/tiposDocumento'
import { programacionDelGasto } from '../../services/gastos/programacionPago'

// Gastos de anticipos: saldo del cliente en la bolsa y lo que tiene por pagar (incluido este
// gasto), para avisar en Tesorería y en Dirección de Negocio si no le alcanza. null si no es de anticipo.
// `tabla` = alias del gasto en la consulta ("gastos" cuando va incluido en un lote)
export const atributosSaldoAnticipo = (tabla = 'SolicitudesGasto'): [ReturnType<typeof literal>, string][] => [
  [literal(`(
    SELECT COALESCE(SUM(m.valor), 0) FROM gastos_anticipos a
    JOIN gastos_movimientos_bolsa m ON m.bolsa_id = a.bolsa_id AND m.cliente_id = a.cliente_id
    WHERE a.id = "${tabla}"."anticipo_id"
  )`), 'saldoClienteAnticipo'],
  [literal(`(
    SELECT COALESCE(SUM(COALESCE(g2.valor_programado, g2.valor_solicitado_pago)), 0)
    FROM gastos_anticipos a
    JOIN gastos_anticipos a2 ON a2.bolsa_id = a.bolsa_id AND a2.cliente_id = a.cliente_id
    JOIN gastos_solicitudes g2 ON g2.anticipo_id = a2.id
    JOIN gastos_estados_gasto e2 ON e2.id = g2.estado_id AND e2.codigo IN ('SOLICITADO', 'PROGRAMADO', 'APROBADO_PAGO')
    WHERE a.id = "${tabla}"."anticipo_id"
  )`), 'comprometidoClienteAnticipo']
]

// Quién gestiona un gasto (editar, anular, subir documentos): su creador, los roles del módulo
// (Tesorería - Certificados solo las compras de certificados) o la auxiliar de la caja menor del gasto
export const puedeGestionarGasto = async (req: Request, gasto: SolicitudesGasto) => {
  if (gasto.creadoPor === req.usuario.id) return true
  if (soloCertificados(req)) return (await idsTiposCertificados()).includes(gasto.tipoGastoId)
  if (puedeVerTodos(req)) return true
  return esAuxiliarCaja(req) && (await cajaDelUsuario(req.usuario.id))?.id === gasto.bolsaId
}

// Busca el gasto y verifica que el usuario pueda usarlo.
// Para solo ver (soloLectura) también sirven los gastos que crearon los de su área (los encuentra
// al buscar). A quien no puede se le responde 404 (no se revela que existe).
export const obtenerGastoConAcceso = async (req: Request, id: number, { soloLectura = false } = {}) => {
  const gasto = await SolicitudesGasto.findByPk(id)
  const puede = gasto && (
    await puedeGestionarGasto(req, gasto) ||
    (soloLectura && (await usuariosDeMiArea(req)).includes(gasto.creadoPor))
  )
  if (!puede) throw new ErrorGastos('El gasto no existe', 404)
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
  { model: Tramitador, attributes: ['id', 'nombreTramitador'] },
  // Caja menor: lo que registró Tesorería al legalizar (bandejas de caja menor)
  { model: LegalizacionesCaja, attributes: ['id', 'numeroFactura', 'fechaFactura', 'beneficiario', 'quienLegaliza', 'valorSoporte', 'diferencia', 'reembolsoCajaId'] },
  { model: Anticipos, attributes: ['id', 'codigo'] }
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
//  cajaMenor=si|no (gastos que salen de una caja menor)
//  Sin rol (o en "mis gastos") se ven los propios; al buscar o filtrar por operación, también los
//  que crearon los de su misma área
const condicionesListado = async (req: Request) => {
  const q = req.query
  const condiciones: WhereOptions[] = []

  // Sin rol solo se ven los propios, aunque pida "todos". La auxiliar de caja menor ve los de su caja
  let alcance: WhereOptions | null = null
  if (q.alcance === 'todos' && !puedeVerTodos(req) && esAuxiliarCaja(req)) {
    alcance = { bolsaId: (await cajaDelUsuario(req.usuario.id))?.id ?? -1 }
  } else if (q.alcance !== 'todos' || !puedeVerTodos(req)) {
    const buscando = String(q.busqueda ?? '').trim() || q.operacionId
    alcance = { creadoPor: buscando ? await usuariosDeMiArea(req) : req.usuario.id }
  }

  // Gastos que se pagan por caja menor (cajaMenor=si) o el resto (cajaMenor=no)
  if (q.cajaMenor === 'si' || q.cajaMenor === 'no') {
    condiciones.push({
      bolsaId: { [q.cajaMenor === 'si' ? Op.in : Op.notIn]: literal(`(SELECT b.id FROM gastos_bolsas b WHERE b.tipo = 'CAJA_MENOR')`) }
    })
  }

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
  // Gastos de anticipos: Tesorería los paga directo en su propia bandeja
  if (q.anticipo) condiciones.push({ anticipoId: q.anticipo === 'si' ? { [Op.ne]: null } : null })

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
    const coincidencias: WhereOptions = {
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
    }
    condiciones.push(coincidencias)
  }
  if (alcance) condiciones.push(alcance)

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
            'fechaPago', 'createdAt', 'solicitudTramiteId', 'anticipoId',
            ...ATRIBUTOS_SEGUIMIENTO_TRAMITADOR,
            ...atributosSaldoAnticipo()
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
      // También lo ven los de su área; editar, anular y subir documentos queda para quien lo gestiona
      const encontrado = await obtenerGastoConAcceso(req, Number(req.params.id), { soloLectura: true })
      const gestiona = await puedeGestionarGasto(req, encontrado)

      const gasto = await SolicitudesGasto.findByPk(encontrado.id, {
        include: [
          ...INCLUDES_BASE,
          { model: FormasPago, attributes: ['id', 'codigo', 'nombre'] },
          { model: Tramitador, attributes: ['id', 'nombreTramitador', 'identificacion'] },
          { model: Terceros },
          { model: Usuarios, as: 'actualizador', attributes: ATRIBUTOS_USUARIO },
          { model: Usuarios, as: 'contabilizador', attributes: ATRIBUTOS_USUARIO },
          {
            model: Anticipos,
            attributes: ['id', 'codigo', 'tipo', 'valorRecibido', 'reciboCaja', 'bolsaId', 'clienteId'],
            include: [{ model: Terceros, attributes: ['id', 'nombre', 'tipoIdentificacion', 'identificacion'] }]
          },
          {
            model: FacturasGasto,
            include: [{ model: Usuarios, as: 'registrador', attributes: ATRIBUTOS_USUARIO }]
          },
          {
            // Legalización en caja menor y el reembolso donde está
            model: LegalizacionesCaja,
            include: [
              { model: Usuarios, as: 'registrador', attributes: ATRIBUTOS_USUARIO },
              { model: ReembolsosCaja, attributes: ['id', 'codigo', 'estado', 'fechaLegalizacion'] }
            ]
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

      // Soportes del pago: están en el lote, no en el gasto (el del banco puede traer otros
      // gastos del lote: no se muestra a quien solo ve el gasto)
      const documentosPago = gasto.lotePagoId && gestiona
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
        // Gasto de un anticipo: cómo va el saldo del cliente en la bolsa
        saldoAnticipo: gasto.anticipo ? await saldoDelCliente(gasto.anticipo.bolsaId, gasto.anticipo.clienteId) : null,
        // Tipos de documento que se pueden subir en la etapa actual del gasto
        tiposDocumento: gestiona ? await tiposDocumentoDelGasto(gasto) : [],
        permisos: {
          // La factura se registra o corrige mientras el gasto no esté en una cuenta de cobro
          registrarFactura: esLegalizacion && (
            ([ESTADOS_GASTO.PAGADO, ESTADOS_GASTO.FACTURADO] as string[]).includes(estado) ||
            // un no reembolsable legalizado puede corregir su factura hasta que se contabilice
            (!gasto.reembolsable && estado === ESTADOS_GASTO.LEGALIZADO)
          ),
          editar: creadorOAdmin && estado === ESTADOS_GASTO.SOLICITADO,
          anular: creadorOAdmin && estado === ESTADOS_GASTO.SOLICITADO,
          subirDocumentos: gestiona && estado !== ESTADOS_GASTO.ANULADO && estado !== ESTADOS_GASTO.CONTABILIZADO,
          soloLectura: !gestiona
        }
      })
    } catch (error) {
      responderError(res, error)
    }
  }

  static create = async (req: Request, res: Response) => {
    try {
      // El gasto de un anticipo lo crea quien registró el anticipo (o un administrador)
      if (req.body.anticipoId) {
        const anticipo = await obtenerAnticipoConAcceso(req, Number(req.body.anticipoId))
        if (anticipo.creadoPor !== req.usuario.id && !esAdmin(req)) {
          throw new ErrorGastos('Solo quien registró el anticipo puede crear sus gastos', 403)
        }
      }

      const gasto = await crearGasto(req.body, req.usuario.id)

      // Fuera de la transacción: un fallo en el correo no revierte el gasto
      void notificarGastosCreados([gasto.id])

      // Se crea aunque supere el saldo del cliente, pero se avisa en pantalla
      const avisoSaldo = gasto.anticipoId ? await avisoSaldoCliente(gasto.anticipoId) : null

      // Cuándo lo programa Tesorería (para el aviso en pantalla). La caja menor no se programa:
      // se paga en efectivo. Si no se puede calcular, el gasto se crea igual sin el aviso
      const deCaja = (await FormasPago.findByPk(gasto.formaPagoId, { attributes: ['codigo'] }))?.codigo === 'CAJA_MENOR'
      const programacion = deCaja ? null : await programacionDelGasto(gasto.createdAt).catch(() => null)

      res.status(201).json({ id: gasto.id, codigo: gasto.codigo, avisoSaldo, programacion })
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
      const avisoSaldo = gasto.anticipoId ? await avisoSaldoCliente(gasto.anticipoId) : null
      res.json({ id: gasto.id, codigo: gasto.codigo, avisoSaldo })
    } catch (error) {
      responderError(res, error)
    }
  }

  // PUT /solicitudes/:id/factura  — solo Legalización
  // GET /tramites/:id/gastos — gastos de un trámite (pestaña Gastos del frontend de trámites)
  static porTramite = async (req: Request, res: Response) => {
    try {
      const tramite = await SolicitudTramites.findByPk(Number(req.params.id), { attributes: ['id', 'usuarioId'] })

      // Gestión de activos solo ve los gastos de los trámites que crearon él o los de su área
      const permitidos = tramite && await creadoresPermitidos(req)
      if (!tramite || (permitidos && !permitidos.includes(tramite.usuarioId))) {
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
