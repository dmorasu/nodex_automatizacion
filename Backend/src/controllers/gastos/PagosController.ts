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
import { pagarGastos } from '../../services/gastos/pagos'
import { notificarGastosPagados } from '../../services/gastos/notificacionesGastos'
import { ErrorGastos } from '../../services/gastos/errores'
import { ATRIBUTOS_USUARIO, esAdmin, idsTiposCertificados, responderError, soloCertificados } from './utilidades'
import { ROLES } from '../../services/gastos/constantes'

// Las compras de certificados (CTL y Cámara de Comercio) las paga Tesorería - Certificados;
// los demás gastos, Tesorería. El administrador paga ambos.
const verificarQuienPaga = async (req: Request, gastoIds: number[]) => {
  if (esAdmin(req)) return
  const roles = req.roles ?? []
  const certificados = await idsTiposCertificados()
  const gastos = await SolicitudesGasto.findAll({ where: { id: gastoIds }, attributes: ['id', 'codigo', 'tipoGastoId'] })

  const deCertificados = gastos.filter(g => certificados.includes(g.tipoGastoId))
  const generales = gastos.filter(g => !certificados.includes(g.tipoGastoId))

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

export class PagosController {

  // POST /pagos  { bolsaId, fechaPago, numeroEgreso, observacion, gastos: [{ id, valorRealmentePagado }] }
  static pagar = async (req: Request, res: Response) => {
    try {
      await verificarQuienPaga(req, (req.body.gastos as { id: number }[]).map(g => Number(g.id)))
      const lote = await pagarGastos(req.body, req.usuario.id)

      // Fuera de la transacción: un fallo en el correo no revierte el pago
      void notificarGastosPagados(req.body.gastos.map((g: { id: number }) => g.id))

      res.status(201).json({ loteId: lote.id, total: lote.total })
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

      // Contabilidad filtra los pagos según tengan o no número de egreso
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
        attributes: ['id', 'fechaPago', 'numeroEgreso', 'total', 'createdAt'],
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
          {
            model: SolicitudesGasto,
            attributes: ['id', 'codigo', 'conceptoPago', 'valorSolicitadoPago', 'valorRealmentePagado'],
            include: [
              { model: Terceros, attributes: ['id', 'identificacion', 'nombre'] },
              { model: Usuarios, as: 'creador', attributes: ATRIBUTOS_USUARIO }
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
