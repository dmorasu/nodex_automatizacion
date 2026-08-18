"use client";

import { useEffect, useRef, useState } from "react";
import {
  FileText,
  Upload,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Eye,
  Download,
  Trash2,
  X,
} from "lucide-react";

interface Documento {
  id: number;
  solicitudTramiteId: number;
  nombreOriginal: string;
  nombreArchivo: string;
  rutaArchivo: string;
  tipoArchivo: string;
  tamano: number;
  usuarioId: number;
  createdAt?: string;
}

interface Props {
  solicitudTramiteId: number;
  apiUrl: string;
}

export default function DocumentosSolicitud({
  solicitudTramiteId,
  apiUrl,
}: Props) {

  // ==========================================
  // ESTADOS
  // ==========================================

  const [documentos, setDocumentos] =
    useState<Documento[]>([]);

  const [archivos, setArchivos] =
    useState<File[]>([]);

  const [cargando, setCargando] =
    useState(false);

  const [cargandoLista, setCargandoLista] =
    useState(true);

  const [eliminandoId, setEliminandoId] =
    useState<number | null>(null);

  const [mensaje, setMensaje] =
    useState("");

  const [error, setError] =
    useState("");

  // Documento actualmente abierto en el visor
  const [documentoVisualizando, setDocumentoVisualizando] =
    useState<Documento | null>(null);

  // URL temporal del PDF
  const [pdfUrl, setPdfUrl] =
    useState<string | null>(null);

  const [cargandoPdf, setCargandoPdf] =
    useState(false);

  const inputRef =
    useRef<HTMLInputElement>(null);


  // ==========================================
  // FORMATEAR TAMAÑO
  // ==========================================

  const formatearTamano = (
    bytes: number
  ) => {

    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(
      bytes /
      (1024 * 1024)
    ).toFixed(2)} MB`;
  };


  // ==========================================
  // OBTENER DOCUMENTOS
  // ==========================================

  const obtenerDocumentos = async () => {

    try {

      setCargandoLista(true);
      setError("");

      const response =
        await fetch(
          `${apiUrl}/documentos/solicitud/${solicitudTramiteId}`,
          {
            method: "GET",
            credentials: "include",
          }
        );


      const data =
        await response.json();


      if (!response.ok) {

        throw new Error(
          data.error ||
          data.detalle ||
          "No se pudieron obtener los documentos"
        );

      }


      setDocumentos(
        data.documentos || []
      );


    } catch (error) {

      console.error(
        "ERROR OBTENIENDO DOCUMENTOS:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Error obteniendo documentos"
      );

    } finally {

      setCargandoLista(false);

    }

  };


  // ==========================================
  // CARGAR DOCUMENTOS AL ABRIR LA PÁGINA
  // ==========================================

  useEffect(() => {

    obtenerDocumentos();

  }, [solicitudTramiteId]);


  // ==========================================
  // SELECCIONAR ARCHIVOS
  // ==========================================

  const seleccionarArchivos = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {

    setMensaje("");
    setError("");

    const seleccionados =
      Array.from(
        event.target.files || []
      );


    if (
      seleccionados.length === 0
    ) {
      return;
    }


    // ==========================================
    // MÁXIMO 10 ARCHIVOS
    // ==========================================

    if (
      seleccionados.length > 10
    ) {

      setError(
        "Puede seleccionar máximo 10 documentos."
      );

      return;
    }


    // ==========================================
    // VALIDAR CADA ARCHIVO
    // ==========================================

    for (
      const archivo
      of seleccionados
    ) {

      // ------------------------------------------
      // PDF
      // ------------------------------------------

      if (
        archivo.type !==
        "application/pdf"
      ) {

        setError(
          `El archivo "${archivo.name}" no es un PDF.`
        );

        return;
      }


      // ------------------------------------------
      // TAMAÑO
      // ------------------------------------------

      if (
        archivo.size >
        32 * 1024 * 1024
      ) {

        setError(
          `El archivo "${archivo.name}" supera los 32 MB.`
        );

        return;
      }


      // ------------------------------------------
      // NOMBRE MÁXIMO 20 CARACTERES
      // ------------------------------------------

      const posicionPunto =
        archivo.name.lastIndexOf(".");


      const nombreSinExtension =
        posicionPunto !== -1
          ? archivo.name.substring(
              0,
              posicionPunto
            )
          : archivo.name;


      if (
        nombreSinExtension.length > 20
      ) {

        setError(
          `El nombre "${archivo.name}" no puede tener más de 20 caracteres.`
        );

        return;
      }

    }


    // ==========================================
    // MÁXIMO 50 MB TOTAL
    // ==========================================

    const tamañoTotal =
      seleccionados.reduce(
        (total, archivo) =>
          total + archivo.size,
        0
      );


    if (
      tamañoTotal >
      320 * 1024 * 1024
    ) {

      setError(
        "El tamaño total de los documentos no puede superar los 320 MB."
      );

      return;
    }


    setArchivos(
      seleccionados
    );

  };


  // ==========================================
  // SUBIR DOCUMENTOS
  // ==========================================

  const subirDocumentos = async () => {

    if (
      archivos.length === 0
    ) {

      setError(
        "Debe seleccionar al menos un documento."
      );

      return;
    }


    try {

      setCargando(true);

      setMensaje("");

      setError("");


      const formData =
        new FormData();


      formData.append(
        "solicitudTramiteId",
        String(solicitudTramiteId)
      );


      archivos.forEach(
        (archivo) => {

          formData.append(
            "documentos",
            archivo
          );

        }
      );


      const response =
        await fetch(
          `${apiUrl}/documentos`,
          {
            method: "POST",
            credentials: "include",
            body: formData,
          }
        );


      const data =
        await response.json();


      if (!response.ok) {

        throw new Error(
          data.error ||
          data.detalle ||
          "No se pudieron cargar los documentos"
        );

      }


      setMensaje(
        `${data.totalDocumentos} documento(s) cargado(s) correctamente.`
      );


      setArchivos([]);


      if (inputRef.current) {

        inputRef.current.value = "";

      }


      await obtenerDocumentos();


    } catch (error) {

      console.error(
        "ERROR SUBIENDO DOCUMENTOS:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar los documentos"
      );

    } finally {

      setCargando(false);

    }

  };


  // ==========================================
  // VER DOCUMENTO
  // ==========================================

  const verDocumento = async (
    documento: Documento
  ) => {

    try {

      setDocumentoVisualizando(
        documento
      );

      setCargandoPdf(true);

      setError("");

      // Limpiar URL anterior si existe
      if (pdfUrl) {

        URL.revokeObjectURL(
          pdfUrl
        );

        setPdfUrl(null);

      }


      // ==========================================
      // SOLICITAR PDF AL BACKEND
      // ==========================================

      const response =
        await fetch(
          `${apiUrl}/documentos/${documento.id}/ver`,
          {
            method: "GET",
            credentials: "include",
          }
        );


      if (!response.ok) {

        let mensajeError =
          "No se pudo visualizar el documento";

        try {

          const data =
            await response.json();

          mensajeError =
            data.error ||
            data.detalle ||
            mensajeError;

        } catch {

          // La respuesta no era JSON
        }


        throw new Error(
          mensajeError
        );

      }


      // ==========================================
      // CONVERTIR RESPUESTA A BLOB
      // ==========================================

      const blob =
        await response.blob();


      // ==========================================
      // CREAR URL TEMPORAL
      // ==========================================

      const url =
        URL.createObjectURL(
          blob
        );


      setPdfUrl(url);


    } catch (error) {

      console.error(
        "ERROR VISUALIZANDO DOCUMENTO:",
        error
      );

      setDocumentoVisualizando(
        null
      );

      setPdfUrl(null);

      setError(
        error instanceof Error
          ? error.message
          : "No se pudo visualizar el documento"
      );

    } finally {

      setCargandoPdf(false);

    }

  };


  // ==========================================
  // CERRAR VISOR
  // ==========================================

  const cerrarVisor = () => {

    if (pdfUrl) {

      URL.revokeObjectURL(
        pdfUrl
      );

    }

    setPdfUrl(null);

    setDocumentoVisualizando(
      null
    );

  };


  // ==========================================
  // DESCARGAR DOCUMENTO
  // ==========================================

  const descargarDocumento = async (
    documento: Documento
  ) => {

    try {

      setError("");

      const response =
        await fetch(
          `${apiUrl}/documentos/${documento.id}/descargar`,
          {
            method: "GET",
            credentials: "include",
          }
        );


      if (!response.ok) {

        let mensajeError =
          "No se pudo descargar el documento";

        try {

          const data =
            await response.json();

          mensajeError =
            data.error ||
            data.detalle ||
            mensajeError;

        } catch {}

        throw new Error(
          mensajeError
        );

      }


      // ==========================================
      // OBTENER BLOB
      // ==========================================

      const blob =
        await response.blob();


      // ==========================================
      // CREAR URL TEMPORAL
      // ==========================================

      const url =
        URL.createObjectURL(
          blob
        );


      // ==========================================
      // CREAR LINK DE DESCARGA
      // ==========================================

      const enlace =
        document.createElement("a");

      enlace.href =
        url;

      enlace.download =
        documento.nombreOriginal;

      document.body.appendChild(
        enlace
      );

      enlace.click();

      enlace.remove();


      // ==========================================
      // LIBERAR MEMORIA
      // ==========================================

      URL.revokeObjectURL(
        url
      );


    } catch (error) {

      console.error(
        "ERROR DESCARGANDO DOCUMENTO:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "No se pudo descargar el documento"
      );

    }

  };


  // ==========================================
  // ELIMINAR DOCUMENTO
  // ==========================================

  const eliminarDocumento = async (
    documento: Documento
  ) => {

    const confirmar =
      window.confirm(
        `¿Está seguro de eliminar el documento "${documento.nombreOriginal}"?`
      );


    if (!confirmar) {
      return;
    }


    try {

      setEliminandoId(
        documento.id
      );

      setMensaje("");

      setError("");


      const response =
        await fetch(
          `${apiUrl}/documentos/${documento.id}`,
          {
            method: "DELETE",
            credentials: "include",
          }
        );


      const data =
        await response.json();


      if (!response.ok) {

        throw new Error(
          data.error ||
          data.detalle ||
          "No se pudo eliminar el documento"
        );

      }


      // ==========================================
      // SI EL DOCUMENTO ESTÁ ABIERTO,
      // CERRAR VISOR
      // ==========================================

      if (
        documentoVisualizando?.id ===
        documento.id
      ) {

        cerrarVisor();

      }


      // ==========================================
      // ACTUALIZAR LISTA LOCAL
      // ==========================================

      setDocumentos(
        documentos.filter(
          (item) =>
            item.id !== documento.id
        )
      );


      setMensaje(
        `El documento "${documento.nombreOriginal}" fue eliminado correctamente.`
      );


    } catch (error) {

      console.error(
        "ERROR ELIMINANDO DOCUMENTO:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "No se pudo eliminar el documento"
      );

    } finally {

      setEliminandoId(
        null
      );

    }

  };


  // ==========================================
  // RETURN
  // ==========================================

  return (

    <div className="mt-10">


      {/* ===================================== */}
      {/* TITULO */}
      {/* ===================================== */}

      <h4 className="
        text-2xl
        text-gray-600
        text-center
        font-bold
      ">

        Documentos de la Solicitud

      </h4>


      {/* ===================================== */}
      {/* CONTENEDOR PRINCIPAL */}
      {/* ===================================== */}

      <div className="
        mt-8
        border
        rounded-lg
        shadow-lg
        bg-white
        p-6
      ">


        {/* ================================= */}
        {/* CARGAR DOCUMENTOS */}
        {/* ================================= */}

        <div className="
          flex
          flex-col
          md:flex-row
          gap-4
          items-center
          justify-between
        ">


          <div>

            <p className="
              font-semibold
              text-gray-700
            ">

              Cargar documentos

            </p>


            <p className="
              text-sm
              text-gray-500
              mt-1
            ">

              PDF · máximo 32 MB por archivo ·
              máximo 10 archivos

            </p>

          </div>


          <div className="
            flex
            gap-3
            flex-wrap
            justify-center
          ">


            {/* ================================= */}
            {/* SELECCIONAR */}
            {/* ================================= */}

            <label
              htmlFor={`documentos-${solicitudTramiteId}`}
              className="
                flex
                items-center
                justify-center
                gap-2
                h-10
                px-4
                bg-sky-500
                text-white
                rounded-md
                cursor-pointer
                hover:bg-sky-600
                transition
              "
            >

              <Upload size={18} />

              Seleccionar documentos

            </label>


            <input
              ref={inputRef}
              id={`documentos-${solicitudTramiteId}`}
              type="file"
              accept="application/pdf,.pdf"
              multiple
              className="hidden"
              onChange={
                seleccionarArchivos
              }
            />


            {/* ================================= */}
            {/* CARGAR */}
            {/* ================================= */}

            {archivos.length > 0 && (

              <button
                type="button"
                onClick={
                  subirDocumentos
                }
                disabled={cargando}
                className="
                  flex
                  items-center
                  justify-center
                  gap-2
                  h-10
                  px-4
                  bg-emerald-500
                  text-white
                  rounded-md
                  hover:bg-emerald-600
                  disabled:opacity-50
                  transition
                "
              >

                {cargando ? (

                  <>

                    <RefreshCw
                      size={18}
                      className="animate-spin"
                    />

                    Cargando...

                  </>

                ) : (

                  <>

                    <Upload size={18} />

                    Cargar

                  </>

                )}

              </button>

            )}

          </div>

        </div>


        {/* ================================= */}
        {/* ARCHIVOS SELECCIONADOS */}
        {/* ================================= */}

        {archivos.length > 0 && (

          <div className="
            mt-5
            bg-slate-50
            border
            rounded-lg
            p-4
          ">

            <p className="
              font-semibold
              text-gray-700
              mb-3
            ">

              Documentos seleccionados:

            </p>


            <div className="space-y-2">

              {archivos.map(
                (
                  archivo,
                  index
                ) => (

                  <div
                    key={`${archivo.name}-${index}`}
                    className="
                      flex
                      items-center
                      justify-between
                      bg-white
                      border
                      rounded-md
                      px-3
                      py-2
                    "
                  >

                    <div className="
                      flex
                      items-center
                      gap-3
                    ">

                      <FileText
                        size={20}
                        className="text-red-500"
                      />

                      <span className="
                        text-sm
                        text-gray-700
                      ">

                        {archivo.name}

                      </span>

                    </div>


                    <span className="
                      text-xs
                      text-gray-500
                    ">

                      {formatearTamano(
                        archivo.size
                      )}

                    </span>

                  </div>

                )
              )}

            </div>

          </div>

        )}


        {/* ================================= */}
        {/* MENSAJE ÉXITO */}
        {/* ================================= */}

        {mensaje && (

          <div className="
            mt-4
            flex
            items-center
            gap-2
            bg-emerald-50
            border
            border-emerald-200
            text-emerald-700
            rounded-md
            p-3
            text-sm
          ">

            <CheckCircle
              size={18}
            />

            {mensaje}

          </div>

        )}


        {/* ================================= */}
        {/* MENSAJE ERROR */}
        {/* ================================= */}

        {error && (

          <div className="
            mt-4
            flex
            items-center
            gap-2
            bg-red-50
            border
            border-red-200
            text-red-700
            rounded-md
            p-3
            text-sm
          ">

            <AlertCircle
              size={18}
            />

            {error}

          </div>

        )}


        {/* ================================= */}
        {/* LISTA DE DOCUMENTOS */}
        {/* ================================= */}

        <div className="mt-8">


          <div className="
            flex
            items-center
            justify-between
            mb-4
          ">

            <h5 className="
              font-semibold
              text-gray-700
            ">

              Documentos cargados

            </h5>


            <button
              type="button"
              onClick={
                obtenerDocumentos
              }
              disabled={
                cargandoLista
              }
              className="
                flex
                items-center
                gap-2
                text-sm
                text-sky-600
                hover:text-sky-800
              "
            >

              <RefreshCw
                size={16}
                className={
                  cargandoLista
                    ? "animate-spin"
                    : ""
                }
              />

              Actualizar

            </button>

          </div>


          {/* ================================= */}
          {/* CARGANDO */}
          {/* ================================= */}

          {cargandoLista ? (

            <div className="
              text-center
              py-8
              text-gray-500
            ">

              Cargando documentos...

            </div>


          ) : documentos.length === 0 ? (

            <div className="
              text-center
              py-10
              border
              border-dashed
              rounded-lg
              text-gray-400
            ">

              <FileText
                size={35}
                className="
                  mx-auto
                  mb-2
                "
              />

              No se han cargado documentos.

            </div>


          ) : (

            <div className="
              divide-y
              border
              rounded-lg
              overflow-hidden
            ">


              {documentos.map(
                (documento) => (

                  <div
                    key={documento.id}
                    className="
                      flex
                      flex-col
                      md:flex-row
                      md:items-center
                      md:justify-between
                      gap-3
                      p-4
                      bg-white
                      hover:bg-slate-50
                      transition
                    "
                  >


                    {/* ======================= */}
                    {/* INFORMACIÓN */}
                    {/* ======================= */}

                    <div className="
                      flex
                      items-center
                      gap-3
                      min-w-0
                    ">


                      <div className="
                        bg-red-50
                        p-2
                        rounded-lg
                        flex-shrink-0
                      ">

                        <FileText
                          size={24}
                          className="text-red-500"
                        />

                      </div>


                      <div className="min-w-0">

                        <p className="
                          font-medium
                          text-gray-800
                          truncate
                        ">

                          {documento.nombreOriginal}

                        </p>


                        <p className="
                          text-xs
                          text-gray-500
                        ">

                          {formatearTamano(
                            documento.tamano
                          )}

                          {" · PDF"}

                          {documento.createdAt && (

                            <>

                              {" · "}

                              {new Date(
                                documento.createdAt
                              ).toLocaleString(
                                "es-CO"
                              )}

                            </>

                          )}

                        </p>

                      </div>

                    </div>


                    {/* ======================= */}
                    {/* ACCIONES */}
                    {/* ======================= */}

                    <div className="
                      flex
                      items-center
                      gap-2
                      flex-shrink-0
                    ">


                      {/* ================================= */}
                      {/* VER */}
                      {/* ================================= */}

                      <button
                        type="button"
                        title="Ver documento"
                        onClick={() =>
                          verDocumento(
                            documento
                          )
                        }
                        className="
                          flex
                          items-center
                          gap-2
                          px-3
                          py-2
                          text-sm
                          text-sky-600
                          border
                          border-sky-200
                          rounded-md
                          hover:bg-sky-50
                          transition
                        "
                      >

                        <Eye
                          size={17}
                        />

                        <span className="hidden sm:inline">
                          Ver
                        </span>

                      </button>


                      {/* ================================= */}
                      {/* DESCARGAR */}
                      {/* ================================= */}

                      <button
                        type="button"
                        title="Descargar documento"
                        onClick={() =>
                          descargarDocumento(
                            documento
                          )
                        }
                        className="
                          flex
                          items-center
                          gap-2
                          px-3
                          py-2
                          text-sm
                          text-emerald-600
                          border
                          border-emerald-200
                          rounded-md
                          hover:bg-emerald-50
                          transition
                        "
                      >

                        <Download
                          size={17}
                        />

                        <span className="hidden sm:inline">
                          Descargar
                        </span>

                      </button>


                      {/* ================================= */}
                      {/* ELIMINAR */}
                      {/* ================================= */}

                      <button
                        type="button"
                        title="Eliminar documento"
                        onClick={() =>
                          eliminarDocumento(
                            documento
                          )
                        }
                        disabled={
                          eliminandoId ===
                          documento.id
                        }
                        className="
                          flex
                          items-center
                          gap-2
                          px-3
                          py-2
                          text-sm
                          text-red-600
                          border
                          border-red-200
                          rounded-md
                          hover:bg-red-50
                          disabled:opacity-50
                          transition
                        "
                      >

                        {eliminandoId ===
                        documento.id ? (

                          <RefreshCw
                            size={17}
                            className="animate-spin"
                          />

                        ) : (

                          <Trash2
                            size={17}
                          />

                        )}

                        <span className="hidden sm:inline">
                          Eliminar
                        </span>

                      </button>

                    </div>

                  </div>

                )
              )}

            </div>

          )}

        </div>

      </div>


      {/* ================================================== */}
      {/* MODAL VISUALIZADOR PDF */}
      {/* ================================================== */}

      {documentoVisualizando && (

        <div
          className="
            fixed
            inset-0
            z-50
            flex
            items-center
            justify-center
            bg-black/60
            p-4
          "
          onClick={
            cerrarVisor
          }
        >


          {/* ========================================= */}
          {/* VENTANA */}
          {/* ========================================= */}

          <div
            className="
              bg-white
              w-full
              max-w-6xl
              h-[90vh]
              rounded-xl
              shadow-2xl
              overflow-hidden
              flex
              flex-col
            "
            onClick={(event) =>
              event.stopPropagation()
            }
          >


            {/* ================================= */}
            {/* HEADER DEL MODAL */}
            {/* ================================= */}

            <div
              className="
                flex
                items-center
                justify-between
                px-5
                py-4
                border-b
                bg-white
              "
            >


              {/* INFORMACIÓN */}

              <div
                className="
                  flex
                  items-center
                  gap-3
                  min-w-0
                "
              >

                <div
                  className="
                    bg-red-50
                    p-2
                    rounded-lg
                  "
                >

                  <FileText
                    size={22}
                    className="text-red-500"
                  />

                </div>


                <div className="min-w-0">

                  <p
                    className="
                      font-semibold
                      text-gray-800
                      truncate
                    "
                  >

                    {
                      documentoVisualizando.nombreOriginal
                    }

                  </p>


                  <p
                    className="
                      text-xs
                      text-gray-500
                    "
                  >

                    {formatearTamano(
                      documentoVisualizando.tamano
                    )}

                    {" · PDF"}

                  </p>

                </div>

              </div>


              {/* ACCIONES DEL HEADER */}

              <div
                className="
                  flex
                  items-center
                  gap-2
                "
              >


                {/* DESCARGAR */}

                <button
                  type="button"
                  onClick={() =>
                    descargarDocumento(
                      documentoVisualizando
                    )
                  }
                  className="
                    flex
                    items-center
                    gap-2
                    px-3
                    py-2
                    text-sm
                    text-emerald-600
                    hover:bg-emerald-50
                    rounded-md
                    transition
                  "
                >

                  <Download
                    size={18}
                  />

                  <span className="hidden sm:inline">
                    Descargar
                  </span>

                </button>


                {/* CERRAR */}

                <button
                  type="button"
                  onClick={
                    cerrarVisor
                  }
                  className="
                    flex
                    items-center
                    justify-center
                    w-9
                    h-9
                    text-gray-500
                    hover:text-gray-800
                    hover:bg-gray-100
                    rounded-full
                    transition
                  "
                  title="Cerrar"
                >

                  <X
                    size={21}
                  />

                </button>

              </div>

            </div>


            {/* ================================= */}
            {/* PDF */}
            {/* ================================= */}

            <div
              className="
                flex-1
                bg-gray-100
                overflow-hidden
              "
            >

              {cargandoPdf ? (

                <div
                  className="
                    h-full
                    flex
                    flex-col
                    items-center
                    justify-center
                    text-gray-500
                  "
                >

                  <RefreshCw
                    size={32}
                    className="
                      animate-spin
                      mb-3
                    "
                  />

                  <p>
                    Cargando documento...
                  </p>

                </div>

              ) : pdfUrl ? (

                <iframe
                  src={pdfUrl}
                  title={
                    documentoVisualizando.nombreOriginal
                  }
                  className="
                    w-full
                    h-full
                    border-0
                  "
                />

              ) : (

                <div
                  className="
                    h-full
                    flex
                    items-center
                    justify-center
                    text-gray-500
                  "
                >

                  No se pudo cargar el documento.

                </div>

              )}

            </div>

          </div>

        </div>

      )}

    </div>

  );

}