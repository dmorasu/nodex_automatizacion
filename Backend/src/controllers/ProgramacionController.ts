import type { Request, Response } from "express";
import Programacion from "../models/programacion";
import { notificarProgramacion } from "../services/notificacionesProgramacion";
import { db } from "../config/db";
import { cerrarReservasDelTramite, validarHorasCita, verificarCitaDelTramite } from "../services/mensajeria/agenda";
import { ErrorGastos } from "../services/gastos/errores";


declare global {
  namespace Express {
    interface Request {
      programacion?: Programacion
    }
  }
}

export class ProgramacionController {
  static getAll = async (req: Request, res: Response) => {

  }

  static create = async (req: Request, res: Response) => {
  try {

    const solicitudId = req.solicitudTramites.id

    // Sin cita no quedan horas guardadas; la hora final es opcional
    if (!req.body.requiereCita) {
      req.body.fechaCita = null
      req.body.horaCita = null
      req.body.horaFinCita = null
    }
    validarHorasCita(req.body)

    let fechaAnterior: Date | null = null
    const nuevaFecha = req.body.fechaProbableEntrega || null
    let enviarNotificacionAsignado = false

    // En una transacción: la agenda del mensajero queda bloqueada desde que se revisa el cruce
    // hasta que se guarda (dos citas guardadas a la vez no se cruzan)
    await db.transaction(async transaction => {

    let programacion = await Programacion.findOne({
      where: { solicitudTramiteId: solicitudId },
      transaction
    })

    // ==========================================
    // FECHAS ANTES DE MODIFICAR LA PROGRAMACIÓN
    // ==========================================

    fechaAnterior = programacion?.fechaProbableEntrega || null

    // Un horario ocupado del mensajero no se vuelve a ocupar (decisión del usuario)
    await verificarCitaDelTramite(solicitudId, {
      fecha: nuevaFecha,
      requiereCita: Boolean(req.body.requiereCita),
      horaCita: req.body.horaCita || null,
      horaFinCita: req.body.horaFinCita || null
    }, transaction)


    // ==========================================
    // CREAR / ACTUALIZAR PROGRAMACIÓN
    // ==========================================

    if (!programacion) {

      // Primera vez
      programacion = await Programacion.create({
        solicitudTramiteId: solicitudId,
        fechaProbableEntrega: nuevaFecha,
        valorTramite: req.body.valorTramite || null,
        valorViaticos: req.body.valorViaticos || null,
        conceptoHonorarios: req.body.conceptoHonorarios || null,
        conceptoViaticos: req.body.conceptoViaticos || null,

        requiereCita: req.body.requiereCita || false,
        fechaCita: req.body.fechaCita || null,
        horaCita: req.body.horaCita || null,
        horaFinCita: req.body.horaFinCita || null
      }, { transaction })

      // No existía fecha anteriormente
      // y ahora estamos guardando una
      if (!fechaAnterior && nuevaFecha) {
        enviarNotificacionAsignado = true
      }

    } else {

      // ==========================================
      // COMPARAR FECHA ANTERIOR VS NUEVA
      // ==========================================

      if (
        nuevaFecha &&
        (
          !fechaAnterior ||
          new Date(nuevaFecha).getTime() >
          new Date(fechaAnterior).getTime()
        )
      ) {
        enviarNotificacionAsignado = true
      }

      // Actualizar demás campos
      Object.assign(programacion, req.body)

      await programacion.save({ transaction })
    }

    // Con la cita programada, el espacio que se le había reservado ya cumplió
    if (req.body.requiereCita && req.body.horaCita) {
      await cerrarReservasDelTramite(solicitudId, transaction)
    }

    })


    console.log('Fecha anterior:', fechaAnterior)
    console.log('Nueva fecha:', nuevaFecha)
    console.log(
      'Enviar ASIGNADO:',
      enviarNotificacionAsignado
    )


    await notificarProgramacion(solicitudId, { avisarAsignado: enviarNotificacionAsignado })


    return res
      .status(201)
      .json("Programación guardada correctamente")

  } catch (error) {

    if (error instanceof ErrorGastos) {
      return res.status(error.status).json({ error: error.message })
    }

    console.error("ERROR PROGRAMACION:", error)

    return res
      .status(500)
      .json("Hubo un error")
  }
}

  static getById = async (req: Request, res: Response) => {
    res.json(req.programacion)

  }

  static updateById = async (req: Request, res: Response) => {
    req.programacion.update(req.body)
    res.json("Se actualizo el registro")

  }

  static deleteById = async (req: Request, res: Response) => {
    await req.programacion.destroy()
    res.json('Registro Eliminado')

  }



}