import type { Request, Response } from 'express'
import Parametros from '../../models/gastos/parametros'

export class ParametrosGastosController {

  static getAll = async (req: Request, res: Response) => {
    try {
      const parametros = await Parametros.findAll({
        attributes: ['clave', 'valor', 'descripcion'],
        order: [['clave', 'ASC']]
      })

      res.json(parametros)
    } catch (error) {
      console.log(error)
      res.status(500).json({ error: 'Hubo un error' })
    }
  }

  // El cambio solo afecta los cálculos nuevos: cada gasto guarda el porcentaje con el que se calculó
  static update = async (req: Request, res: Response) => {
    try {
      const parametro = await Parametros.findOne({
        where: { clave: req.params.clave }
      })

      if (!parametro) {
        return res.status(404).json({ error: 'Parámetro no encontrado' })
      }

      await parametro.update({ valor: req.body.valor })

      res.json('Parámetro actualizado correctamente')
    } catch (error) {
      console.log(error)
      res.status(500).json({ error: 'Hubo un error' })
    }
  }
}
