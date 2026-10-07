import type { Request, Response } from 'express'
import {
  beneficiariosPorIdentificacion, buscarClientes, catalogosCargue, crearCargue, leerExcel, plantillaExcel, validarCargue
} from '../services/cargueMasivoTramites'
import { notificarGastosCreados } from '../services/gastos/notificacionesGastos'
import { responderError } from './gastos/utilidades'

// Cargue masivo de trámites en pantalla (/api/solicitudTramites/cargue). Lo usan quienes
// crean trámites (Gestión de activos y Torre de control)
export class CargueMasivoTramitesController {

  // GET /cargue/catalogos → listas para los selectores y para resolver lo pegado por nombre
  static catalogos = async (_req: Request, res: Response) => {
    try {
      res.json(await catalogosCargue(true))
    } catch (error) {
      responderError(res, error)
    }
  }

  // GET /cargue/clientes?busqueda= → clientes por nombre o identificación
  static clientes = async (req: Request, res: Response) => {
    try {
      res.json(await buscarClientes(String(req.query.busqueda ?? '')))
    } catch (error) {
      responderError(res, error)
    }
  }

  // POST /cargue/beneficiarios { identificaciones } → beneficiarios de gastos ya registrados
  static beneficiarios = async (req: Request, res: Response) => {
    try {
      const identificaciones = ((req.body.identificaciones ?? []) as unknown[]).map(String).filter(Boolean).slice(0, 500)
      res.json(await beneficiariosPorIdentificacion(identificaciones))
    } catch (error) {
      responderError(res, error)
    }
  }

  // POST /cargue/validar { filas } → errores y avisos de cada fila (no guarda)
  static validar = async (req: Request, res: Response) => {
    try {
      res.json(await validarCargue(req.body.filas ?? []))
    } catch (error) {
      responderError(res, error)
    }
  }

  // POST /cargue/crear { filas } → crea todos los trámites (y gastos) o ninguno
  static crear = async (req: Request, res: Response) => {
    try {
      const resultado = await crearCargue(req.body.filas ?? [], req.usuario.id)
      if (!resultado.ok) return res.status(400).json({ error: 'Hay filas con errores: corríjalas antes de guardar', validacion: resultado.validacion })

      // Fuera de la transacción: un fallo en el correo no revierte el cargue
      const gastoIds = resultado.creados.map(c => c.gastoId).filter(Boolean) as number[]
      if (gastoIds.length) void notificarGastosCreados(gastoIds)

      res.status(201).json({ creados: resultado.creados })
    } catch (error) {
      responderError(res, error)
    }
  }

  // GET /cargue/plantilla → Excel con listas desplegables (por nombre)
  static plantilla = async (_req: Request, res: Response) => {
    try {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', 'attachment; filename="plantilla-tramites.xlsx"')
      res.send(await plantillaExcel())
    } catch (error) {
      responderError(res, error)
    }
  }

  // POST /cargue/leer-excel (multipart: file) → filas del Excel para llenar la pantalla
  static leerExcel = async (req: Request, res: Response) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Seleccione el archivo Excel' })
      res.json({ filas: leerExcel(req.file.buffer) })
    } catch (error) {
      responderError(res, error)
    }
  }
}
