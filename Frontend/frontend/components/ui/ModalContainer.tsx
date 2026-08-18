"use client"

import { Fragment } from "react"

import {
  useRouter,
  useSearchParams,
  usePathname
} from "next/navigation"

import {
  Dialog,
  DialogPanel,
  Transition,
  TransitionChild
} from "@headlessui/react"

import AddEstadosForm from "../estados/AddEstadosForm"
import EditEstadosForm from "../estados/EditEstadosForm"
import AddTrazabilidadForm from "../trazabilidad/AddTrazabilidadForm"
import AddCuentaCobroForm from "../cuentacobro/AddCuentaCobroForm"
import AddLogisticaForm from "../logistica/AddLogisticaForm"
import AddProgramacionForm from "../programacion/AddProgramacionForm"
import AddTramitadorForm from "../tramitador/AddTramitadorForm"
import EvaluacionModal from "../evaluacion/evaluacionModal"
import AddSubEstadoForm from "../subEstados/AddSubEstadosForm"

import { SolicitudTramiteType } from "@/src/type/solicitudes"


export default function ModalContainer({
  solicitudTramite
}: {
  solicitudTramite: SolicitudTramiteType
}) {

  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()


  // =====================================================
  // ESTADO DEL MODAL
  // =====================================================

  const showModal =
    searchParams.get("showModal")

  const show =
    !!showModal


  // =====================================================
  // ACCIONES
  // =====================================================

  const addEstado =
    searchParams.get("addEstado")

  const addTrazabilidad =
    searchParams.get("addTrazabilidad")

  const addCuentaCobro =
    searchParams.get("addCuentaCobro")

  const addLogistica =
    searchParams.get("addLogistica")

  const addProgramacion =
    searchParams.get("addProgramacion")

  const addTramitador =
    searchParams.get("addTramitador")

  const addSubEstado =
    searchParams.get("addSubEstado")

  const evaluar =
    searchParams.get("evaluar")


  // =====================================================
  // IDENTIFICAR COMPONENTE
  // =====================================================

  const getComponentName = () => {

    if (evaluar)
      return "Evaluar"

    if (addEstado)
      return "AddEstado"

    if (addTrazabilidad)
      return "AddTrazabilidad"

    if (addCuentaCobro)
      return "AddCuentaCobro"

    if (addLogistica)
      return "AddLogistica"

    if (addProgramacion)
      return "AddProgramacion"

    if (addTramitador)
      return "AddTramitador"

    if (addSubEstado)
      return "AddSubEstado"

  }


  const componenteName =
    getComponentName()


  // =====================================================
  // CERRAR MODAL
  // =====================================================

  const closeModal = () => {

    const hideModal =
      new URLSearchParams(
        searchParams.toString()
      )


    Array
      .from(hideModal.entries())
      .forEach(([key]) => {

        hideModal.delete(key)

      })


    const query =
      hideModal.toString()


    router.replace(
      query
        ? `${pathname}?${query}`
        : pathname
    )

  }


  return (

    <Transition
      appear
      show={show}
      as={Fragment}
    >

      <Dialog
        as="div"
        className="relative z-50"
        onClose={
          componenteName === "Evaluar"
            ? () => {}
            : closeModal
        }
      >


        {/* ================================================= */}
        {/* OVERLAY                                           */}
        {/* ================================================= */}

        <TransitionChild
          as={Fragment}

          enter="
            ease-out
            duration-200
          "

          enterFrom="
            opacity-0
          "

          enterTo="
            opacity-100
          "

          leave="
            ease-in
            duration-150
          "

          leaveFrom="
            opacity-100
          "

          leaveTo="
            opacity-0
          "
        >

          <div className="
            fixed
            inset-0
            bg-slate-900/40
            backdrop-blur-[1px]
          " />

        </TransitionChild>



        {/* ================================================= */}
        {/* CONTENEDOR DEL MODAL                              */}
        {/* ================================================= */}

        <div className="
          fixed
          inset-0
          overflow-y-auto
        ">


          <div className="
            flex
            min-h-full
            items-center
            justify-center
            p-4
            sm:p-6
          ">


            {/* ============================================= */}
            {/* ANIMACIÓN DEL PANEL                           */}
            {/* ============================================= */}

            <TransitionChild
              as={Fragment}

              enter="
                ease-out
                duration-200
              "

              enterFrom="
                opacity-0
                translate-y-2
                scale-[0.98]
              "

              enterTo="
                opacity-100
                translate-y-0
                scale-100
              "

              leave="
                ease-in
                duration-150
              "

              leaveFrom="
                opacity-100
                translate-y-0
                scale-100
              "

              leaveTo="
                opacity-0
                translate-y-2
                scale-[0.98]
              "
            >

              <DialogPanel
                className="
                  w-full
                  max-w-4xl
                  overflow-hidden
                  rounded-xl
                  bg-white
                  border
                  border-slate-200
                  shadow-xl
                  text-left
                  text-xs
                  text-slate-600
                "
              >


                {/* ======================================= */}
                {/* CONTENIDO                               */}
                {/* ======================================= */}

                <div className="
                  p-5
                  sm:p-6
                ">


                  {/* ===================================== */}
                  {/* ESTADO                                */}
                  {/* ===================================== */}

                  {componenteName === "AddEstado" && (

                    <AddEstadosForm
                      closeModal={closeModal}
                    />

                  )}



                  {/* ===================================== */}
                  {/* TRAZABILIDAD                           */}
                  {/* ===================================== */}

                  {componenteName === "AddTrazabilidad" && (

                    <AddTrazabilidadForm
                      closeModal={closeModal}
                    />

                  )}



                  {/* ===================================== */}
                  {/* CUENTA DE COBRO                       */}
                  {/* ===================================== */}

                  {componenteName === "AddCuentaCobro" && (

                    <AddCuentaCobroForm
                      closeModal={closeModal}
                      cuentaCobro={
                        solicitudTramite.cuentaCobro
                      }
                    />

                  )}



                  {/* ===================================== */}
                  {/* LOGÍSTICA                              */}
                  {/* ===================================== */}

                  {componenteName === "AddLogistica" && (

                    <AddLogisticaForm
                      closeModal={closeModal}
                      logistica={
                        solicitudTramite.logistica
                      }
                    />

                  )}



                  {/* ===================================== */}
                  {/* PROGRAMACIÓN                            */}
                  {/* ===================================== */}

                  {componenteName === "AddProgramacion" && (

                    <AddProgramacionForm
                      closeModal={closeModal}
                      programacion={
                        solicitudTramite.programacion
                      }
                    />

                  )}



                  {/* ===================================== */}
                  {/* TRAMITADOR                              */}
                  {/* ===================================== */}

                  {componenteName === "AddTramitador" && (

                    <AddTramitadorForm
                      closeModal={closeModal}
                      tramitador={
                        solicitudTramite.tramitador
                      }
                    />

                  )}



                  {/* ===================================== */}
                  {/* EVALUACIÓN                              */}
                  {/* ===================================== */}

                  {componenteName === "Evaluar" && (

                    <EvaluacionModal
                      closeModal={closeModal}
                      solicitudId={
                        solicitudTramite.id
                      }
                    />

                  )}



                  {/* ===================================== */}
                  {/* SUBESTADO                               */}
                  {/* ===================================== */}

                  {componenteName === "AddSubEstado" && (

                    <AddSubEstadoForm
                      closeModal={closeModal}
                      tramiteId={
                        solicitudTramite.tramiteId
                      }
                      solicitudTramiteId={
                        solicitudTramite.id
                      }
                    />

                  )}


                </div>


              </DialogPanel>

            </TransitionChild>


          </div>

        </div>

      </Dialog>

    </Transition>

  )
}