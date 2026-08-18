"use client"

import { useState, useEffect } from "react"

import {
  Frown,
  Meh,
  Smile,
  Star,
  CheckCircle2,
  AlertCircle,
  Send,
  Loader2,
  MessageSquare
} from "lucide-react"

import { crearEvaluacion } from "@/actions/crear-Evaluacion-action"


type Props = {
  closeModal: () => void
  solicitudId: number
}


type Pregunta = {
  id: number
  texto: string
}


export default function EvaluacionModal({
  closeModal,
  solicitudId
}: Props) {


  const [preguntas, setPreguntas] =
    useState<Pregunta[]>([])

  const [respuestas, setRespuestas] =
    useState<Record<number, number>>({})

  const [loading, setLoading] =
    useState(false)

  const [loadingPreguntas, setLoadingPreguntas] =
    useState(true)

  const [error, setError] =
    useState("")

  const [success, setSuccess] =
    useState(false)



  // =====================================================
  // CARGAR PREGUNTAS
  // =====================================================

  useEffect(() => {

    const fetchPreguntas = async () => {

      try {

        const res =
          await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/solicitudes/evaluacion/preguntas`,
            {
              credentials: "include"
            }
          )

        const data =
          await res.json()

        setPreguntas(data)

      } catch {

        setError(
          "Error cargando las preguntas"
        )

      } finally {

        setLoadingPreguntas(false)

      }

    }


    fetchPreguntas()

  }, [])



  // =====================================================
  // VALIDAR RESPUESTAS
  // =====================================================

  const todasRespondidas =
    preguntas.length > 0 &&
    preguntas.every(
      p => respuestas[p.id]
    )



  // =====================================================
  // OPCIONES
  // =====================================================

  const opciones = [

    {
      value: 1,
      label: "Malo",
      icon: Frown
    },

    {
      value: 2,
      label: "Regular",
      icon: Meh
    },

    {
      value: 3,
      label: "Bueno",
      icon: Smile
    },

    {
      value: 4,
      label: "Excelente",
      icon: Star
    }

  ]



  // =====================================================
  // ENVIAR
  // =====================================================

  const handleSubmit = async () => {

    if (!todasRespondidas) {

      setError(
        "Debes responder todas las preguntas"
      )

      return

    }


    setLoading(true)

    setError("")


    const data =
      Object.entries(
        respuestas
      ).map(
        ([preguntaId, calificacion]) => ({

          preguntaId:
            Number(preguntaId),

          calificacion

        })
      )


    try {

      await crearEvaluacion(
        solicitudId,
        data
      )


      setSuccess(true)


      setTimeout(() => {

        closeModal()

        window.history.replaceState(
          {},
          "",
          window.location.pathname
        )

        window.location.reload()

      }, 1800)


    } catch {

      setError(
        "Error enviando la evaluación"
      )

    } finally {

      setLoading(false)

    }

  }



  // =====================================================
  // CARGANDO PREGUNTAS
  // =====================================================

  if (loadingPreguntas) {

    return (

      <div className="
        flex
        flex-col
        items-center
        justify-center
        py-16
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

          <Loader2
            size={17}
            className="
              animate-spin
              text-sky-500
            "
          />

        </div>


        <p className="
          mt-3
          text-xs
          font-medium
          text-slate-600
        ">

          Cargando encuesta...

        </p>


        <p className="
          mt-1
          text-xs
          text-slate-400
        ">

          Espere un momento.

        </p>

      </div>

    )

  }



  return (

    <div className="
      max-w-3xl
      mx-auto
    ">


      {/* ================================================= */}
      {/* ENCABEZADO                                       */}
      {/* ================================================= */}

      <div className="
        flex
        flex-col
        items-center
        text-center
        mb-7
      ">


        <div className="
          flex
          items-center
          justify-center
          w-10
          h-10
          rounded-xl
          bg-sky-50
          border
          border-sky-100
        ">

          <MessageSquare
            size={18}
            className="
              text-sky-500
            "
          />

        </div>


        <h2 className="
          mt-3
          text-lg
          font-semibold
          text-slate-700
        ">

          Evalúa el servicio

        </h2>


        <p className="
          mt-1
          text-xs
          text-slate-400
        ">

          Tu opinión nos ayuda a mejorar nuestro servicio.

        </p>

      </div>



      {/* ================================================= */}
      {/* ÉXITO                                            */}
      {/* ================================================= */}

      {success && (

        <div className="
          flex
          flex-col
          items-center
          justify-center
          py-10
          px-5
          bg-green-50
          border
          border-green-200
          rounded-xl
        ">


          <div className="
            flex
            items-center
            justify-center
            w-10
            h-10
            rounded-full
            bg-green-100
          ">

            <CheckCircle2
              size={20}
              className="
                text-green-600
              "
            />

          </div>


          <p className="
            mt-3
            text-xs
            font-semibold
            text-green-700
          ">

            Evaluación realizada correctamente

          </p>


          <p className="
            mt-1
            text-xs
            text-green-600
            text-center
          ">

            Gracias por compartir tu opinión.

          </p>

        </div>

      )}



      {/* ================================================= */}
      {/* ERROR                                             */}
      {/* ================================================= */}

      {error && !success && (

        <div className="
          flex
          items-center
          gap-2
          mb-5
          px-3
          py-2.5
          bg-red-50
          border
          border-red-200
          rounded-md
        ">

          <AlertCircle
            size={14}
            className="
              shrink-0
              text-red-500
            "
          />

          <p className="
            text-xs
            text-red-600
          ">

            {error}

          </p>

        </div>

      )}



      {/* ================================================= */}
      {/* PREGUNTAS                                        */}
      {/* ================================================= */}

      {!success && (

        <div className="
          space-y-4
        ">


          {preguntas.map(
            (pregunta, index) => (

              <div
                key={pregunta.id}
                className="
                  border
                  border-slate-200
                  rounded-xl
                  bg-white
                  overflow-hidden
                  transition
                  hover:border-slate-300
                "
              >


                {/* ======================================= */}
                {/* PREGUNTA                                */}
                {/* ======================================= */}

                <div className="
                  px-4
                  py-3
                  bg-slate-50
                  border-b
                  border-slate-100
                ">


                  <div className="
                    flex
                    items-start
                    gap-3
                  ">


                    <div className="
                      flex
                      items-center
                      justify-center
                      shrink-0
                      w-7
                      h-7
                      rounded-md
                      bg-sky-50
                      border
                      border-sky-100
                    ">

                      <span className="
                        text-xs
                        font-semibold
                        text-sky-500
                      ">

                        {index + 1}

                      </span>

                    </div>


                    <p className="
                      pt-1
                      text-xs
                      font-medium
                      leading-5
                      text-slate-700
                    ">

                      {pregunta.texto}

                    </p>

                  </div>

                </div>



                {/* ======================================= */}
                {/* OPCIONES                                */}
                {/* ======================================= */}

                <div className="
                  p-4
                  grid
                  grid-cols-2
                  sm:grid-cols-4
                  gap-2
                ">


                  {opciones.map(
                    (option) => {

                      const selected =
                        respuestas[
                          pregunta.id
                        ] === option.value


                      const Icon =
                        option.icon


                      return (

                        <button
                          key={
                            option.value
                          }
                          type="button"
                          onClick={() =>
                            setRespuestas(
                              prev => ({
                                ...prev,
                                [pregunta.id]:
                                  option.value
                              })
                            )
                          }
                          className={`
                            group
                            flex
                            flex-col
                            items-center
                            justify-center
                            gap-1
                            min-h-[68px]
                            px-2
                            py-2
                            rounded-lg
                            border
                            transition-all

                            ${
                              selected

                                ? `
                                  bg-sky-500
                                  border-sky-500
                                  text-white
                                  shadow-sm
                                `

                                : `
                                  bg-white
                                  border-slate-200
                                  text-slate-500
                                  hover:bg-sky-50
                                  hover:border-sky-200
                                  hover:text-sky-600
                                `
                            }
                          `}
                        >

                          <Icon
                            size={18}
                            className={`
                              ${
                                selected
                                  ? "text-white"
                                  : "text-slate-400 group-hover:text-sky-500"
                              }
                            `}
                          />


                          <span className="
                            text-xs
                            font-medium
                          ">

                            {option.label}

                          </span>

                        </button>

                      )

                    }
                  )}

                </div>

              </div>

            )
          )}

        </div>

      )}



      {/* ================================================= */}
      {/* ENVIAR                                           */}
      {/* ================================================= */}

      {!success && (

        <div className="
          mt-6
        ">

          <button
            type="button"
            disabled={
              !todasRespondidas ||
              loading
            }
            onClick={
              handleSubmit
            }
            className={`
              w-full
              h-10
              flex
              items-center
              justify-center
              gap-2
              rounded-md
              text-xs
              font-medium
              transition

              ${
                todasRespondidas &&
                !loading

                  ? `
                    bg-sky-500
                    text-white
                    hover:bg-sky-600
                    focus:outline-none
                    focus:ring-2
                    focus:ring-sky-200
                  `

                  : `
                    bg-slate-100
                    text-slate-400
                    cursor-not-allowed
                    border
                    border-slate-200
                  `
              }
            `}
          >


            {loading ? (

              <>

                <Loader2
                  size={14}
                  className="
                    animate-spin
                  "
                />

                Enviando evaluación...

              </>

            ) : (

              <>

                <Send
                  size={14}
                />

                Enviar evaluación

              </>

            )}

          </button>


          {!todasRespondidas && (

            <p className="
              mt-2
              text-center
              text-xs
              text-slate-400
            ">

              Responde todas las preguntas para continuar.

            </p>

          )}

        </div>

      )}

    </div>

  )
}