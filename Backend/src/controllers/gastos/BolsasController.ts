import type { Request, Response } from 'express'
import { db } from '../../config/db'
import Bolsas from '../../models/gastos/bolsas'
import MovimientosBolsa from '../../models/gastos/movimientosBolsa'
import SolicitudesGasto from '../../models/gastos/solicitudesGasto'
import Usuarios from '../../models/usuarios'
import Terceros from '../../models/gastos/terceros'
import Anticipos from '../../models/gastos/anticipos'
import { registrarMovimientos } from '../../services/gastos/bolsas'
import { arqueoDeBolsa, estadoDeCuentaCliente, type FiltroArqueo, type OrdenArqueo } from '../../services/gastos/anticipos'
import { generarExcelArqueo, generarExcelEstadoCuenta } from '../../services/gastos/excelArqueo'
import { llevaSaldoPorCliente, TIPOS_BOLSA, TIPOS_MOVIMIENTO_BOLSA } from '../../services/gastos/constantes'
import { ErrorGastos } from '../../services/gastos/errores'
import { ATRIBUTOS_USUARIO, responderError } from './utilidades'

const bolsaDeAnticipos = async (id: number) => {
  const bolsa = await Bolsas.findByPk(id, { attributes: ['id', 'nombre', 'tipo', 'saldoActual'] })
  if (!bolsa) throw new ErrorGastos('La bolsa no existe', 404)
  if (!llevaSaldoPorCliente(bolsa.tipo)) throw new ErrorGastos('Solo las bolsas de anticipos llevan saldo por cliente')
  return bolsa
}

const periodo = (req: Request) => ({ desde: (req.query.desde as string) || null, hasta: (req.query.hasta as string) || null })
const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
// "Bolsa Anticipos 01" → "bolsa-anticipos-01"
const nombreArchivo = (texto: string) =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()

const enviarExcel = (res: Response, archivo: Buffer, nombre: string) => {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`)
  res.send(archivo)
}

// Administración de bolsas (Tesorería / Admin).
// El saldo NO se edita aquí: solo cambia con movimientos (recargas, pagos, ...)
export class BolsasController {

  static getAll = async (req: Request, res: Response) => {
    try {
      const bolsas = await Bolsas.findAll({
        attributes: ['id', 'nombre', 'lineaNegocio', 'tipo', 'saldoActual', 'activo'],
        order: [['activo', 'DESC'], ['nombre', 'ASC']]
      })
      res.json(bolsas)
    } catch (error) {
      responderError(res, error)
    }
  }

  static create = async (req: Request, res: Response) => {
    try {
      const { nombre, lineaNegocio, tipo } = req.body

      if (await Bolsas.findOne({ where: { nombre } })) {
        throw new ErrorGastos(`Ya existe una bolsa llamada ${nombre}`, 409)
      }

      // El tipo se define al crearla y no cambia (la de anticipos lleva saldo por cliente)
      const bolsa = await Bolsas.create({ nombre, lineaNegocio: lineaNegocio || null, tipo: tipo || TIPOS_BOLSA.GENERAL })
      res.status(201).json({ id: bolsa.id })
    } catch (error) {
      responderError(res, error)
    }
  }

  // POST /bolsas/:id/recargas  { valor, observacion }
  static recargar = async (req: Request, res: Response) => {
    try {
      const bolsa = await Bolsas.findByPk(Number(req.params.id), { attributes: ['id', 'tipo'] })
      if (bolsa && llevaSaldoPorCliente(bolsa.tipo)) {
        throw new ErrorGastos('Las bolsas de anticipos no se recargan: se llenan con lo que confirma Contabilidad')
      }
      if (bolsa?.tipo === TIPOS_BOLSA.CAJA_MENOR) {
        throw new ErrorGastos('Las cajas menores se reponen con los reembolsos (o cambiando su fondo en Tesorería → Caja menor)')
      }

      const { saldoFinal } = await db.transaction(transaction =>
        registrarMovimientos(Number(req.params.id), [{
          tipo: TIPOS_MOVIMIENTO_BOLSA.RECARGA,
          valor: Number(req.body.valor),
          observacion: req.body.observacion || null
        }], req.usuario.id, transaction)
      )

      res.status(201).json({ saldo: saldoFinal })
    } catch (error) {
      responderError(res, error)
    }
  }

  // POST /bolsas/:id/ajustes  { valor (±), observacion, clienteId }  — solo ADMIN
  // En una bolsa de anticipos el ajuste es al saldo de un cliente (clienteId obligatorio)
  static ajustar = async (req: Request, res: Response) => {
    try {
      const { saldoFinal } = await db.transaction(transaction =>
        registrarMovimientos(Number(req.params.id), [{
          tipo: TIPOS_MOVIMIENTO_BOLSA.AJUSTE,
          valor: Number(req.body.valor),
          clienteId: req.body.clienteId ? Number(req.body.clienteId) : null,
          observacion: req.body.observacion
        }], req.usuario.id, transaction)
      )

      res.status(201).json({ saldo: saldoFinal })
    } catch (error) {
      responderError(res, error)
    }
  }

  // GET /bolsas/:id/movimientos?pagina=&tamano=  (más recientes primero)
  static movimientos = async (req: Request, res: Response) => {
    try {
      const bolsa = await Bolsas.findByPk(Number(req.params.id), {
        attributes: ['id', 'nombre', 'lineaNegocio', 'tipo', 'saldoActual', 'activo']
      })
      if (!bolsa) throw new ErrorGastos('La bolsa no existe', 404)

      const pagina = Number(req.query.pagina ?? 1)
      const tamano = Number(req.query.tamano ?? 30)

      const { count, rows } = await MovimientosBolsa.findAndCountAll({
        where: { bolsaId: bolsa.id },
        attributes: ['id', 'tipo', 'valor', 'saldoResultante', 'lotePagoId', 'observacion', 'createdAt'],
        include: [
          { model: SolicitudesGasto, attributes: ['id', 'codigo'] },
          { model: Usuarios, attributes: ATRIBUTOS_USUARIO },
          // Bolsas de anticipos: de qué cliente y anticipo es cada movimiento
          { model: Terceros, attributes: ['id', 'nombre', 'identificacion'] },
          { model: Anticipos, attributes: ['id', 'codigo'] }
        ],
        order: [['id', 'DESC']],
        limit: tamano,
        offset: (pagina - 1) * tamano
      })

      res.json({ bolsa, total: count, pagina, tamano, registros: rows })
    } catch (error) {
      responderError(res, error)
    }
  }

  // GET /bolsas/:id/clientes?busqueda=&filtro=faltante|porPagar|sobrante|inactivos&orden=faltante|saldo|reciente|nombre&pagina=&tamano=
  // Arqueo de una bolsa de anticipos: totales y conteos de todos los clientes (la suma de sus
  // saldos debe dar el saldo de la bolsa) y la página de clientes filtrada y ordenada
  static clientes = async (req: Request, res: Response) => {
    try {
      const bolsa = await bolsaDeAnticipos(Number(req.params.id))
      res.json({
        bolsa,
        ...await arqueoDeBolsa(bolsa.id, bolsa.saldoActual, {
          busqueda: (req.query.busqueda as string) || null,
          filtro: (req.query.filtro as FiltroArqueo) || null,
          orden: (req.query.orden as OrdenArqueo) || null,
          pagina: Number(req.query.pagina) || 1,
          tamano: Number(req.query.tamano) || 25
        })
      })
    } catch (error) {
      responderError(res, error)
    }
  }

  // GET /bolsas/:id/clientes/exportar?busqueda=&filtro=&orden= → Excel del arqueo (todos los que cumplan el filtro)
  static exportarArqueo = async (req: Request, res: Response) => {
    try {
      const bolsa = await bolsaDeAnticipos(Number(req.params.id))
      const arqueo = await arqueoDeBolsa(bolsa.id, bolsa.saldoActual, {
        busqueda: (req.query.busqueda as string) || null,
        filtro: (req.query.filtro as FiltroArqueo) || null,
        orden: (req.query.orden as OrdenArqueo) || null
      })
      enviarExcel(res, generarExcelArqueo(bolsa, arqueo), `arqueo-${nombreArchivo(bolsa.nombre)}-${hoy()}.xlsx`)
    } catch (error) {
      responderError(res, error)
    }
  }

  // GET /bolsas/:id/clientes/:clienteId?desde=&hasta= → estado de cuenta del cliente:
  // movimientos con saldo corrido (del período), gastos por pagar y sus anticipos
  static estadoDeCuenta = async (req: Request, res: Response) => {
    try {
      const bolsa = await bolsaDeAnticipos(Number(req.params.id))
      res.json({ bolsa: { id: bolsa.id, nombre: bolsa.nombre }, ...await estadoDeCuentaCliente(bolsa.id, Number(req.params.clienteId), periodo(req)) })
    } catch (error) {
      responderError(res, error)
    }
  }

  // GET /bolsas/:id/clientes/:clienteId/exportar?desde=&hasta= → Excel del estado de cuenta
  static exportarEstadoCuenta = async (req: Request, res: Response) => {
    try {
      const bolsa = await bolsaDeAnticipos(Number(req.params.id))
      const estado = await estadoDeCuentaCliente(bolsa.id, Number(req.params.clienteId), periodo(req))
      enviarExcel(res, generarExcelEstadoCuenta(bolsa, estado), `estado-cuenta-${nombreArchivo(estado.cliente.identificacion)}-${hoy()}.xlsx`)
    } catch (error) {
      responderError(res, error)
    }
  }

  static update = async (req: Request, res: Response) => {
    try {
      const bolsa = await Bolsas.findByPk(Number(req.params.id))
      if (!bolsa) throw new ErrorGastos('La bolsa no existe', 404)

      const { nombre, lineaNegocio, activo } = req.body

      await bolsa.update({
        ...(nombre !== undefined && { nombre }),
        ...(lineaNegocio !== undefined && { lineaNegocio: lineaNegocio || null }),
        ...(activo !== undefined && { activo })
      })

      res.json('Bolsa actualizada')
    } catch (error) {
      responderError(res, error)
    }
  }
}
