"use client"

import { DialogTitle } from "@headlessui/react"
import { useState, useEffect } from "react"
import { useFormState } from "react-dom"
import { useParams } from "next/navigation"
import { Calendar } from "lucide-react"
import { toast } from "react-toastify"

import ErrorMessage from "../ui/ErrorMessage"

import CrearProgramacion from "@/actions/crear-Programacion-action"
import { toDateInput } from "@/src/ultis"
import { ProgramacionType } from "@/src/type/solicitudes"


export default function AddProgramacionForm({
  closeModal,
  programacion
}: {
  closeModal: () => void
  programacion?: ProgramacionType | null
}) {

  const { id } = useParams()


  // =====================================================
  // REQUIERE CITA
  // =====================================================

  const [requiereCita, setRequiereCita] = useState(
    programacion?.requiereCita ?? false
  )


  // =====================================================
  // ACTION
  // =====================================================

  const crearProgramacionId =
    CrearProgramacion.bind(null, +id)


  const [state, dispatch] =
    useFormState(crearProgramacionId, {
      errors: [],
      success: ""
    })


  // =====================================================
  // RESPUESTA
  // =====================================================

  useEffect(() => {

    if (state.success) {

      toast.success(state.success)

      closeModal()

    }

  }, [state, closeModal])


  return (
    <>

      {/* ================================================= */}
      {/* ENCABEZADO                                       */}
      {/* ================================================= */}

      <div className="
        flex
        items-center
        gap-3
        mb-6
      ">


        {/* ICONO */}

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
          shrink-0
        ">

          <Calendar
            size={18}
            className="text-sky-500"
          />

        </div>


        {/* TÍTULO */}

        <div>

          <DialogTitle
            as="h3"
            className="
              text-lg
              font-semibold
              text-slate-800
              leading-tight
            "
          >
            Programación
          </DialogTitle>


          <p className="
            mt-1
            text-xs
            text-slate-400
          ">
            Configure las fechas, valores y condiciones del trámite.
          </p>

        </div>

      </div>



      {/* ================================================= */}
      {/* ERRORES                                           */}
      {/* ================================================= */}

      {state.errors.map(error => (

        <ErrorMessage key={error}>
          {error}
        </ErrorMessage>

      ))}



      {/* ================================================= */}
      {/* FORMULARIO                                        */}
      {/* ================================================= */}

      <form
        className="
          space-y-5
        "
        noValidate
        action={dispatch}
      >


        {/* =============================================== */}
        {/* FECHA PROBABLE DE ENTREGA                       */}
        {/* =============================================== */}

        <div>

          <label
            htmlFor="fechaProbableEntrega"
            className="
              block
              mb-1.5
              text-xs
              font-medium
              text-slate-600
            "
          >
            Fecha en que se realizará el trámite
          </label>


          <input
            id="fechaProbableEntrega"
            type="date"
            name="fechaProbableEntrega"
            className="
              w-full
              h-10
              px-3
              rounded-md
              border
              border-slate-200
              bg-slate-50
              text-xs
              text-slate-700
              outline-none
              transition
              focus:bg-white
              focus:border-sky-400
              focus:ring-2
              focus:ring-sky-100
            "
            defaultValue={toDateInput(
              programacion?.fechaProbableEntrega ?? ""
            )}
          />

        </div>



        {/* =============================================== */}
        {/* VALOR DEL TRÁMITE                               */}
        {/* =============================================== */}

        <div>

          <label
            htmlFor="valorTramite"
            className="
              block
              mb-1.5
              text-xs
              font-medium
              text-slate-600
            "
          >
            Valor del Trámite
          </label>


          <input
            id="valorTramite"
            type="number"
            step={0.01}
            min={0}
            name="valorTramite"
            className="
              w-full
              h-10
              px-3
              rounded-md
              border
              border-slate-200
              bg-slate-50
              text-xs
              text-slate-700
              outline-none
              transition
              focus:bg-white
              focus:border-sky-400
              focus:ring-2
              focus:ring-sky-100
            "
            defaultValue={
              programacion?.valorTramite
                ? parseInt(programacion.valorTramite)
                : ""
            }
          />

        </div>



        {/* =============================================== */}
        {/* CONCEPTO HONORARIOS                             */}
        {/* =============================================== */}

        <div>

          <label
            htmlFor="conceptoHonorarios"
            className="
              block
              mb-1.5
              text-xs
              font-medium
              text-slate-600
            "
          >
            Concepto de Honorarios
          </label>


          <input
            id="conceptoHonorarios"
            type="text"
            name="conceptoHonorarios"
            className="
              w-full
              h-10
              px-3
              rounded-md
              border
              border-slate-200
              bg-slate-50
              text-xs
              text-slate-700
              outline-none
              transition
              focus:bg-white
              focus:border-sky-400
              focus:ring-2
              focus:ring-sky-100
            "
            defaultValue={
              programacion?.conceptoHonorarios ?? ""
            }
          />

        </div>



        {/* =============================================== */}
        {/* VALOR VIÁTICOS                                  */}
        {/* =============================================== */}

        <div>

          <label
            htmlFor="valorViaticos"
            className="
              block
              mb-1.5
              text-xs
              font-medium
              text-slate-600
            "
          >
            Valor de los Viáticos
          </label>


          <input
            id="valorViaticos"
            type="number"
            step={0.01}
            min={0}
            name="valorViaticos"
            className="
              w-full
              h-10
              px-3
              rounded-md
              border
              border-slate-200
              bg-slate-50
              text-xs
              text-slate-700
              outline-none
              transition
              focus:bg-white
              focus:border-sky-400
              focus:ring-2
              focus:ring-sky-100
            "
            defaultValue={
              programacion?.valorViaticos ?? ""
            }
          />

        </div>



        {/* =============================================== */}
        {/* CONCEPTO VIÁTICOS                               */}
        {/* =============================================== */}

        <div>

          <label
            htmlFor="conceptoViaticos"
            className="
              block
              mb-1.5
              text-xs
              font-medium
              text-slate-600
            "
          >
            Concepto de Viáticos
          </label>


          <input
            id="conceptoViaticos"
            type="text"
            name="conceptoViaticos"
            className="
              w-full
              h-10
              px-3
              rounded-md
              border
              border-slate-200
              bg-slate-50
              text-xs
              text-slate-700
              outline-none
              transition
              focus:bg-white
              focus:border-sky-400
              focus:ring-2
              focus:ring-sky-100
            "
            defaultValue={
              programacion?.conceptoViaticos ?? ""
            }
          />

        </div>



        {/* =============================================== */}
        {/* REQUIERE CITA                                   */}
        {/* =============================================== */}

        <div className="
          rounded-lg
          border
          border-slate-200
          bg-slate-50
          px-4
          py-3
        ">

          <label className="
            flex
            items-center
            gap-3
            cursor-pointer
          ">

            <input
              type="checkbox"
              checked={requiereCita}
              onChange={(e) =>
                setRequiereCita(e.target.checked)
              }
              className="
                h-4
                w-4
                rounded
                border-slate-300
                text-sky-500
                focus:ring-sky-200
              "
            />

            <span className="
              text-xs
              font-medium
              text-slate-700
            ">
              Requiere Cita
            </span>

          </label>


          <input
            type="hidden"
            name="requiereCita"
            value={
              requiereCita
                ? "true"
                : "false"
            }
          />

        </div>



        {/* ================================================= */}
        {/* CAMPOS DE CITA                                    */}
        {/* ================================================= */}

        {requiereCita && (

          <div className="
            grid
            grid-cols-1
            sm:grid-cols-2
            gap-4
            pt-1
          ">


            {/* ============================================= */}
            {/* FECHA CITA                                    */}
            {/* ============================================= */}

            <div>

              <label
                htmlFor="fechaCita"
                className="
                  block
                  mb-1.5
                  text-xs
                  font-medium
                  text-slate-600
                "
              >
                Fecha de la Cita
              </label>


              <input
                id="fechaCita"
                type="date"
                name="fechaCita"
                className="
                  w-full
                  h-10
                  px-3
                  rounded-md
                  border
                  border-slate-200
                  bg-slate-50
                  text-xs
                  text-slate-700
                  outline-none
                  transition
                  focus:bg-white
                  focus:border-sky-400
                  focus:ring-2
                  focus:ring-sky-100
                "
                defaultValue={
                  programacion?.fechaCita
                    ? toDateInput(
                        programacion.fechaCita
                      )
                    : ""
                }
              />

            </div>



            {/* ============================================= */}
            {/* HORA CITA                                     */}
            {/* ============================================= */}

            <div>

              <label
                htmlFor="horaCita"
                className="
                  block
                  mb-1.5
                  text-xs
                  font-medium
                  text-slate-600
                "
              >
                Hora de la Cita
              </label>


              <input
                id="horaCita"
                type="time"
                name="horaCita"
                className="
                  w-full
                  h-10
                  px-3
                  rounded-md
                  border
                  border-slate-200
                  bg-slate-50
                  text-xs
                  text-slate-700
                  outline-none
                  transition
                  focus:bg-white
                  focus:border-sky-400
                  focus:ring-2
                  focus:ring-sky-100
                "
                defaultValue={
                  programacion?.horaCita ?? ""
                }
              />

            </div>

          </div>

        )}



        {/* ================================================= */}
        {/* BOTÓN                                             */}
        {/* ================================================= */}

        <div className="
          flex
          justify-end
          pt-2
        ">

          <button
            type="submit"
            className="
              inline-flex
              items-center
              justify-center
              h-9
              min-w-[120px]
              px-4
              rounded-md
              bg-sky-500
              text-white
              text-xs
              font-medium
              transition-all
              hover:bg-sky-600
              focus:outline-none
              focus:ring-2
              focus:ring-sky-200
              cursor-pointer
            "
          >
            Agregar
          </button>

        </div>


      </form>

    </>
  )
}