import DocumentoSolicitud from '../../models/documentosSolicitud'
import { subirArchivo, eliminarArchivo } from '../azureFileStorage'
import { nombreSeguro } from '../../controllers/gastos/DocumentosGastoController'
import { conPrefijo, TIPOS_DOCUMENTO_TRAMITE, type TipoDocumentoTramite } from './nombresDocumento'

// Guarda documentos subidos por el tramitador en el trámite: van a la misma tabla de
// Nodex Trámites (se ven de inmediato en su pestaña Documentos), con el tipo elegido
// y el prefijo en el nombre (ej: "Factura - IMG_2031.jpg").
// Se usa al subir desde el trámite y también al subir un soporte desde un gasto del trámite.
export const registrarDocumentosTramite = async (
  solicitudTramiteId: number,
  tramitadorId: number,
  tipoDocumento: TipoDocumentoTramite,
  archivos: Express.Multer.File[]
) => {
  const rutaDirectorio = `solicitudes/${solicitudTramiteId}`
  const subidos: string[] = []

  try {
    for (const archivo of archivos) {
      const nombreArchivo = nombreSeguro(archivo.originalname)
      await subirArchivo(rutaDirectorio, nombreArchivo, archivo.buffer)
      subidos.push(nombreArchivo)
    }

    return await DocumentoSolicitud.bulkCreate(archivos.map((archivo, i) => ({
      solicitudTramiteId,
      usuarioId: null,
      tramitadorId,
      tipoDocumento,
      nombreOriginal: conPrefijo(TIPOS_DOCUMENTO_TRAMITE[tipoDocumento], archivo.originalname),
      nombreArchivo: subidos[i],
      rutaArchivo: `${rutaDirectorio}/${subidos[i]}`,
      tipoArchivo: archivo.mimetype,
      tamano: archivo.size
    })))
  } catch (error) {
    // No dejar archivos sueltos en Azure si algo falló
    await Promise.allSettled(subidos.map(nombre => eliminarArchivo(rutaDirectorio, nombre)))
    throw error
  }
}
