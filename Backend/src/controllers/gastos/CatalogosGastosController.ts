import type { Request, Response } from 'express'
import TiposGasto from '../../models/gastos/tiposGasto'
import FormasPago from '../../models/gastos/formasPago'
import EstadosGasto from '../../models/gastos/estadosGasto'
import EstadosCuentaCobro from '../../models/gastos/estadosCuentaCobro'
import EstadosReintegro from '../../models/gastos/estadosReintegro'
import TiposDocumentoGasto from '../../models/gastos/tiposDocumentoGasto'

// Catálogos que el administrador puede crear o editar desde el frontend.
// Los tipos de gasto y los estados NO están aquí: la lógica depende de sus códigos.
export const CATALOGOS_EDITABLES = {
  formasPago: FormasPago,
  tiposDocumento: TiposDocumentoGasto
}

type CatalogoEditable = keyof typeof CATALOGOS_EDITABLES

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
        TiposDocumentoGasto.findAll({ ...soloActivos, attributes: ATRIBUTOS, order: [['nombre', 'ASC']] })
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

  // Lista completa de un catálogo editable, incluidos los inactivos (pantalla de administración)
  static getCatalogo = async (req: Request, res: Response) => {
    try {
      const modelo = CATALOGOS_EDITABLES[req.params.catalogo as CatalogoEditable]

      const registros = await modelo.findAll({
        attributes: ATRIBUTOS,
        order: [['nombre', 'ASC']]
      })

      res.json(registros)
    } catch (error) {
      console.log(error)
      res.status(500).json({ error: 'Hubo un error' })
    }
  }

  static create = async (req: Request, res: Response) => {
    try {
      const modelo = CATALOGOS_EDITABLES[req.params.catalogo as CatalogoEditable]
      const { codigo, nombre } = req.body

      const existente = await modelo.findOne({ where: { codigo } })

      if (existente) {
        return res.status(409).json({ error: `Ya existe un registro con el código ${codigo}` })
      }

      await modelo.create({ codigo, nombre, activo: true })

      res.status(201).json('Registro creado correctamente')
    } catch (error) {
      console.log(error)
      res.status(500).json({ error: 'Hubo un error' })
    }
  }

  // Solo se puede cambiar el nombre y activar/desactivar; el código es fijo
  static update = async (req: Request, res: Response) => {
    try {
      const modelo = CATALOGOS_EDITABLES[req.params.catalogo as CatalogoEditable]
      const registro = await modelo.findByPk(req.params.id as string)

      if (!registro) {
        return res.status(404).json({ error: 'Registro no encontrado' })
      }

      const { nombre, activo } = req.body

      await registro.update({
        ...(nombre !== undefined && { nombre }),
        ...(activo !== undefined && { activo })
      })

      res.json('Registro actualizado correctamente')
    } catch (error) {
      console.log(error)
      res.status(500).json({ error: 'Hubo un error' })
    }
  }
}
