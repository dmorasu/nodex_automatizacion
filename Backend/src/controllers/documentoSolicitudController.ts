import type { Request, Response } from "express";
import path from "path";

import DocumentoSolicitud from "../models/documentosSolicitud";
import SolicitudTramites from "../models/solicitudTramites";
import Usuarios from "../models/usuarios";
import Tramitador from "../models/tramitador";

import {
  subirArchivo,
  eliminarArchivo,
  archivoExiste,
  obtenerArchivo,
} from "../services/azureFileStorage";

import { db } from "../config/db";
import { conPrefijo, TIPOS_DOCUMENTO_TRAMITE, type TipoDocumentoTramite } from "../services/tramitadores/nombresDocumento";
import { copiarFacturaAlGasto, validarGastoParaFactura } from "../services/facturaTramiteAGasto";
import { ErrorGastos } from "../services/gastos/errores";

// Torre de control (también analistas y administradores) puede mandar la factura al gasto
const esTorreControl = (req: Request) => (req.roles ?? []).some(rol => rol === "TORRE_CONTROL" || rol === "ADMIN");


export class DocumentoSolicitudController {


  // =====================================================
  // VER DOCUMENTO
  // =====================================================

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
      // 4. OBTENER ARCHIVO DE AZURE
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
      // 6. ENVIAR ARCHIVO
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


  // =====================================================
  // SUBIR DOCUMENTOS
  // =====================================================

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


      const usuarioId =
        req.usuario.id;


      // ==========================================
      // 2. OBTENER SOLICITUD
      // ==========================================

      const {
        solicitudTramiteId
      } = req.body;


      if (!solicitudTramiteId) {

        return res.status(400).json({
          error:
            "Debe enviar solicitudTramiteId"
        });

      }


      // ==========================================
      // 3. OBTENER ARCHIVOS
      // ==========================================

      const archivos =
        req.files as Express.Multer.File[];


      if (
        !archivos ||
        archivos.length === 0
      ) {

        return res.status(400).json({
          error:
            "Debe seleccionar al menos un archivo"
        });

      }


      // ==========================================
      // 4. TIPOS PERMITIDOS
      // ==========================================

      const tiposPermitidos = [
        "application/pdf",
        "image/jpeg",
        "image/jpg",
      ];


      // ==========================================
      // 5. VALIDAR CADA ARCHIVO
      // ==========================================

      const MAX_SIZE =
        32 * 1024 * 1024;


      for (
        const archivo
        of archivos
      ) {

        // ------------------------------------------
        // TIPO
        // ------------------------------------------

        if (
          !tiposPermitidos.includes(
            archivo.mimetype
          )
        ) {

          return res.status(400).json({
            error:
              `El archivo "${archivo.originalname}" no es válido. Solo se permiten PDF y JPG.`
          });

        }


        // ------------------------------------------
        // TAMAÑO
        // ------------------------------------------

        if (
          archivo.size > MAX_SIZE
        ) {

          return res.status(400).json({
            error:
              `El archivo "${archivo.originalname}" supera los 32 MB.`
          });

        }


        // ------------------------------------------
        // NOMBRE
        // ------------------------------------------

        const extension =
          path.extname(
            archivo.originalname
          );


        const nombreBase =
          path.basename(
            archivo.originalname,
            extension
          );


        if (
          nombreBase.length > 20
        ) {

          return res.status(400).json({
            error:
              `El nombre del archivo "${archivo.originalname}" no puede tener más de 20 caracteres.`
          });

        }

      }


      // ==========================================
      // 6. MÁXIMO DE ARCHIVOS
      // ==========================================

      if (
        archivos.length > 10
      ) {

        return res.status(400).json({
          error:
            "Puede cargar máximo 10 documentos por solicitud"
        });

      }


      // ==========================================
      // 7. TAMAÑO TOTAL
      // ==========================================

      const MAX_TOTAL_SIZE =
        320 * 1024 * 1024;


      const tamañoTotal =
        archivos.reduce(
          (total, archivo) =>
            total + archivo.size,
          0
        );


      if (
        tamañoTotal >
        MAX_TOTAL_SIZE
      ) {

        return res.status(400).json({
          error:
            "El tamaño total de los documentos no puede superar los 320 MB"
        });

      }


      // ==========================================
      // 8. VALIDAR SOLICITUD
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


      // Tipo de documento (opcional) y, si es factura, el gasto del trámite al que también va
      const tipoDocumento: TipoDocumentoTramite | null =
        req.body.tipoDocumento && req.body.tipoDocumento in TIPOS_DOCUMENTO_TRAMITE
          ? req.body.tipoDocumento as TipoDocumentoTramite
          : null;
      const solicitudGastoId = Number(req.body.solicitudGastoId) > 0 ? Number(req.body.solicitudGastoId) : null;
      if (solicitudGastoId) {
        if (tipoDocumento !== "FACTURA") {
          return res.status(400).json({ error: "Solo una factura se puede cargar también al gasto" });
        }
        if (!esTorreControl(req)) {
          return res.status(403).json({ error: "Solo Torre de control carga la factura al gasto" });
        }
        try {
          // Antes de subir nada: el gasto es de este trámite y aún recibe documentos
          await validarGastoParaFactura(Number(solicitudTramiteId), solicitudGastoId);
        } catch (error) {
          if (error instanceof ErrorGastos) return res.status(400).json({ error: error.message });
          throw error;
        }
      }


      // ==========================================
      // 9. DIRECTORIO
      // ==========================================

      const rutaDirectorio =
        `solicitudes/${solicitudTramiteId}`;


      // ==========================================
      // 10. PREPARAR DOCUMENTOS
      // ==========================================

      const documentosPreparados: {
        archivo: Express.Multer.File;
        nombreArchivo: string;
        rutaArchivo: string;
      }[] = [];


      // Nombres reservados durante esta petición

      const nombresReservados =
        new Set<string>();


      for (
        const archivo
        of archivos
      ) {

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
          nombresReservados.has(
            nombreArchivo
          ) ||
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
      // 11. TRANSACCIÓN POSTGRESQL
      // ==========================================

      const transaction =
        await db.transaction();


      try {

        // ========================================
        // 12. SUBIR ARCHIVOS A AZURE
        // ========================================

        for (
          const documento
          of documentosPreparados
        ) {

          await subirArchivo(

            rutaDirectorio,

            documento.nombreArchivo,

            documento.archivo.buffer

          );


          // Guardar para rollback

          archivosSubidos.push({

            rutaDirectorio,

            nombreArchivo:
              documento.nombreArchivo

          });

        }


        // ========================================
        // 13. CREAR REGISTROS POSTGRESQL
        // ========================================

        const documentos =
          await DocumentoSolicitud.bulkCreate(

            documentosPreparados.map(
              documento => ({

                solicitudTramiteId:
                  Number(
                    solicitudTramiteId
                  ),

                usuarioId,

                tipoDocumento,

                // Con tipo, el nombre lleva el prefijo (ej: "Factura - x.pdf"), como en la app
                nombreOriginal: tipoDocumento
                  ? conPrefijo(TIPOS_DOCUMENTO_TRAMITE[tipoDocumento], documento.archivo.originalname)
                  : documento.archivo.originalname,

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


        // ========================================
        // 14. CONFIRMAR TRANSACCIÓN
        // ========================================

        await transaction.commit();


        // La factura también al gasto. Si falla, los documentos del trámite ya quedaron: se avisa
        let gasto: string | null = null;
        let errorGasto: string | null = null;
        if (solicitudGastoId) {
          try {
            gasto = (await copiarFacturaAlGasto(Number(solicitudTramiteId), solicitudGastoId, archivos, usuarioId)).codigo;
          } catch (error) {
            console.error("ERROR COPIANDO LA FACTURA AL GASTO:", error);
            errorGasto = error instanceof ErrorGastos ? error.message : "No se pudo cargar la factura al gasto";
          }
        }


        // ========================================
        // 15. RESPUESTA
        // ========================================

        return res.status(201).json({

          mensaje: gasto
            ? `Documentos cargados al trámite y la factura al gasto ${gasto}`
            : errorGasto
              ? `Documentos cargados al trámite, pero no al gasto: ${errorGasto}. Súbala desde Nodex Gastos`
              : "Documentos cargados correctamente",

          gasto,

          errorGasto,

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

        // ========================================
        // ROLLBACK POSTGRESQL
        // ========================================

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


  // =====================================================
  // LISTAR DOCUMENTOS
  // =====================================================

  static listarDocumentos = async (
    req: Request,
    res: Response
  ) => {

    try {

      // ==========================================
      // 1. AUTENTICACIÓN
      // ==========================================

      if (!req.usuario) {

        return res.status(401).json({
          error:
            "Usuario no autenticado"
        });

      }


      // ==========================================
      // 2. ID SOLICITUD
      // ==========================================

      const {
        solicitudTramiteId
      } = req.params;


      if (!solicitudTramiteId) {

        return res.status(400).json({
          error:
            "Debe indicar el ID de la solicitud"
        });

      }


      // ==========================================
      // 3. VALIDAR SOLICITUD
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
      // 4. BUSCAR DOCUMENTOS
      // ==========================================

      const documentos =
        await DocumentoSolicitud.findAll({

          where: {

            solicitudTramiteId:
              Number(
                solicitudTramiteId
              )

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

            "tramitadorId",

            "tipoDocumento",

            "createdAt"

          ],

          // Quién lo subió: usuario de Nodex Trámites o tramitador (app)
          include: [
            { model: Usuarios, attributes: ["nombreUsuario"] },
            { model: Tramitador, attributes: ["nombreTramitador"] }
          ]

        });


      // ==========================================
      // 5. RESPUESTA
      // ==========================================

      return res.status(200).json({

        solicitudTramiteId:
          Number(
            solicitudTramiteId
          ),

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


  // =====================================================
  // DESCARGAR DOCUMENTO
  // =====================================================

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
          error:
            "Usuario no autenticado"
        });

      }


      // ==========================================
      // 2. ID
      // ==========================================

      const { id } =
        req.params;


      if (!id) {

        return res.status(400).json({
          error:
            "Debe indicar el documento"
        });

      }


      // ==========================================
      // 3. BUSCAR DOCUMENTO
      // ==========================================

      const documento =
        await DocumentoSolicitud.findByPk(
          id
        );


      if (!documento) {

        return res.status(404).json({
          error:
            "El documento no existe"
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
      // 5. HEADERS
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

      return res.send(
        archivo
      );


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


  // =====================================================
  // ELIMINAR DOCUMENTO
  // =====================================================

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
          error:
            "Usuario no autenticado"
        });

      }


      // ==========================================
      // 2. ID
      // ==========================================

      const { id } =
        req.params;


      if (!id) {

        return res.status(400).json({
          error:
            "Debe indicar el documento"
        });

      }


      // ==========================================
      // 3. BUSCAR DOCUMENTO
      // ==========================================

      const documento =
        await DocumentoSolicitud.findByPk(
          id
        );


      if (!documento) {

        return res.status(404).json({
          error:
            "El documento no existe"
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