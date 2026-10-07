import { QueryTypes } from 'sequelize'
import { db } from '../config/db'
import DocumentoSolicitud from '../models/documentosSolicitud'
import { subirArchivo, eliminarArchivo } from './azureFileStorage'
import { nombreSeguro } from '../controllers/gastos/DocumentosGastoController'
import { conPrefijo, TIPOS_DOCUMENTO_TRAMITE, type TipoDocumentoTramite } from './tramitadores/nombresDocumento'
import { ErrorGastos } from './gastos/errores'

// =====================================
// CARGUE MASIVO DE DOCUMENTOS DE TRÁMITES
// La pantalla toma el número del trámite del nombre de cada archivo, lo valida aquí y sube los
// archivos uno por uno (así cada uno muestra su estado y un error no detiene los demás).
// =====================================

export const MAXIMO_TRAMITES = 500

// Datos para mostrar a qué trámite va cada archivo. `soloDe` = usuario (Gestión de activos solo
// sube a sus propios trámites): los demás aparecen como no encontrados
export const tramitesParaDocumentos = async (ids: number[], soloDe: number | null) => {
  const unicos = [...new Set(ids.filter(id => Number.isInteger(id) && id > 0))].slice(0, MAXIMO_TRAMITES)
  if (!unicos.length) return []

  return db.query<Record<string, unknown>>(`
    SELECT t.id, tr."nombreTramite" AS tramite, c."nombreCliente" AS cliente, t.placa, t."matriculaInmobiliaria" AS matricula,
      COALESCE(e."nombreEstado", 'Sin iniciar') AS estado,
      (SELECT COUNT(*) FROM "DocumentosSolicitud" d WHERE d."solicitudTramiteId" = t.id)::int AS documentos
    FROM "SolicitudTramites" t
    LEFT JOIN "Tramites" tr ON tr.id = t."tramiteId"
    LEFT JOIN "Clientes" c ON c.id = t."clienteId"
    LEFT JOIN "Estados" e ON e.id = t."estadoActualTramite"
    WHERE t.id IN (:ids) ${soloDe ? 'AND t."usuarioId" = :soloDe' : ''}
  `, { replacements: { ids: unicos, soloDe }, type: QueryTypes.SELECT })
}

const TIPOS_PERMITIDOS = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']

// Guarda un documento en el trámite (misma tabla y carpeta que los demás documentos del trámite)
export const subirDocumentoATramite = async (
  solicitudTramiteId: number,
  usuarioId: number,
  tipoDocumento: TipoDocumentoTramite | null,
  archivo: Express.Multer.File
) => {
  if (!TIPOS_PERMITIDOS.includes(archivo.mimetype)) throw new ErrorGastos(`"${archivo.originalname}" no es válido: solo PDF, JPG o PNG`)

  const rutaDirectorio = `solicitudes/${solicitudTramiteId}`
  const nombreArchivo = nombreSeguro(archivo.originalname)
  await subirArchivo(rutaDirectorio, nombreArchivo, archivo.buffer)
  try {
    return await DocumentoSolicitud.create({
      solicitudTramiteId,
      usuarioId,
      tramitadorId: null,
      tipoDocumento,
      // Con tipo, el nombre lleva el prefijo (ej: "Factura - 1234.pdf"), como los del tramitador
      nombreOriginal: tipoDocumento ? conPrefijo(TIPOS_DOCUMENTO_TRAMITE[tipoDocumento], archivo.originalname) : archivo.originalname.slice(0, 255),
      nombreArchivo,
      rutaArchivo: `${rutaDirectorio}/${nombreArchivo}`,
      tipoArchivo: archivo.mimetype,
      tamano: archivo.size
    })
  } catch (error) {
    // No dejar el archivo suelto en Azure si no quedó registrado
    await eliminarArchivo(rutaDirectorio, nombreArchivo).catch(() => undefined)
    throw error
  }
}
