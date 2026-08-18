"use client"

import { useEffect, useState } from "react"

import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle
} from "@headlessui/react"

import {
  Flag,
  Check,
  ChevronDown,
  X,
  CheckCircle2,
  Ban,
  CircleCheck,
  Clock3,
  PlayCircle,
  CircleDashed
} from "lucide-react"


interface Estado {
  id: number
  nombreEstado: string
}


interface Props {
  onChange?: (estadoId: number | null) => void
  name?: string
  defaultValue?: number
  openExternally?: boolean
  onCloseExternally?: () => void
}


export default function EstadosLista({
  onChange,
  name = "estadoId",
  defaultValue,
  openExternally,
  onCloseExternally
}: Props) {

  const [estados, setEstados] =
    useState<Estado[]>([])

  const [selectedEstado, setSelectedEstado] =
    useState<Estado | null>(null)

  const [open, setOpen] =
    useState(false)


  // =====================================================
  // ABRIR EXTERNAMENTE
  // =====================================================

  useEffect(() => {

    if (openExternally) {
      setOpen(true)
    }

  }, [openExternally])


  // =====================================================
  // CARGAR ESTADOS
  // =====================================================

  useEffect(() => {

    const fetchEstados = async () => {

      try {

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/estados`
        )

        const data =
          await response.json()

        setEstados(data)


        if (defaultValue) {

          const found =
            data.find(
              (estado: Estado) =>
                estado.id === defaultValue
            )

          if (found) {
            setSelectedEstado(found)
          }

        }

      } catch (error) {

        console.error(
          "Error cargando estados:",
          error
        )

      }

    }


    fetchEstados()

  }, [defaultValue])


  // =====================================================
  // ESTILO VISUAL SEGÚN ESTADO
  // =====================================================

  const getEstadoVisual = (
    nombreEstado: string
  ) => {

    const nombre =
      nombreEstado
        .toLowerCase()
        .trim()


    // -----------------------------------------------
    // FINALIZADO
    // -----------------------------------------------

    if (nombre === "finalizado") {

      return {
        icon: CheckCircle2,
        iconColor: "text-emerald-500",
        bgColor: "bg-emerald-50",
        borderColor: "border-emerald-100",
        hoverColor: "hover:bg-emerald-50",
        textColor: "text-emerald-700"
      }

    }


    // -----------------------------------------------
    // DESISTIDO
    // -----------------------------------------------

    if (nombre === "desistido") {

      return {
        icon: Ban,
        iconColor: "text-red-500",
        bgColor: "bg-red-50",
        borderColor: "border-red-100",
        hoverColor: "hover:bg-red-50",
        textColor: "text-red-700"
      }

    }


    // -----------------------------------------------
    // NOVEDAD SUBSANADA
    // -----------------------------------------------

    if (
      nombre ===
      "novedad subsanada continuar trámite"
    ) {

      return {
        icon: CircleCheck,
        iconColor: "text-violet-500",
        bgColor: "bg-violet-50",
        borderColor: "border-violet-100",
        hoverColor: "hover:bg-violet-50",
        textColor: "text-violet-700"
      }

    }


    // -----------------------------------------------
    // EN ESPERA
    // -----------------------------------------------

    if (
      nombre ===
      "en espera por novedad"
    ) {

      return {
        icon: Clock3,
        iconColor: "text-amber-500",
        bgColor: "bg-amber-50",
        borderColor: "border-amber-100",
        hoverColor: "hover:bg-amber-50",
        textColor: "text-amber-700"
      }

    }


    // -----------------------------------------------
    // EN CURSO
    // -----------------------------------------------

    if (nombre === "en curso") {

      return {
        icon: PlayCircle,
        iconColor: "text-sky-500",
        bgColor: "bg-sky-50",
        borderColor: "border-sky-100",
        hoverColor: "hover:bg-sky-50",
        textColor: "text-sky-700"
      }

    }


    // -----------------------------------------------
    // SIN INICIAR
    // -----------------------------------------------

    return {

      icon: CircleDashed,

      iconColor:
        "text-slate-400",

      bgColor:
        "bg-slate-50",

      borderColor:
        "border-slate-200",

      hoverColor:
        "hover:bg-slate-50",

      textColor:
        "text-slate-600"

    }

  }


  // =====================================================
  // SELECCIONAR ESTADO
  // =====================================================

  const handleSelect = (
    estado: Estado
  ) => {

    setSelectedEstado(estado)

    setOpen(false)

    onChange?.(estado.id)

    onCloseExternally?.()

  }


  // =====================================================
  // CERRAR
  // =====================================================

  const closeModal = () => {

    setOpen(false)

    onCloseExternally?.()

  }


  return (

    <div className="
      w-full
    ">


      {/* ================================================= */}
      {/* SELECTOR INTERNO                                  */}
      {/* ================================================= */}

      {!openExternally && (

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="
            group
            flex
            items-center
            justify-between
            w-full
            h-10
            px-3
            rounded-md
            border
            border-slate-200
            bg-slate-50
            text-xs
            text-slate-700
            transition
            outline-none
            hover:bg-white
            hover:border-sky-300
            focus:border-sky-400
            focus:ring-2
            focus:ring-sky-100
          "
        >

          <div className="
            flex
            items-center
            gap-2
          ">

            <Flag
              size={15}
              className="
                text-slate-400
                group-hover:text-sky-500
              "
            />


            <span>

              {
                selectedEstado
                  ? selectedEstado.nombreEstado
                  : "Seleccionar Estado..."
              }

            </span>

          </div>


          <ChevronDown
            size={16}
            className="
              text-slate-400
              transition
              group-hover:text-sky-500
            "
          />

        </button>

      )}



      {/* ================================================= */}
      {/* INPUT OCULTO                                      */}
      {/* ================================================= */}

      <input
        type="hidden"
        name={name}
        value={
          selectedEstado?.id ?? ""
        }
      />



      {/* ================================================= */}
      {/* MODAL                                             */}
      {/* ================================================= */}

      <Dialog
        open={open}
        onClose={closeModal}
        className="relative z-50"
      >


        {/* =============================================== */}
        {/* FONDO                                           */}
        {/* =============================================== */}

        <DialogBackdrop
          className="
            fixed
            inset-0
            bg-slate-900/40
            backdrop-blur-[1px]
          "
        />



        {/* =============================================== */}
        {/* CONTENEDOR                                      */}
        {/* =============================================== */}

        <div className="
          fixed
          inset-0
          flex
          items-center
          justify-center
          p-4
          sm:p-6
        ">


          {/* ============================================= */}
          {/* PANEL                                         */}
          {/* ============================================= */}

          <DialogPanel
            className="
              w-full
              max-w-md
              overflow-hidden
              rounded-xl
              bg-white
              border
              border-slate-200
              shadow-xl
            "
          >


            {/* =========================================== */}
            {/* ENCABEZADO                                  */}
            {/* =========================================== */}

            <div className="
              flex
              items-center
              justify-between
              px-5
              py-4
              border-b
              border-slate-200
              bg-white
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
                  w-9
                  h-9
                  rounded-lg
                  bg-sky-50
                  border
                  border-sky-100
                ">

                  <Flag
                    size={18}
                    className="text-sky-500"
                  />

                </div>


                <div>

                  <DialogTitle
                    className="
                      text-sm
                      font-semibold
                      text-slate-800
                    "
                  >
                    Seleccionar Estado
                  </DialogTitle>


                  <p className="
                    mt-0.5
                    text-xs
                    text-slate-400
                  ">
                    Seleccione el estado correspondiente al trámite.
                  </p>

                </div>

              </div>



              {/* ========================================= */}
              {/* CERRAR                                     */}
              {/* ========================================= */}

              <button
                type="button"
                onClick={closeModal}
                className="
                  flex
                  items-center
                  justify-center
                  w-8
                  h-8
                  rounded-md
                  text-slate-400
                  transition
                  hover:bg-slate-50
                  hover:text-slate-600
                  focus:outline-none
                  focus:ring-2
                  focus:ring-sky-100
                "
                aria-label="Cerrar"
              >

                <X size={17} />

              </button>

            </div>



            {/* =========================================== */}
            {/* LISTA DE ESTADOS                             */}
            {/* =========================================== */}

            <div className="
              p-4
            ">

              <div className="
                max-h-80
                overflow-y-auto
                rounded-lg
                border
                border-slate-200
              ">


                {estados.map((estado) => {

                  const seleccionado =
                    selectedEstado?.id === estado.id


                  const visual =
                    getEstadoVisual(
                      estado.nombreEstado
                    )


                  const Icon =
                    visual.icon


                  return (

                    <button
                      key={estado.id}
                      type="button"
                      onClick={() =>
                        handleSelect(estado)
                      }

                      className={`
                        group
                        flex
                        items-center
                        justify-between
                        w-full
                        px-3
                        py-2.5
                        text-left
                        text-xs
                        transition-colors
                        border-b
                        border-slate-100
                        last:border-b-0

                        ${
                          seleccionado
                            ? `${visual.bgColor} ${visual.textColor}`
                            : `bg-white text-slate-600 ${visual.hoverColor}`
                        }
                      `}
                    >


                      {/* ================================= */}
                      {/* INFORMACIÓN DEL ESTADO             */}
                      {/* ================================= */}

                      <div className="
                        flex
                        items-center
                        gap-3
                      ">


                        {/* ICONO */}

                        <div
                          className={`
                            flex
                            items-center
                            justify-center
                            w-8
                            h-8
                            rounded-md
                            border
                            shrink-0
                            transition
                            ${
                              seleccionado
                                ? `${visual.bgColor} ${visual.borderColor}`
                                : "bg-slate-50 border-slate-200"
                            }
                          `}
                        >

                          <Icon
                            size={16}
                            className={`
                              ${visual.iconColor}
                            `}
                          />

                        </div>


                        {/* NOMBRE */}

                        <span className="
                          font-medium
                        ">
                          {estado.nombreEstado}
                        </span>

                      </div>



                      {/* ================================= */}
                      {/* CHECK                              */}
                      {/* ================================= */}

                      {seleccionado && (

                        <Check
                          size={16}
                          className={
                            visual.iconColor
                          }
                        />

                      )}

                    </button>

                  )

                })}

              </div>

            </div>



            {/* =========================================== */}
            {/* FOOTER                                       */}
            {/* =========================================== */}

            <div className="
              flex
              justify-end
              px-5
              py-3
              border-t
              border-slate-200
              bg-slate-50
            ">

              <button
                type="button"
                onClick={closeModal}
                className="
                  h-8
                  px-4
                  rounded-md
                  border
                  border-slate-200
                  bg-white
                  text-xs
                  font-medium
                  text-slate-600
                  transition
                  hover:bg-slate-50
                  hover:text-slate-700
                  focus:outline-none
                  focus:ring-2
                  focus:ring-sky-100
                "
              >
                Cerrar
              </button>

            </div>


          </DialogPanel>

        </div>

      </Dialog>

    </div>

  )
}