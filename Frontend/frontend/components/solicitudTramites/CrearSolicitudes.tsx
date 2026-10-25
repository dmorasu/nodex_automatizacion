"use client"

import { useActionState, useEffect, useState } from "react"
import { toast } from "react-toastify"
import { useRouter } from "next/navigation"

import { crearSolicitud } from "@/actions/crear-Solicitud-action"

import { Usuario } from "@/src/schemas"

import SolicitudTramitesForm
  from "./SolicitudTramitesForm"

import {
  FilePlus2
} from "lucide-react"
import { conservarCampos } from "@/src/lib/formularios"
import { subirDocumentosTramite } from "@/src/lib/documentosTramite"


export default function CrearSolicitudesForm({
  usuario
}: {
  usuario?: Usuario
}) {

  const router = useRouter()


  // =====================================================
  // ESTADO DEL FORMULARIO
  // =====================================================

  const [state, dispatch] =
    useActionState(
      crearSolicitud,
      {
        errors: [],
        success: "",
        solicitudId: undefined
      }
    )


  // =====================================================
  // BLOQUEAR DOBLE ENVÍO
  // =====================================================

  const [isSubmitting, setIsSubmitting] =
    useState(false)

  // Documentos elegidos al crear: se suben apenas el backend crea el trámite
  const [documentos, setDocumentos] =
    useState<File[]>([])


  // =====================================================
  // RESPUESTAS
  // =====================================================

  useEffect(() => {

    // ===================================================
    // ERRORES
    // ===================================================

    if (state.errors?.length > 0) {

      state.errors.forEach(
        error => {

          toast.error(error)

        }
      )

      // Si hubo error permitimos intentar nuevamente
      setIsSubmitting(false)

    }


    // ===================================================
    // SOLICITUD CREADA
    // ===================================================

    if (state.success) {

      const solicitudId = state.solicitudId
      const irAlTramite = () => {
        router.push(solicitudId ? `/center/solicitudTramites/${solicitudId}` : "/center/dashboard")
        router.refresh()
      }

      // El trámite ya quedó creado: los documentos elegidos se suben ahora. Si fallan,
      // se avisa y se abre el detalle, donde se pueden volver a subir.
      const subirDocumentos = solicitudId && documentos.length > 0
        ? subirDocumentosTramite(solicitudId, documentos).then(
          () => true,
          (error: Error) => {
            toast.error(`El trámite se creó, pero no se subieron los documentos: ${error.message}`)
            return false
          })
        : Promise.resolve(true)

      subirDocumentos.then(() => {
        toast.success(state.success, { autoClose: 320, onClose: irAlTramite, onClick: irAlTramite })
      })

    }

    // Solo cuando responde la acción (los documentos se leen del último render)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, router])


  return (

    <form
      className="
        w-full
        space-y-5
      "
      noValidate

      action={dispatch}

      onReset={conservarCampos}

      onSubmit={(e) => {

        // =================================================
        // EVITAR DOBLE SUBMIT
        // =================================================

        if (isSubmitting) {

          e.preventDefault()

          return

        }


        // =================================================
        // BLOQUEAR INMEDIATAMENTE
        // =================================================

        setIsSubmitting(true)

      }}
    >


      {/* ================================================= */}
      {/* INFORMACIÓN DE LA SOLICITUD                       */}
      {/* ================================================= */}

      <div
        className="
          bg-slate-50
          border
          border-slate-200
          rounded-xl
          p-4
        "
      >


        <div
          className="
            flex
            items-center
            gap-2
            mb-4
          "
        >


          <div
            className="
              flex
              items-center
              justify-center
              w-8
              h-8
              rounded-lg
              bg-white
              border
              border-sky-100
            "
          >

            <FilePlus2
              size={15}
              className="
                text-sky-500
              "
            />

          </div>


          <div>

            <p
              className="
                text-xs
                font-semibold
                text-slate-700
              "
            >

              Información de la solicitud

            </p>


            <p
              className="
                mt-0.5
                text-xs
                text-slate-400
              "
            >

              Complete la información requerida para crear el trámite.

            </p>

          </div>

        </div>


        {/* ================================================= */}
        {/* FORMULARIO                                       */}
        {/* ================================================= */}

        <SolicitudTramitesForm
          documentos={documentos}
          onDocumentos={setDocumentos}
        />

      </div>


      {/* ================================================= */}
      {/* USUARIO                                          */}
      {/* ================================================= */}

      <input
        type="hidden"
        id="usuarioId"
        name="usuarioId"
        defaultValue={usuario?.id}
      />


      {/* ================================================= */}
      {/* CREAR SOLICITUD                                   */}
      {/* ================================================= */}

      <button
        type="submit"

        disabled={isSubmitting}

        className={`
          w-full
          h-10
          flex
          items-center
          justify-center
          gap-2
          rounded-lg
          text-xs
          font-semibold
          border
          transition-all
          duration-200
          focus:outline-none
          focus:ring-2
          focus:ring-sky-100

          ${
            isSubmitting
              ? `
                bg-slate-100
                text-slate-400
                border-slate-200
                cursor-not-allowed
                opacity-70
              `
              : `
                bg-sky-50
                text-sky-600
                border-sky-200
                hover:bg-sky-500
                hover:text-white
                hover:border-sky-500
                active:scale-[0.99]
              `
          }
        `}
      >

        <FilePlus2
          size={15}
        />

        {isSubmitting
          ? "Creando solicitud..."
          : "Crear Solicitud"
        }

      </button>


    </form>

  )

}