import type { Request, Response } from "express";
import Programacion from "../models/programacion";
import { crearNotificacion } from "../services/notificacionesServices";
import SolicitudTramites from "../models/solicitudTramites";
import Usuarios from "../models/usuarios";
import Municipios from "../models/municipios";
import Tramite from "../models/tramite";
import Operaciones from "../models/operaciones";
import Tramitador from "../models/tramitador";
import { formatearFecha } from "../utils/fechaColombia";
import Clientes from "../models/clientes";


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

    let programacion = await Programacion.findOne({
      where: { solicitudTramiteId: solicitudId }
    })

    // ==========================================
    // FECHAS ANTES DE MODIFICAR LA PROGRAMACIÓN
    // ==========================================

    const fechaAnterior = programacion?.fechaProbableEntrega || null
    const nuevaFecha = req.body.fechaProbableEntrega || null

    let enviarNotificacionAsignado = false


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
        horaCita: req.body.horaCita || null
      })

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

      await programacion.save()
    }


    console.log('Fecha anterior:', fechaAnterior)
    console.log('Nueva fecha:', nuevaFecha)
    console.log(
      'Enviar ASIGNADO:',
      enviarNotificacionAsignado
    )


    // ==========================================
    // CARGAR SOLICITUD ACTUALIZADA
    // ==========================================

    const solicitud = await SolicitudTramites.findByPk(
      solicitudId,
      {
        include: [
          Usuarios,
          Municipios,
          Tramite,
          Operaciones,
          Tramitador,
          Programacion,
          Clientes
        ]
      }
    )


    // ==========================================
    // NOTIFICACIÓN PROGRAMACIÓN
    // ==========================================

    if (solicitud?.usuario?.correoUsuario) {

      await crearNotificacion({
        solicitud,
        tipo: 'PROGRAMACION',
        destinatario: solicitud.usuario,

        data: {
          nombre: solicitud.usuario.nombreUsuario||
            'N/A',

          // La plantilla del correo lee `tipo` (igual que la programación masiva)
          tipo: solicitud.tramite?.nombreTramite ||
            'N/A',

          fecha: programacion.fechaProbableEntrega
            ? formatearFecha(programacion.fechaProbableEntrega)
            : 'Sin fecha',

          detalle: solicitud.detalleSolicitud||
            'N/A',

          tramitador:
            solicitud.tramitador?.nombreTramitador || 'N/A',

          municipio:
            solicitud.municipios?.nombreMunicipio || 'N/A',

          operacion:
            solicitud.operaciones?.nombreOperacion || 'N/A',

          programador:
            solicitud.municipios?.responsable || 'N/A'
        }
      })
    }


    // ==========================================
    // NOTIFICACIÓN ASIGNADO
    // SOLO SI CAMBIÓ LA FECHA
    // ==========================================

    const usuario = solicitud?.usuario
    const municipio = solicitud?.municipios
    const tramitador = solicitud?.tramitador

    if (
      tramitador &&
      enviarNotificacionAsignado
    ) {

      await crearNotificacion({
        solicitud,
        tipo: 'ASIGNADO',
        destinatario: tramitador,

        data: {
          nombre: tramitador.nombreTramitador||
            'N/A',

          numeroTramite: solicitud.id ||
            'N/A',

          tipoTramite:
            solicitud.tramite.nombreTramite||
            'N/A',

          detalle:
            solicitud.detalleSolicitud||
            'N/A',

          ubicacion:
            solicitud.direccionTramite||
            'N/A',

          mueble:
            solicitud.placa ||
            solicitud.matriculaInmobiliaria ||
            'N/A',

          cliente:
            solicitud.clientes.nombreCliente ||
            'N/A',

          tarifa:
            programacion?.valorTramite || 0,

          fecha: programacion.fechaProbableEntrega
            ? formatearFecha(programacion.fechaProbableEntrega)
            : 'Sin fecha',

          solicitante:
            usuario?.nombreUsuario || 'N/A',

          programador:
            municipio?.responsable || 'N/A',

          municipio:
            municipio?.nombreMunicipio || 'N/A'
        }
      })
    }


    return res
      .status(201)
      .json("Programación guardada correctamente")

  } catch (error) {

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