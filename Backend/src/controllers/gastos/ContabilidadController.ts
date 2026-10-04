import type { Request, Response } from 'express'
import { contabilizarCuentas, contabilizarGastos, registrarEgreso } from '../../services/gastos/contabilidad'
import { responderError } from './utilidades'

export class ContabilidadController {

  // PUT /lotes/:id/egreso  { numeroEgreso }
  static registrarEgreso = async (req: Request, res: Response) => {
    try {
      const { gastos } = await registrarEgreso(Number(req.params.id), req.body.numeroEgreso, req.usuario.id)
      res.json(`Número de egreso registrado en el lote y en ${gastos} gasto(s)`)
    } catch (error) {
      responderError(res, error)
    }
  }

  // POST /contabilidad/contabilizar-gastos  { gastos: [{ id, documentoContable }], fechaContabilizacion? }
  static contabilizarGastos = async (req: Request, res: Response) => {
    try {
      await contabilizarGastos(req.body.gastos, req.body.fechaContabilizacion ?? null, req.usuario.id)
      res.json(`${req.body.gastos.length} gasto(s) contabilizado(s)`)
    } catch (error) {
      responderError(res, error)
    }
  }

  // POST /contabilidad/contabilizar  { cuentas: [{ id, documentoContable }], fechaContabilizacion? }
  static contabilizar = async (req: Request, res: Response) => {
    try {
      await contabilizarCuentas(req.body.cuentas, req.body.fechaContabilizacion ?? null, req.usuario.id)
      res.json(`${req.body.cuentas.length} cuenta(s) de cobro contabilizada(s)`)
    } catch (error) {
      responderError(res, error)
    }
  }
}
