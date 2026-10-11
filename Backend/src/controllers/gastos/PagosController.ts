import type { Request, Response } from 'express'
import { Op, WhereOptions, literal } from 'sequelize'
import { db } from '../../config/db'
import LotesPago from '../../models/gastos/lotesPago'
import SolicitudesGasto from '../../models/gastos/solicitudesGasto'
import DocumentosGasto from '../../models/gastos/documentosGasto'
import TiposDocumentoGasto from '../../models/gastos/tiposDocumentoGasto'
import Bolsas from '../../models/gastos/bolsas'
import Terceros from '../../models/gastos/terceros'
import Usuarios from '../../models/usuarios'
import EstadosGasto from '../../models/gastos/estadosGasto'
import Anticipos from '../../models/gastos/anticipos'
import { atributosSaldoAnticipo } from './SolicitudesGastoController'
import { aprobarGastos, confirmarPago, confirmarPagos, pagarDirecto, programarPago, sacarDelLote } from '../../services/gastos/pagos'
import { notificarGastosPagados, notificarLoteProgramado, notificarRevisionLote } from '../../services/gastos/notificacionesGastos'
import { ErrorGastos } from '../../services/gastos/errores'
import { ATRIBUTOS_USUARIO, esAdmin, idsTiposCertificados, responderError, soloCertificados } from './utilidades'
import { ESTADOS_LOTE, FORMA_PAGO_CAJA_MENOR, ROLES } from '../../services/gastos/constantes'
import FormasPago from '../../models/gastos/formasPago'

// Las compras de certificados (CTL y Cámara de Comercio) las paga Tesorería - Certificados;
// los demás gastos, Tesorería (también los de anticipos, aunque sean de un certificado).
// El administrador paga todo.
const verificarQuienPaga = async (req: Request, gastoIds: number[]) => {
  if (esAdmin(req)) return
  const roles = req.roles ?? []
  const certificados = await idsTiposCertificados()
  const gastos = await SolicitudesGasto.findAll({ where: { id: gastoIds }, attributes: ['id', 'codigo', 'tipoGastoId', 'anticipoId'] })

  const esCertificado = (g: SolicitudesGasto) => !g.anticipoId && certificados.includes(g.tipoGastoId)
  const deCertificados = gastos.filter(esCertificado)
  const generales = gastos.filter(g => !esCertificado(g))

  if (deCertificados.length && !roles.includes(ROLES.TESORERIA_CERTIFICADOS)) {
    throw new ErrorGastos(`Las compras de certificados las paga Tesorería - Certificados (${deCertificados.map(g => g.codigo).join(', ')})`, 403)
  }
  if (generales.length && !roles.includes(ROLES.TESORERIA)) {
    throw new ErrorGastos(`Solo puede pagar compras de certificados (${generales.map(g => g.codigo).join(', ')} no lo son)`, 403)
  }
}

// Lotes que tienen al menos una compra de certificados (lo que ve Tesorería - Certificados)
const LOTES_CON_CERTIFICADOS = (ids: number[]) => literal(`(
  SELECT g.lote_pago_id FROM gastos_solicitudes g
  WHERE g.lote_pago_id IS NOT NULL AND g.tipo_gasto_id IN (${ids.map(Number).join(',') || 'NULL'})
)`)

// Los certificados y los gastos de anticipos (el cliente ya pagó) se pagan directo; los demás
// gastos se programan para aprobación de Dirección
const verificarFlujo = async (gastoIds: number[], flujo: 'directo' | 'programado') => {
  const certificados = await idsTiposCertificados()
  const gastos = await SolicitudesGasto.findAll({ where: { id: gastoIds }, attributes: ['codigo', 'tipoGastoId', 'anticipoId', 'formaPagoId'] })

  // Los de caja menor se pagan en efectivo desde Tesorería → Caja menor
  const formaCaja = await FormasPago.findOne({ where: { codigo: FORMA_PAGO_CAJA_MENOR }, attributes: ['id'] })
  const deCaja = gastos.filter(g => g.formaPagoId === formaCaja?.id)
  if (deCaja.length) throw new ErrorGastos(`${deCaja.map(g => g.codigo).join(', ')} se paga${deCaja.length > 1 ? 'n' : ''} por caja menor (Tesorería → Caja menor)`)
  const esDirecto = (g: SolicitudesGasto) => Boolean(g.anticipoId) || certificados.includes(g.tipoGastoId)
  const fuera = gastos.filter(g => esDirecto(g) !== (flujo === 'directo'))
  if (!fuera.length) return
  const codigos = fuera.map(g => g.codigo).join(', ')
  throw new ErrorGastos(flujo === 'directo'
    ? `Solo las compras de certificados y los gastos de anticipos se pagan directo; ${codigos} se debe programar para aprobación de Dirección de Negocio`
    : `Las compras de certificados y los gastos de anticipos se pagan directo, sin aprobación de Dirección (${codigos})`)
}

const idsDelLote = async (loteId: number) =>
  (await SolicitudesGasto.findAll({ where: { lotePagoId: loteId }, attributes: ['id'] })).map(g => g.id)

export class PagosController {

  // POST /lotes  { bolsaId, fechaPago, observacion, gastos: [{ id, valorProgramado }] }
  // Programa el pago: los gastos quedan esperando la aprobación de Dirección de Negocio
  static programar = async (req: Request, res: Response) => {
    try {
      const ids = (req.body.gastos as { id: number }[]).map(g => Number(g.id))
      await verificarQuienPaga(req, ids)
      await verificarFlujo(ids, 'programado')
      const lote = await programarPago(req.body, req.usuario.id)

      // Fuera de la transacción: un fallo en el correo no revierte la programación
      void notificarLoteProgramado(lote.id)

      res.status(201).json({ loteId: lote.id, total: lote.total })
    } catch (error) {
      responderError(res, error)
    }
  }

  // POST /pagos  { bolsaId, fechaPago, observacion, gastos: [{ id, valorRealmentePagado }] }
  // Pago directo, solo para compras de certificados (sin aprobación de Dirección de Negocio)
  static pagarCertificados = async (req: Request, res: Response) => {
    try {
      const ids = (req.body.gastos as { id: number }[]).map(g => Number(g.id))
      await verificarQuienPaga(req, ids)
      await verificarFlujo(ids, 'directo')
      const lote = await pagarDirecto(req.body, req.usuario.id)

      // Fuera de la transacción: un fallo en el correo no revierte el pago
      void notificarGastosPagados(ids)

      res.status(201).json({ loteId: lote.id, total: lote.total })
    } catch (error) {
      responderError(res, error)
    }
  }

  // POST /lotes/:id/aprobar  { gastoIds? }  (Dirección de Negocio; sin gastoIds aprueba todos)
  static aprobar = async (req: Request, res: Response) => {
    try {
      const lote = await aprobarGastos(Number(req.params.id), req.body.gastoIds ?? null, req.usuario.id)
      if (lote.estado === ESTADOS_LOTE.APROBADO) void notificarRevisionLote(lote.id, [], null)
      res.json({ estado: lote.estado, total: lote.total })
    } catch (error) {
      responderError(res, error)
    }
  }

  // POST /lotes/:id/rechazar  { gastoIds, motivo }  (Dirección de Negocio: vuelven a Por pagar)
  static rechazar = async (req: Request, res: Response) => {
    try {
      const loteId = Number(req.params.id)
      const lote = await sacarDelLote(loteId, req.body.gastoIds, req.body.motivo, req.usuario.id, 'DIRECCION')
      void notificarRevisionLote(lote.id, req.body.gastoIds, req.body.motivo)
      res.json({ estado: lote.estado, total: lote.total })
    } catch (error) {
      responderError(res, error)
    }
  }

  // POST /lotes/:id/quitar  { gastoIds, motivo }  (Tesorería, antes de confirmar el pago)
  static quitar = async (req: Request, res: Response) => {
    try {
      const loteId = Number(req.params.id)
      await verificarQuienPaga(req, await idsDelLote(loteId))
      const lote = await sacarDelLote(loteId, req.body.gastoIds, req.body.motivo, req.usuario.id, 'TESORERIA')
      res.json({ estado: lote.estado, total: lote.total })
    } catch (error) {
      responderError(res, error)
    }
  }

  // POST /lotes/:id/confirmar  { fechaPago, observacion }  (Tesorería, con el soporte del banco adjunto)
  static confirmar = async (req: Request, res: Response) => {
    try {
      const loteId = Number(req.params.id)
      await verificarQuienPaga(req, await idsDelLote(loteId))
      const { lote, gastoIds } = await confirmarPago(loteId, req.body, req.usuario.id)

      // Fuera de la transacción: un fallo en el correo no revierte el pago
      void notificarGastosPagados(gastoIds)

      res.json({ loteId: lote.id, total: lote.total })
    } catch (error) {
      responderError(res, error)
    }
  }

  // POST /lotes/confirmar  (multipart: datos = { loteIds, fechaPago, observacion }, archivos[])
  // Confirma uno o varios lotes aprobados con el soporte del banco (puede ser uno para todos)
  static confirmarVarios = async (req: Request, res: Response) => {
    try {
      const loteIds = (req.body.loteIds as unknown[]).map(Number)
      const gastosDeLosLotes = (await SolicitudesGasto.findAll({ where: { lotePagoId: loteIds }, attributes: ['id'] })).map(g => g.id)
      await verificarQuienPaga(req, gastosDeLosLotes)

      const archivos = (req.files ?? []) as Express.Multer.File[]
      const { gastoIds } = await confirmarPagos(loteIds, req.body, archivos, req.usuario.id)

      // Fuera de la transacción: un fallo en el correo no revierte el pago
      void notificarGastosPagados(gastoIds)

      res.json({ lotes: loteIds.length, gastos: gastoIds.length })
    } catch (error) {
      responderError(res, error)
    }
  }

  // GET /lotes?pagina=&tamano=&egreso=pendiente|registrado&busqueda=&bolsaId=&desde=&hasta=
  // (más recientes primero)
  static getLotes = async (req: Request, res: Response) => {
    try {
      const pagina = Number(req.query.pagina ?? 1)
      const tamano = Number(req.query.tamano ?? 20)
      const textoBusqueda = String(req.query.busqueda ?? '').trim()
      // "#12" busca exactamente el lote 12; cualquier otro texto busca en todo
      const loteExacto = /^#\d+$/.test(textoBusqueda) ? Number(textoBusqueda.slice(1)) : null
      const busqueda = loteExacto ? '' : textoBusqueda

      const condiciones: WhereOptions[] = []

      // Contabilidad filtra los pagos según tengan o no número de egreso (solo los ya pagados)
      if (req.query.egreso) condiciones.push({ estado: ESTADOS_LOTE.PAGADO })
      if (req.query.estado) condiciones.push({ estado: String(req.query.estado).split(',') })

      if (req.query.egreso === 'pendiente') {
        condiciones.push({ [Op.or]: [{ numeroEgreso: null }, { numeroEgreso: '' }] })
      } else if (req.query.egreso === 'registrado') {
        condiciones.push({ [Op.and]: [{ numeroEgreso: { [Op.ne]: null } }, { numeroEgreso: { [Op.ne]: '' } }] })
      }

      if (req.query.bolsaId) condiciones.push({ bolsaId: Number(req.query.bolsaId) })
      // Tesorería - Certificados solo ve los pagos de compras de certificados
      if (soloCertificados(req)) condiciones.push({ id: { [Op.in]: LOTES_CON_CERTIFICADOS(await idsTiposCertificados()) } })
      if (loteExacto) condiciones.push({ id: loteExacto })
      if (req.query.desde) condiciones.push({ fechaPago: { [Op.gte]: String(req.query.desde) } })
      if (req.query.hasta) condiciones.push({ fechaPago: { [Op.lte]: String(req.query.hasta) } })

      // Búsqueda: número de lote, egreso, o cualquiera de sus gastos (código, concepto, beneficiario).
      // El texto se escapa para evitar inyección SQL.
      if (busqueda) {
        const patron = db.escape(`%${busqueda}%`)
        condiciones.push({
          [Op.or]: [
            ...(/^\d+$/.test(busqueda) ? [{ id: Number(busqueda) }] : []),
            { numeroEgreso: { [Op.iLike]: `%${busqueda}%` } },
            {
              id: {
                [Op.in]: literal(`(
                  SELECT g.lote_pago_id
                  FROM gastos_solicitudes g
                  LEFT JOIN gastos_terceros t ON t.id = g.beneficiario_id
                  WHERE g.lote_pago_id IS NOT NULL
                    AND (g.codigo ILIKE ${patron} OR g.concepto_pago ILIKE ${patron}
                      OR t.nombre ILIKE ${patron} OR t.identificacion ILIKE ${patron})
                )`)
              }
            }
          ]
        })
      }

      const { count, rows } = await LotesPago.findAndCountAll({
        where: { [Op.and]: condiciones },
        attributes: ['id', 'estado', 'fechaPago', 'numeroEgreso', 'total', 'createdAt'],
        include: [
          { model: Bolsas, attributes: ['id', 'nombre'] },
          { model: Usuarios, as: 'creador', attributes: ATRIBUTOS_USUARIO },
          { model: SolicitudesGasto, attributes: ['id', 'codigo'] }
        ],
        order: [['id', 'DESC'], [{ model: SolicitudesGasto, as: 'gastos' }, 'codigo', 'ASC']],
        limit: tamano,
        offset: (pagina - 1) * tamano,
        distinct: true
      })

      res.json({
        total: count,
        pagina,
        tamano,
        registros: rows.map(lote => {
          const { gastos, ...datos } = lote.toJSON()
          return { ...datos, cantidadGastos: gastos.length, gastos }
        })
      })
    } catch (error) {
      responderError(res, error)
    }
  }

  static getLote = async (req: Request, res: Response) => {
    try {
      const lote = await LotesPago.findByPk(Number(req.params.id), {
        include: [
          { model: Bolsas, attributes: ['id', 'nombre'] },
          { model: Usuarios, as: 'creador', attributes: ATRIBUTOS_USUARIO },
          { model: Usuarios, as: 'aprobador', attributes: ATRIBUTOS_USUARIO },
          { model: Usuarios, as: 'confirmador', attributes: ATRIBUTOS_USUARIO },
          {
            model: SolicitudesGasto,
            // Gastos de anticipos: saldo del cliente, para avisar si no le alcanza
            attributes: ['id', 'codigo', 'conceptoPago', 'valorSolicitadoPago', 'valorProgramado', 'valorRealmentePagado', 'anticipoId', ...atributosSaldoAnticipo('gastos')],
            include: [
              { model: Terceros, attributes: ['id', 'identificacion', 'nombre'] },
              { model: Anticipos, attributes: ['id', 'codigo'], include: [{ model: Terceros, attributes: ['nombre'] }] },
              { model: Usuarios, as: 'creador', attributes: ATRIBUTOS_USUARIO },
              { model: EstadosGasto, attributes: ['codigo', 'nombre'] }
            ]
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
        order: [[{ model: SolicitudesGasto, as: 'gastos' }, 'codigo', 'ASC']]
      })

      if (!lote) throw new ErrorGastos('El lote de pago no existe', 404)
      if (soloCertificados(req)) {
        const certificados = await idsTiposCertificados()
        const conCertificados = await SolicitudesGasto.count({ where: { lotePagoId: lote.id, tipoGastoId: certificados } })
        if (!conCertificados) throw new ErrorGastos('El lote de pago no existe', 404)
      }

      res.json(lote)
    } catch (error) {
      responderError(res, error)
    }
  }
}
