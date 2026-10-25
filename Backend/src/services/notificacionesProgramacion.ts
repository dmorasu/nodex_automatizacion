import SolicitudTramites from "../models/solicitudTramites";
import Usuarios from "../models/usuarios";
import Municipios from "../models/municipios";
import Tramite from "../models/tramite";
import Operaciones from "../models/operaciones";
import Tramitador from "../models/tramitador";
import Programacion from "../models/programacion";
import Clientes from "../models/clientes";
import { crearNotificacion } from "./notificacionesServices";
import { formatearFecha } from "../utils/fechaColombia";

// Avisos al guardar la programación de un trámite (antes vivían en ProgramacionController.create;
// también los usa "Agregar a la ruta" de los mensajeros):
// - PROGRAMACION: correo a quien creó el trámite, siempre.
// - ASIGNADO: al tramitador, solo si `avisarAsignado` (fecha nueva o posterior, o tramitador nuevo).
export const notificarProgramacion = async (solicitudId: number, { avisarAsignado }: { avisarAsignado: boolean }) => {
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

  // La programación recién guardada (viene con la solicitud)
  const programacion = solicitud?.programacion
  if (!solicitud || !programacion) return


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
    avisarAsignado
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


}
