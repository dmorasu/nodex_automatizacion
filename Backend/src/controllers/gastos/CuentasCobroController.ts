import type { Request, Response } from 'express'
import { Op, WhereOptions } from 'sequelize'
import CuentasCobro from '../../models/gastos/cuentasCobro'
import CuentasCobroGastos from '../../models/gastos/cuentasCobroGastos'
import EstadosCuentaCobro from '../../models/gastos/estadosCuentaCobro'
import TrazabilidadCuentasCobro from '../../models/gastos/trazabilidadCuentasCobro'
import Contabilizaciones from '../../models/gastos/contabilizaciones'
import SolicitudesGasto from '../../models/gastos/solicitudesGasto'
import Terceros from '../../models/gastos/terceros'
import Bolsas from '../../models/gastos/bolsas'
import Reintegros from '../../models/gastos/reintegros'
import DocumentosGasto from '../../models/gastos/documentosGasto'
import TiposDocumentoGasto from '../../models/gastos/tiposDocumentoGasto'
import Usuarios from '../../models/usuarios'
import {
  actualizarCuenta,
  agregarGastos,
  anularCuenta,
  crearCuenta,
  estadosCuenta,
  legalizarCuenta,
  quitarLinea
} from '../../services/gastos/cuentasCobro'
import { ROLES_TESORERIA_OPERATIVA, ESTADOS_CUENTA_COBRO, ROLES } from '../../services/gastos/constantes'
import { ErrorGastos } from '../../services/gastos/errores'
import { ATRIBUTOS_USUARIO, esAdmin, responderError } from './utilidades'

const ATRIBUTOS_ESTADO = ['id', 'codigo', 'nombre']

export class CuentasCobroController {

  // GET /cuentas-cobro?estado=&busqueda=&pagina=&tamano=
  static getAll = async (req: Request, res: Response) => {
    try {
      const pagina = Number(req.query.pagina ?? 1)
      const tamano = Number(req.query.tamano ?? 20)
      const busqueda = String(req.query.busqueda ?? '').trim()

      const condiciones: WhereOptions[] = []
      if (req.query.estado) condiciones.push({ estadoId: await estadosCuenta.id(req.query.estado as never) })
      if (busqueda) condiciones.push({ numeroCuentaCobro: { [Op.iLike]: `%${busqueda}%` } })

      const { count, rows } = await CuentasCobro.findAndCountAll({
        where: { [Op.and]: condiciones },
        attributes: ['id', 'numeroCuentaCobro', 'fechaRadicacion', 'totalFacturas', 'totalCuatroXMil', 'totalLegalizado', 'fechaLegalizacion', 'createdAt'],
        include: [
          { model: EstadosCuentaCobro, attributes: ATRIBUTOS_ESTADO },
          { model: Usuarios, as: 'creador', attributes: ATRIBUTOS_USUARIO },
          { model: CuentasCobroGastos, attributes: ['id'] }
        ],
        order: [['id', 'DESC']],
        limit: tamano,
        offset: (pagina - 1) * tamano,
        distinct: true
      })

      res.json({
        total: count,
        pagina,
        tamano,
        registros: rows.map(cuenta => {
          const { lineas, ...datos } = cuenta.toJSON()
          return { ...datos, cantidadGastos: lineas.length }
        })
      })
    } catch (error) {
      responderError(res, error)
    }
  }

  static getById = async (req: Request, res: Response) => {
    try {
      const cuenta = await CuentasCobro.findByPk(Number(req.params.id), {
        include: [
          { model: EstadosCuentaCobro, attributes: ATRIBUTOS_ESTADO },
          { model: Usuarios, as: 'creador', attributes: ATRIBUTOS_USUARIO },
          { model: Contabilizaciones, attributes: ['contabilizado', 'documentoContable', 'fechaContabilizacion'] },
          {
            model: CuentasCobroGastos,
            include: [{
              model: SolicitudesGasto,
              attributes: ['id', 'codigo', 'conceptoPago', 'placa', 'matriculaInmobiliaria', 'valorRealmentePagado', 'fechaPago'],
              include: [
                { model: Terceros, attributes: ['id', 'identificacion', 'nombre'] },
                { model: Bolsas, attributes: ['id', 'nombre'] },
                { model: Reintegros, attributes: ['id', 'valorReintegro'] }
              ]
            }]
          },
          {
            model: TrazabilidadCuentasCobro,
            include: [
              { model: EstadosCuentaCobro, as: 'estadoNuevo', attributes: ['codigo', 'nombre'] },
              { model: Usuarios, attributes: ATRIBUTOS_USUARIO }
            ]
          }
        ],
        order: [
          [{ model: CuentasCobroGastos, as: 'lineas' }, 'id', 'ASC'],
          [{ model: TrazabilidadCuentasCobro, as: 'trazabilidad' }, 'createdAt', 'ASC']
        ]
      })

      if (!cuenta) throw new ErrorGastos('La cuenta de cobro no existe', 404)

      const documentos = await DocumentosGasto.findAll({
        where: { cuentaCobroId: cuenta.id },
        attributes: ['id', 'nombreOriginal', 'tipoArchivo', 'tamano', 'subidoPor', 'createdAt'],
        include: [
          { model: TiposDocumentoGasto, attributes: ['id', 'nombre'] },
          { model: Usuarios, attributes: ATRIBUTOS_USUARIO }
        ],
        order: [['createdAt', 'DESC']]
      })

      const enBorrador = cuenta.estado.codigo === ESTADOS_CUENTA_COBRO.BORRADOR
      const esLegalizacion = req.roles?.includes(ROLES.LEGALIZACION) || esAdmin(req)
      const esTesoreria = (req.roles ?? []).some(rol => ROLES_TESORERIA_OPERATIVA.includes(rol))

      res.json({
        ...cuenta.toJSON(),
        documentos,
        permisos: {
          // Armar la cuenta (datos, gastos, documentos, anular): solo Legalización
          editar: enBorrador && esLegalizacion,
          // Marcarla como legalizada: Legalización o Tesorería
          legalizar: enBorrador && (esLegalizacion || esTesoreria),
          subirDocumentos: esLegalizacion && cuenta.estado.codigo !== ESTADOS_CUENTA_COBRO.ANULADA
        }
      })
    } catch (error) {
      responderError(res, error)
    }
  }

  static create = async (req: Request, res: Response) => {
    try {
      const cuenta = await crearCuenta(req.body, req.usuario.id)
      res.status(201).json({ id: cuenta.id })
    } catch (error) {
      responderError(res, error)
    }
  }

  static update = async (req: Request, res: Response) => {
    try {
      await actualizarCuenta(Number(req.params.id), req.body)
      res.json('Cuenta de cobro actualizada')
    } catch (error) {
      responderError(res, error)
    }
  }

  // POST /cuentas-cobro/:id/gastos  { gastoIds: [...] }
  static agregarGastos = async (req: Request, res: Response) => {
    try {
      await agregarGastos(Number(req.params.id), req.body.gastoIds, req.usuario.id)
      res.json(`${req.body.gastoIds.length} gasto(s) agregado(s)`)
    } catch (error) {
      responderError(res, error)
    }
  }

  static quitarLinea = async (req: Request, res: Response) => {
    try {
      await quitarLinea(Number(req.params.id), Number(req.params.lineaId), req.usuario.id)
      res.json('Gasto retirado de la cuenta de cobro')
    } catch (error) {
      responderError(res, error)
    }
  }

  // POST /cuentas-cobro/:id/legalizar  { fechaRadicacion? }
  static legalizar = async (req: Request, res: Response) => {
    try {
      await legalizarCuenta(Number(req.params.id), req.body.fechaRadicacion ?? null, req.usuario.id)
      res.json('Cuenta de cobro legalizada')
    } catch (error) {
      responderError(res, error)
    }
  }

  static anular = async (req: Request, res: Response) => {
    try {
      await anularCuenta(Number(req.params.id), req.body.motivo, req.usuario.id)
      res.json('Cuenta de cobro anulada')
    } catch (error) {
      responderError(res, error)
    }
  }
}
