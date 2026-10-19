import type { Request, Response } from 'express'
import TiposGasto from '../../models/gastos/tiposGasto'
import FormasPago from '../../models/gastos/formasPago'
import EstadosGasto from '../../models/gastos/estadosGasto'
import EstadosCuentaCobro from '../../models/gastos/estadosCuentaCobro'
import EstadosReintegro from '../../models/gastos/estadosReintegro'
import TiposDocumentoGasto from '../../models/gastos/tiposDocumentoGasto'
import { actualizarEnCatalogo, crearEnCatalogo, eliminarDeCatalogo, listarCatalogo } from '../../services/gastos/catalogosGastos'
import { responderError } from './utilidades'

const ATRIBUTOS = ['id', 'codigo', 'nombre', 'activo']

export class CatalogosGastosController {

  // Todos los catálogos en una sola respuesta, para llenar los selects del frontend
  static getAll = async (req: Request, res: Response) => {
    try {
      const soloActivos = { where: { activo: true } }

      const [
        tiposGasto,
        formasPago,
        estadosGasto,
        estadosCuentaCobro,
        estadosReintegro,
        tiposDocumento
      ] = await Promise.all([
        TiposGasto.findAll({ ...soloActivos, attributes: ATRIBUTOS, order: [['id', 'ASC']] }),
        FormasPago.findAll({ ...soloActivos, attributes: ATRIBUTOS, order: [['nombre', 'ASC']] }),
        EstadosGasto.findAll({ ...soloActivos, attributes: [...ATRIBUTOS, 'orden'], order: [['orden', 'ASC']] }),
        EstadosCuentaCobro.findAll({ ...soloActivos, attributes: [...ATRIBUTOS, 'orden'], order: [['orden', 'ASC']] }),
        EstadosReintegro.findAll({ ...soloActivos, attributes: ATRIBUTOS, order: [['id', 'ASC']] }),
        // Con sus usos: el formulario del gasto ofrece solo los de pago
        TiposDocumentoGasto.findAll({ ...soloActivos, attributes: [...ATRIBUTOS, 'paraPago', 'paraLegalizacion', 'paraReintegro'], order: [['nombre', 'ASC']] })
      ])

      res.json({
        tiposGasto,
        formasPago,
        estadosGasto,
        estadosCuentaCobro,
        estadosReintegro,
        tiposDocumento
      })
    } catch (error) {
      console.log(error)
      res.status(500).json({ error: 'Hubo un error' })
    }
  }

  // GET /admin/catalogos/:catalogo → todos los registros (con inactivos) y cuánto se usa cada uno
  static getCatalogo = async (req: Request, res: Response) => {
    try {
      res.json(await listarCatalogo(req.params.catalogo))
    } catch (error) {
      responderError(res, error)
    }
  }

  // POST /admin/catalogos/:catalogo  { nombre } (el código sale del nombre)
  static create = async (req: Request, res: Response) => {
    try {
      const id = await crearEnCatalogo(req.params.catalogo, req.body)
      res.status(201).json({ id })
    } catch (error) {
      responderError(res, error)
    }
  }

  // PUT /admin/catalogos/:catalogo/:id  { nombre?, activo? } (el código no cambia)
  static update = async (req: Request, res: Response) => {
    try {
      await actualizarEnCatalogo(req.params.catalogo, Number(req.params.id), req.body)
      res.json('Registro actualizado')
    } catch (error) {
      responderError(res, error)
    }
  }

  // DELETE /admin/catalogos/:catalogo/:id  (solo si no se usa)
  static remove = async (req: Request, res: Response) => {
    try {
      await eliminarDeCatalogo(req.params.catalogo, Number(req.params.id))
      res.json('Registro eliminado')
    } catch (error) {
      responderError(res, error)
    }
  }
}
