"use client"

import { useState } from "react"

import {
  Download,
  FileSpreadsheet,
  Upload,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  XCircle
} from "lucide-react"


type ErrorExcel = {
  fila: number
  error: string
}


type ResultadoCarga = {
  message: string
  totalProcesados: number
  creados: number[]
  errores: ErrorExcel[]
}


export default function CargaMasivaSolicitudes() {

  const [file, setFile] =
    useState<File | null>(null)

  const [progress, setProgress] =
    useState(0)

  const [loading, setLoading] =
    useState(false)

  const [modo, setModo] =
    useState<
      "validar" |
      "cargar" |
      null
    >(null)


  const [resultado, setResultado] =
    useState<ResultadoCarga>({
      message: "",
      totalProcesados: 0,
      creados: [],
      errores: []
    })


  // =====================================================
  // DESCARGAR PLANTILLA
  // =====================================================

  const descargarPlantilla = () => {

    window.location.href =
      `${process.env.NEXT_PUBLIC_API_URL}/solicitudTramites/plantilla`

  }


  // =====================================================
  // VALIDAR ARCHIVO
  // =====================================================

  const validarArchivo = async () => {

    if (!file) return

    try {

      setLoading(true)

      setModo("validar")

      const formData =
        new FormData()

      formData.append(
        "file",
        file
      )


      const res =
        await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/solicitudTramites/validar-excel`,
          {
            method: "POST",
            body: formData,
            credentials: "include"
          }
        )


      const json =
        await res.json()


      if (!res.ok) {

        alert(
          json.message ||
          "Error validando archivo"
        )

        return

      }


      setResultado({
        message:
          json.message ?? "",

        totalProcesados:
          json.totalProcesados ?? 0,

        creados:
          json.creados ?? [],

        errores:
          json.errores ?? []
      })


    } catch (error) {

      console.error(error)

      alert(
        "Error validando archivo"
      )

    } finally {

      setLoading(false)

    }

  }


  // =====================================================
  // CARGAR ARCHIVO
  // =====================================================

  const subirArchivo = () => {

    if (!file) return


    setLoading(true)

    setProgress(0)

    setModo("cargar")


    const formData =
      new FormData()

    formData.append(
      "file",
      file
    )


    const xhr =
      new XMLHttpRequest()


    xhr.open(
      "POST",
      `${process.env.NEXT_PUBLIC_API_URL}/solicitudTramites/carga-masiva`
    )


    xhr.withCredentials =
      true


    // ===================================================
    // PROGRESO
    // ===================================================

    xhr.upload.onprogress =
      (event) => {

        if (
          event.lengthComputable
        ) {

          const percent =
            Math.round(
              (event.loaded /
                event.total) *
              100
            )

          setProgress(percent)

        }

      }


    // ===================================================
    // RESPUESTA
    // ===================================================

    xhr.onload = () => {

      try {

        const json =
          JSON.parse(
            xhr.responseText
          )


        if (
          xhr.status !== 200
        ) {

          alert(
            json.message ||
            "Error del servidor"
          )

          setLoading(false)

          return

        }


        setResultado({
          message:
            json.message ?? "",

          totalProcesados:
            json.totalProcesados ?? 0,

          creados:
            json.creados ?? [],

          errores:
            json.errores ?? []
        })


      } catch (error) {

        console.error(error)

        alert(
          "Respuesta inválida del servidor"
        )

      } finally {

        setLoading(false)

      }

    }


    // ===================================================
    // ERROR
    // ===================================================

    xhr.onerror = () => {

      setLoading(false)

      alert(
        "Error en la carga"
      )

    }


    xhr.send(
      formData
    )

  }


  // =====================================================
  // RESULTADOS
  // =====================================================

  const {
    totalProcesados,
    creados,
    errores
  } = resultado


  return (

    <div className="
      w-full
      max-w-3xl
      space-y-4
    ">


      {/* ================================================= */}
      {/* ENCABEZADO                                        */}
      {/* ================================================= */}

      <div className="
        flex
        items-center
        gap-3
      ">

        <div className="
          flex
          items-center
          justify-center
          w-9
          h-9
          rounded-lg
          bg-sky-50
          border
          border-sky-100
        ">

          <FileSpreadsheet
            size={18}
            className="
              text-sky-500
            "
          />

        </div>


        <div>

          <h2 className="
            text-xs
            font-semibold
            text-slate-700
          ">

            Carga masiva de solicitudes

          </h2>


          <p className="
            mt-0.5
            text-xs
            text-slate-400
          ">

            Seleccione, valide y cargue el archivo Excel.

          </p>

        </div>

      </div>



      {/* ================================================= */}
      {/* PLANTILLA                                        */}
      {/* ================================================= */}

      <div className="
        bg-slate-50
        border
        border-slate-200
        rounded-xl
        p-4
      ">

        <div className="
          flex
          flex-col
          sm:flex-row
          sm:items-center
          sm:justify-between
          gap-3
        ">


          <div className="
            flex
            items-center
            gap-3
          ">

            <div className="
              flex
              items-center
              justify-center
              w-8
              h-8
              rounded-lg
              bg-white
              border
              border-slate-200
            ">

              <Download
                size={15}
                className="
                  text-slate-500
                "
              />

            </div>


            <div>

              <p className="
                text-xs
                font-medium
                text-slate-700
              ">

                Plantilla de Excel

              </p>


              <p className="
                mt-0.5
                text-xs
                text-slate-400
              ">

                Utilice la plantilla oficial de Nodex.

              </p>

            </div>

          </div>


          <button
            type="button"
            onClick={
              descargarPlantilla
            }
            className="
              inline-flex
              items-center
              justify-center
              gap-2
              h-9
              px-3
              rounded-md
              border
              border-slate-200
              bg-white
              text-slate-600
              text-xs
              font-medium
              transition
              hover:bg-slate-100
              hover:border-slate-300
            "
          >

            <Download
              size={14}
            />

            Descargar plantilla

          </button>

        </div>

      </div>



      {/* ================================================= */}
      {/* SELECCIÓN ARCHIVO                                 */}
      {/* ================================================= */}

      <div className="
        bg-white
        border
        border-slate-200
        rounded-xl
        p-4
      ">


        <div className="
          flex
          items-center
          gap-2
          mb-3
        ">

          <Upload
            size={15}
            className="
              text-sky-500
            "
          />


          <p className="
            text-xs
            font-semibold
            text-slate-700
          ">

            Seleccionar archivo

          </p>

        </div>


        <label
          htmlFor="archivoExcel"
          className="
            flex
            flex-col
            items-center
            justify-center
            gap-2
            min-h-28
            px-4
            border
            border-dashed
            border-slate-300
            rounded-lg
            bg-slate-50
            cursor-pointer
            transition
            hover:bg-sky-50
            hover:border-sky-300
          "
        >

          <div className="
            flex
            items-center
            justify-center
            w-9
            h-9
            rounded-lg
            bg-white
            border
            border-slate-200
          ">

            <FileSpreadsheet
              size={18}
              className="
                text-sky-500
              "
            />

          </div>


          {file ? (

            <>

              <p className="
                text-xs
                font-medium
                text-slate-700
                text-center
                break-all
              ">

                {file.name}

              </p>


              <p className="
                text-xs
                text-slate-400
              ">

                Archivo seleccionado

              </p>

            </>

          ) : (

            <>

              <p className="
                text-xs
                font-medium
                text-slate-600
              ">

                Seleccione el archivo Excel

              </p>


              <p className="
                text-xs
                text-slate-400
              ">

                Formatos permitidos: .xlsx y .xls

              </p>

            </>

          )}

        </label>


        <input
          id="archivoExcel"
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) =>
            setFile(
              e.target.files?.[0] ||
              null
            )
          }
        />

      </div>



      {/* ================================================= */}
      {/* ACCIONES                                          */}
      {/* ================================================= */}

      <div className="
        grid
        grid-cols-1
        sm:grid-cols-2
        gap-3
      ">


        {/* ================================================= */}
        {/* VALIDAR                                           */}
        {/* ================================================= */}

        <button
          type="button"
          onClick={
            validarArchivo
          }
          disabled={
            !file ||
            loading
          }

          className="
            flex
            items-center
            justify-center
            gap-2
            h-10
            rounded-md
            border
            border-amber-200
            bg-amber-50
            text-amber-700
            text-xs
            font-medium
            transition

            hover:bg-amber-100

            disabled:opacity-40
            disabled:cursor-not-allowed
          "
        >

          {loading &&
          modo === "validar" ? (

            <Loader2
              size={15}
              className="
                animate-spin
              "
            />

          ) : (

            <ShieldCheck
              size={15}
            />

          )}


          {loading &&
          modo === "validar"
            ? "Validando..."
            : "Validar Excel"}

        </button>



        {/* ================================================= */}
        {/* CARGAR                                            */}
        {/* ================================================= */}

        <button
          type="button"
          onClick={
            subirArchivo
          }
          disabled={
            !file ||
            loading
          }

          className="
            flex
            items-center
            justify-center
            gap-2
            h-10
            rounded-md
            bg-sky-500
            text-white
            text-xs
            font-medium
            transition

            hover:bg-sky-600

            disabled:bg-slate-300
            disabled:cursor-not-allowed
          "
        >

          {loading &&
          modo === "cargar" ? (

            <Loader2
              size={15}
              className="
                animate-spin
              "
            />

          ) : (

            <Upload
              size={15}
            />

          )}


          {loading &&
          modo === "cargar"
            ? "Cargando..."
            : "Cargar Excel"}

        </button>

      </div>



      {/* ================================================= */}
      {/* PROGRESO                                           */}
      {/* ================================================= */}

      {loading &&
      modo === "cargar" && (

        <div className="
          bg-white
          border
          border-slate-200
          rounded-xl
          p-4
        ">


          <div className="
            flex
            items-center
            justify-between
            mb-2
          ">

            <span className="
              text-xs
              text-slate-500
            ">

              Subiendo archivo

            </span>


            <span className="
              text-xs
              font-semibold
              text-sky-600
            ">

              {progress}%

            </span>

          </div>


          <div className="
            w-full
            h-2
            bg-slate-100
            rounded-full
            overflow-hidden
          ">

            <div
              className="
                h-full
                bg-sky-500
                rounded-full
                transition-all
                duration-300
              "
              style={{
                width:
                  `${progress}%`
              }}
            />

          </div>

        </div>

      )}



      {/* ================================================= */}
      {/* RESULTADOS                                        */}
      {/* ================================================= */}

      {(modo === "validar" ||
        modo === "cargar") && (

        <div className="
          bg-white
          border
          border-slate-200
          rounded-xl
          overflow-hidden
        ">


          {/* ================================================= */}
          {/* CABECERA RESULTADO                               */}
          {/* ================================================= */}

          <div className="
            px-4
            py-3
            border-b
            border-slate-100
            bg-slate-50
          ">

            <div className="
              flex
              items-center
              gap-2
            ">

              <CheckCircle2
                size={15}
                className="
                  text-sky-500
                "
              />


              <span className="
                text-xs
                font-semibold
                text-slate-700
              ">

                Resultado del proceso

              </span>

            </div>

          </div>



          {/* ================================================= */}
          {/* ESTADÍSTICAS                                     */}
          {/* ================================================= */}

          <div className="
            grid
            grid-cols-1
            sm:grid-cols-3
            divide-y
            sm:divide-y-0
            sm:divide-x
            divide-slate-100
          ">


            {/* TOTAL */}

            <div className="
              p-4
            ">

              <p className="
                text-xs
                text-slate-400
              ">

                Total de filas

              </p>


              <p className="
                mt-1
                text-xs
                font-semibold
                text-slate-700
              ">

                {totalProcesados}

              </p>

            </div>



            {/* GUARDADAS */}

            {modo === "cargar" && (

              <div className="
                p-4
              ">

                <p className="
                  text-xs
                  text-slate-400
                ">

                  Guardadas

                </p>


                <p className="
                  mt-1
                  text-xs
                  font-semibold
                  text-emerald-600
                ">

                  {creados.length}

                </p>

              </div>

            )}



            {/* ERRORES */}

            <div className="
              p-4
            ">

              <p className="
                text-xs
                text-slate-400
              ">

                Errores

              </p>


              <p className={`
                mt-1
                text-xs
                font-semibold
                ${
                  errores.length > 0
                    ? "text-red-500"
                    : "text-emerald-600"
                }
              `}>

                {errores.length}

              </p>

            </div>

          </div>



          {/* ================================================= */}
          {/* MENSAJE                                          */}
          {/* ================================================= */}

          {resultado.message && (

            <div className="
              px-4
              py-3
              border-t
              border-slate-100
              flex
              items-start
              gap-2
            ">

              {errores.length > 0 ? (

                <AlertCircle
                  size={14}
                  className="
                    text-amber-500
                    mt-0.5
                    shrink-0
                  "
                />

              ) : (

                <CheckCircle2
                  size={14}
                  className="
                    text-emerald-500
                    mt-0.5
                    shrink-0
                  "
                />

              )}


              <p className="
                text-xs
                text-slate-500
              ">

                {resultado.message}

              </p>

            </div>

          )}



          {/* ================================================= */}
          {/* ERRORES                                           */}
          {/* ================================================= */}

          {errores.length > 0 && (

            <div className="
              border-t
              border-slate-100
            ">

              <div className="
                px-4
                py-3
                bg-red-50
              ">

                <div className="
                  flex
                  items-center
                  gap-2
                ">

                  <XCircle
                    size={14}
                    className="
                      text-red-500
                    "
                  />


                  <p className="
                    text-xs
                    font-semibold
                    text-red-700
                  ">

                    Errores encontrados

                  </p>

                </div>

              </div>


              <div className="
                max-h-60
                overflow-y-auto
                divide-y
                divide-slate-100
              ">

                {errores.map(
                  (
                    error,
                    index
                  ) => (

                    <div
                      key={`${error.fila}-${index}`}
                      className="
                        px-4
                        py-3
                        flex
                        items-start
                        gap-3
                      "
                    >

                      <span className="
                        shrink-0
                        inline-flex
                        items-center
                        justify-center
                        min-w-7
                        h-7
                        px-2
                        rounded-md
                        bg-red-50
                        text-red-600
                        text-xs
                        font-semibold
                      ">

                        {error.fila}

                      </span>


                      <p className="
                        text-xs
                        text-slate-600
                        leading-5
                      ">

                        {error.error}

                      </p>

                    </div>

                  )
                )}

              </div>

            </div>

          )}

        </div>

      )}

    </div>

  )
}