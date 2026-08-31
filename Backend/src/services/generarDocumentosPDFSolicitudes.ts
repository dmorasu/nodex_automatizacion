import { PDFDocument } from "pdf-lib"

import DocumentoSolicitud
  from "../models/documentosSolicitud"

import {
  obtenerArchivo,
  subirArchivo,
  generarUrlArchivoSAS
} from "./azureFileStorage"


export const generarPdfDocumentosSolicitud = async (

  solicitudTramiteId: number

) => {

  try {

    console.log(
      "📄 GENERANDO PDF DEL TRÁMITE:",
      solicitudTramiteId
    )


    // ==========================================
    // BUSCAR DOCUMENTOS
    // ==========================================

    const documentos =
      await DocumentoSolicitud.findAll({

        where: {

          solicitudTramiteId

        },

        order: [

          ["createdAt", "ASC"]

        ]

      })


    if (
      documentos.length === 0
    ) {

      console.log(
        "⚠️ EL TRÁMITE NO TIENE DOCUMENTOS"
      )


      return null

    }


    console.log(
      "📂 DOCUMENTOS ENCONTRADOS:",
      documentos.length
    )


    // ==========================================
    // CREAR PDF FINAL
    // ==========================================

    const pdfFinal =
      await PDFDocument.create()


    // ==========================================
    // RECORRER DOCUMENTOS
    // ==========================================

    for (
      const documento
      of documentos
    ) {

      try {

        console.log(
          "📥 PROCESANDO:",
          documento.nombreOriginal
        )


        // ==========================================
        // OBTENER DIRECTORIO
        // ==========================================

        const ultimoSlash =
          documento.rutaArchivo.lastIndexOf(
            "/"
          )


        const rutaDirectorio =
          documento.rutaArchivo.substring(

            0,

            ultimoSlash

          )


        // ==========================================
        // DESCARGAR DESDE AZURE
        // ==========================================

        const archivo =
          await obtenerArchivo(

            rutaDirectorio,

            documento.nombreArchivo

          )


        // ==========================================
        // PDF
        // ==========================================

        if (

          documento.tipoArchivo ===
          "application/pdf"

        ) {

          console.log(
            "📄 AGREGANDO PDF"
          )


          const pdfOrigen =
            await PDFDocument.load(
              archivo
            )


          const paginas =
            await pdfFinal.copyPages(

              pdfOrigen,

              pdfOrigen.getPageIndices()

            )


          for (
            const pagina
            of paginas
          ) {

            pdfFinal.addPage(
              pagina
            )

          }

        }


        // ==========================================
        // JPG / JPEG
        // ==========================================

        else if (

          documento.tipoArchivo ===
          "image/jpeg"

          ||

          documento.tipoArchivo ===
          "image/jpg"

        ) {

          console.log(
            "🖼️ AGREGANDO IMAGEN JPG"
          )


          const imagen =
            await pdfFinal.embedJpg(
              archivo
            )


          const pagina =
            pdfFinal.addPage([

              imagen.width,

              imagen.height

            ])


          pagina.drawImage(

            imagen,

            {

              x: 0,

              y: 0,

              width:
                imagen.width,

              height:
                imagen.height

            }

          )

        }


        else {

          console.log(
            "⚠️ ARCHIVO NO SOPORTADO:",
            documento.tipoArchivo
          )

        }


      } catch (error) {

        console.error(

          "❌ ERROR PROCESANDO:",

          documento.nombreOriginal,

          error

        )

      }

    }


    // ==========================================
    // VALIDAR PDF
    // ==========================================

    if (

      pdfFinal.getPageCount() === 0

    ) {

      console.log(
        "❌ EL PDF FINAL NO TIENE PÁGINAS"
      )


      return null

    }


    // ==========================================
    // GENERAR BUFFER
    // ==========================================

    const pdfBytes =
      await pdfFinal.save()


    const pdfBuffer =
      Buffer.from(
        pdfBytes
      )


    console.log(
      "📄 PDF GENERADO:",
      pdfFinal.getPageCount(),
      "páginas"
    )


    // ==========================================
    // DIRECTORIO
    // ==========================================

    const rutaDirectorio =
      `solicitudes/${solicitudTramiteId}/whatsapp`


    // ==========================================
    // NOMBRE
    // ==========================================

    const nombreArchivo =
      `documentos_tramite_${solicitudTramiteId}.pdf`


    // ==========================================
    // SUBIR PDF A AZURE
    // ==========================================

    await subirArchivo(

      rutaDirectorio,

      nombreArchivo,

      pdfBuffer

    )


    console.log(
      "☁️ PDF SUBIDO A AZURE"
    )


    // ==========================================
    // GENERAR URL TEMPORAL
    // ==========================================

    const mediaUrl =
      await generarUrlArchivoSAS(

        rutaDirectorio,

        nombreArchivo,

        120

      )


    console.log(
      "🔗 URL SAS GENERADA"
    )


    // ==========================================
    // RESPUESTA
    // ==========================================

    return {

      mediaUrl,

      rutaDirectorio,

      nombreArchivo,

      totalDocumentos:
        documentos.length,

      totalPaginas:
        pdfFinal.getPageCount()

    }


  } catch (error) {

    console.error(
      "❌ ERROR GENERANDO PDF DEL TRÁMITE:",
      error
    )


    throw error

  }

}