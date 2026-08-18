import type { Request, Response } from "express";
import path from "path";

import DocumentoSolicitud from "../models/documentosSolicitud";
import SolicitudTramites from "../models/solicitudTramites";

import {
  subirArchivo,
  eliminarArchivo,
  archivoExiste,
  obtenerArchivo,
} from "../services/azureFileStorage";

import { db } from "../config/db";


export class DocumentoSolicitudController {
  static verDocumento = async (
  req: Request,
  res: Response
) => {

  try {

    // ==========================================
    // 1. AUTENTICACIÓN
    // ==========================================

    if (!req.usuario) {
      return res.status(401).json({
        error: "Usuario no autenticado"
      });
    }


    // ==========================================
    // 2. OBTENER ID
    // ==========================================

    const { id } = req.params;


    if (!id) {
      return res.status(400).json({
        error: "Debe indicar el documento"
      });
    }


    // ==========================================
    // 3. BUSCAR DOCUMENTO
    // ==========================================

    const documento =
      await DocumentoSolicitud.findByPk(id);


    if (!documento) {
      return res.status(404).json({
        error: "El documento no existe"
      });
    }


    // ==========================================
    // 4. OBTENER PDF DE AZURE
    // ==========================================

    const archivo =
      await obtenerArchivo(
        documento.rutaArchivo.substring(
          0,
          documento.rutaArchivo.lastIndexOf("/")
        ),
        documento.nombreArchivo
      );


    // ==========================================
    // 5. HEADERS
    // ==========================================

    res.setHeader(
      "Content-Type",
      documento.tipoArchivo
    );

    res.setHeader(
      "Content-Disposition",
      `inline; filename="${documento.nombreOriginal}"`
    );

    res.setHeader(
      "Content-Length",
      archivo.length
    );


    // ==========================================
    // 6. ENVIAR PDF
    // ==========================================

    return res.send(archivo);


  } catch (error) {

    console.error(
      "ERROR AL VISUALIZAR DOCUMENTO:",
      error
    );


    return res.status(500).json({
      error:
        "No se pudo visualizar el documento"
    });

  }

};

  static subirDocumentos = async (
    req: Request,
    res: Response
  ) => {

    const archivosSubidos: {
      rutaDirectorio: string;
      nombreArchivo: string;
    }[] = [];

    try {

      // ==========================================
      // 1. VALIDAR USUARIO
      // ==========================================

      if (!req.usuario) {

        return res.status(401).json({
          error: "Usuario no autenticado"
        });

      }

      const usuarioId = req.usuario.id;


      // ==========================================
      // 2. OBTENER SOLICITUD
      // ==========================================

      const {
        solicitudTramiteId
      } = req.body;


      if (!solicitudTramiteId) {

        return res.status(400).json({
          error: "Debe enviar solicitudTramiteId"
        });

      }


      // ==========================================
      // 3. VALIDAR ARCHIVOS
      // ==========================================

      const archivos =
        req.files as Express.Multer.File[];


      if (
        !archivos ||
        archivos.length === 0
      ) {

        return res.status(400).json({
          error: "Debe seleccionar al menos un documento PDF"
        });

      }


      // ==========================================
      // 4. VALIDAR MÁXIMO DE ARCHIVOS
      // ==========================================

      if (archivos.length > 10) {

        return res.status(400).json({
          error: "Puede cargar máximo 10 documentos por solicitud"
        });

      }


      // ==========================================
      // 5. VALIDAR TAMAÑO TOTAL
      // ==========================================

      const MAX_TOTAL_SIZE =
        50 * 1024 * 1024; // 50 MB


      const tamañoTotal =
        archivos.reduce(
          (total, archivo) =>
            total + archivo.size,
          0
        );


      if (tamañoTotal > MAX_TOTAL_SIZE) {

        return res.status(400).json({
          error:
            "El tamaño total de los documentos no puede superar los 50 MB"
        });

      }


      // ==========================================
      // 6. VALIDAR SOLICITUD
      // ==========================================

      const solicitud =
        await SolicitudTramites.findByPk(
          solicitudTramiteId
        );


      if (!solicitud) {

        return res.status(404).json({
          error:
            "La solicitud de trámite no existe"
        });

      }


      // ==========================================
      // 7. DIRECTORIO DE LA SOLICITUD
      // ==========================================

      const rutaDirectorio =
        `solicitudes/${solicitudTramiteId}`;


      // ==========================================
      // 8. PREPARAR NOMBRES
      // ==========================================

      const documentosPreparados: {
        archivo: Express.Multer.File;
        nombreArchivo: string;
        rutaArchivo: string;
      }[] = [];


      // Nombres que ya hemos reservado
      // dentro de esta misma petición
      const nombresReservados =
        new Set<string>();


      for (const archivo of archivos) {

        const extension =
          path.extname(
            archivo.originalname
          );


        const nombreBase =
          path.basename(
            archivo.originalname,
            extension
          );


        let nombreArchivo =
          `${nombreBase}${extension}`;


        let contador = 1;


        // ==========================================
        // BUSCAR NOMBRE DISPONIBLE
        // ==========================================

        while (
          nombresReservados.has(nombreArchivo) ||
          await archivoExiste(
            rutaDirectorio,
            nombreArchivo
          )
        ) {

          nombreArchivo =
            `${nombreBase}_${contador}${extension}`;

          contador++;

        }


        nombresReservados.add(
          nombreArchivo
        );


        documentosPreparados.push({

          archivo,

          nombreArchivo,

          rutaArchivo:
            `${rutaDirectorio}/${nombreArchivo}`

        });

      }


      // ==========================================
      // 9. TRANSACCIÓN POSTGRESQL
      // ==========================================

      const transaction =
        await db.transaction();


      try {

        // ==========================================
        // 10. SUBIR TODOS LOS ARCHIVOS A AZURE
        // ==========================================

        for (
          const documento
          of documentosPreparados
        ) {

          await subirArchivo(

            rutaDirectorio,

            documento.nombreArchivo,

            documento.archivo.buffer

          );


          // Guardamos para rollback
          archivosSubidos.push({

            rutaDirectorio,

            nombreArchivo:
              documento.nombreArchivo

          });

        }


        // ==========================================
        // 11. CREAR REGISTROS EN POSTGRESQL
        // ==========================================

        const documentos =
          await DocumentoSolicitud.bulkCreate(

            documentosPreparados.map(
              documento => ({

                solicitudTramiteId:
                  Number(solicitudTramiteId),

                usuarioId,

                nombreOriginal:
                  documento.archivo.originalname,

                nombreArchivo:
                  documento.nombreArchivo,

                rutaArchivo:
                  documento.rutaArchivo,

                tipoArchivo:
                  documento.archivo.mimetype,

                tamano:
                  documento.archivo.size,

              })
            ),

            {
              transaction
            }

          );


        // ==========================================
        // 12. CONFIRMAR TRANSACCIÓN
        // ==========================================

        await transaction.commit();


        // ==========================================
        // 13. RESPUESTA
        // ==========================================

        return res.status(201).json({

          mensaje:
            "Documentos cargados correctamente",

          totalDocumentos:
            documentos.length,

          documentos:
            documentos.map(
              documento => ({

                id:
                  documento.id,

                solicitudTramiteId:
                  documento.solicitudTramiteId,

                nombreOriginal:
                  documento.nombreOriginal,

                nombreArchivo:
                  documento.nombreArchivo,

                rutaArchivo:
                  documento.rutaArchivo,

                tipoArchivo:
                  documento.tipoArchivo,

                tamano:
                  documento.tamano,

                usuarioId:
                  documento.usuarioId,

              })
            )

        });


      } catch (error) {

        // ==========================================
        // ROLLBACK POSTGRESQL
        // ==========================================

        await transaction.rollback();

        throw error;

      }


    } catch (error) {

      console.error(
        "ERROR AL SUBIR DOCUMENTOS:",
        error
      );


      // ==========================================
      // ROLLBACK AZURE
      // ==========================================

      for (
        const archivo
        of archivosSubidos
      ) {

        try {

          await eliminarArchivo(

            archivo.rutaDirectorio,

            archivo.nombreArchivo

          );

          console.log(
            `Archivo eliminado por rollback: ${archivo.nombreArchivo}`
          );

        } catch (errorAzure) {

          console.error(
            `ERROR ELIMINANDO ${archivo.nombreArchivo} DE AZURE:`,
            errorAzure
          );

        }

      }


      // ==========================================
      // RESPUESTA ERROR
      // ==========================================

      return res.status(500).json({

        error:
          "No se pudieron cargar los documentos",

        detalle:
          error instanceof Error
            ? error.message
            : String(error)

      });

    }

  };

  static listarDocumentos = async (
  req: Request,
  res: Response
) => {

  try {

    // ==========================================
    // 1. VALIDAR USUARIO AUTENTICADO
    // ==========================================

    if (!req.usuario) {
      return res.status(401).json({
        error: "Usuario no autenticado"
      });
    }


    // ==========================================
    // 2. OBTENER ID DE LA SOLICITUD
    // ==========================================

    const { solicitudTramiteId } = req.params;


    if (!solicitudTramiteId) {
      return res.status(400).json({
        error: "Debe indicar el ID de la solicitud"
      });
    }


    // ==========================================
    // 3. VALIDAR QUE LA SOLICITUD EXISTA
    // ==========================================

    const solicitud =
      await SolicitudTramites.findByPk(
        solicitudTramiteId
      );


    if (!solicitud) {
      return res.status(404).json({
        error: "La solicitud de trámite no existe"
      });
    }


    // ==========================================
    // 4. BUSCAR DOCUMENTOS
    // ==========================================

    const documentos =
      await DocumentoSolicitud.findAll({

        where: {
          solicitudTramiteId:
            Number(solicitudTramiteId)
        },

        order: [
          ["createdAt", "DESC"]
        ],

        attributes: [
          "id",
          "solicitudTramiteId",
          "nombreOriginal",
          "nombreArchivo",
          "rutaArchivo",
          "tipoArchivo",
          "tamano",
          "usuarioId",
          "createdAt"
        ]

      });


    // ==========================================
    // 5. RESPUESTA
    // ==========================================

    return res.status(200).json({

      solicitudTramiteId:
        Number(solicitudTramiteId),

      totalDocumentos:
        documentos.length,

      documentos

    });


  } catch (error) {

    console.error(
      "ERROR AL LISTAR DOCUMENTOS:",
      error
    );


    return res.status(500).json({
      error:
        "No se pudieron obtener los documentos"
    });

  }

};

static descargarDocumento = async (
  req: Request,
  res: Response
) => {

  try {

    // ==========================================
    // 1. AUTENTICACIÓN
    // ==========================================

    if (!req.usuario) {
      return res.status(401).json({
        error: "Usuario no autenticado"
      });
    }


    // ==========================================
    // 2. ID
    // ==========================================

    const { id } = req.params;


    if (!id) {
      return res.status(400).json({
        error: "Debe indicar el documento"
      });
    }


    // ==========================================
    // 3. BUSCAR DOCUMENTO
    // ==========================================

    const documento =
      await DocumentoSolicitud.findByPk(id);


    if (!documento) {
      return res.status(404).json({
        error: "El documento no existe"
      });
    }


    // ==========================================
    // 4. OBTENER ARCHIVO
    // ==========================================

    const ultimoSlash =
      documento.rutaArchivo.lastIndexOf("/");


    const rutaDirectorio =
      documento.rutaArchivo.substring(
        0,
        ultimoSlash
      );


    const archivo =
      await obtenerArchivo(
        rutaDirectorio,
        documento.nombreArchivo
      );


    // ==========================================
    // 5. HEADERS DE DESCARGA
    // ==========================================

    res.setHeader(
      "Content-Type",
      documento.tipoArchivo
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${documento.nombreOriginal}"`
    );

    res.setHeader(
      "Content-Length",
      archivo.length
    );


    // ==========================================
    // 6. ENVIAR
    // ==========================================

    return res.send(archivo);


  } catch (error) {

    console.error(
      "ERROR AL DESCARGAR DOCUMENTO:",
      error
    );


    return res.status(500).json({
      error:
        "No se pudo descargar el documento"
    });

  }

};
static eliminarDocumento = async (
  req: Request,
  res: Response
) => {

  try {

    // ==========================================
    // 1. AUTENTICACIÓN
    // ==========================================

    if (!req.usuario) {
      return res.status(401).json({
        error: "Usuario no autenticado"
      });
    }


    // ==========================================
    // 2. ID
    // ==========================================

    const { id } = req.params;


    if (!id) {
      return res.status(400).json({
        error: "Debe indicar el documento"
      });
    }


    // ==========================================
    // 3. BUSCAR DOCUMENTO
    // ==========================================

    const documento =
      await DocumentoSolicitud.findByPk(id);


    if (!documento) {
      return res.status(404).json({
        error: "El documento no existe"
      });
    }


    // ==========================================
    // 4. OBTENER RUTA
    // ==========================================

    const ultimoSlash =
      documento.rutaArchivo.lastIndexOf("/");


    const rutaDirectorio =
      documento.rutaArchivo.substring(
        0,
        ultimoSlash
      );


    // ==========================================
    // 5. ELIMINAR DE AZURE
    // ==========================================

    await eliminarArchivo(
      rutaDirectorio,
      documento.nombreArchivo
    );


    // ==========================================
    // 6. ELIMINAR DE POSTGRESQL
    // ==========================================

    await documento.destroy();


    // ==========================================
    // 7. RESPUESTA
    // ==========================================

    return res.status(200).json({

      mensaje:
        "Documento eliminado correctamente",

      id:
        documento.id,

      nombreOriginal:
        documento.nombreOriginal

    });


  } catch (error) {

    console.error(
      "ERROR AL ELIMINAR DOCUMENTO:",
      error
    );


    return res.status(500).json({
      error:
        "No se pudo eliminar el documento"
    });

  }

};




}