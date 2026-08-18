"use client";

import { DialogTitle } from "@headlessui/react";
import EstadosComboBox from "./EstadosCombobox";
import CrearEstadoTramite from "@/actions/crear-estatoTramite";
import { useFormState } from "react-dom";
import { useParams, useRouter } from "next/navigation";
import ErrorMessage from "../ui/ErrorMessage";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useTiposRechazo } from "@/hooks/useTiposRechazos";
import { Flag } from "lucide-react";

export default function AddExpenseForm({
  closeModal,
}: {
  closeModal: () => void;
}) {

  const router = useRouter();
  const { id } = useParams();

  const [estadoSeleccionado, setEstadoSeleccionado] =
    useState<number>(0);

  const { data: tiposRechazo } =
    useTiposRechazo();

  const crearEstadoconId =
    CrearEstadoTramite.bind(null, +id);

  const [state, dispatch] =
    useFormState(crearEstadoconId, {
      errors: [],
      success: "",
      requiereEvaluacion: false,
    });


  // =====================================================
  // RESPUESTA
  // =====================================================

  useEffect(() => {

    if (state.success) {

      toast.success(state.success);

      if (state.requiereEvaluacion) {

        router.replace(
          `?evaluar=true&showModal=true`
        );

        return;
      }

      closeModal();

      router.refresh();
    }

  }, [state, closeModal, router]);


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

          <Flag
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
            Agregar Estado
          </DialogTitle>


          <p className="
            mt-1
            text-xs
            text-slate-400
          ">
            Seleccione el nuevo estado y, cuando corresponda,
            indique el motivo de subsanación.
          </p>

        </div>

      </div>



      {/* ================================================= */}
      {/* ERRORES                                           */}
      {/* ================================================= */}

      {state.errors.map((error) => (

        <ErrorMessage
          key={error}
        >
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
        {/* ESTADO                                          */}
        {/* =============================================== */}

        <div>

          <label className="
            block
            mb-1.5
            text-xs
            font-medium
            text-slate-600
          ">
            Estado
          </label>


          <EstadosComboBox
            name="estadoId"
            onChange={(id) =>
              setEstadoSeleccionado(id ?? 0)
            }
          />

        </div>



        {/* =============================================== */}
        {/* TIPO DE SUBSANACIÓN                             */}
        {/* =============================================== */}

        {estadoSeleccionado === 3 && (

          <div>

            <label
              htmlFor="tipoRechazoId"
              className="
                block
                mb-1.5
                text-xs
                font-medium
                text-slate-600
              "
            >
              Tipo de Subsanación
            </label>


            <select
              id="tipoRechazoId"
              name="tipoRechazoId"
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
              required
            >

              <option value="">
                Seleccione un motivo de subsanación
              </option>


              {tiposRechazo?.map(
                (tipo: any) => (

                  <option
                    key={tipo.id}
                    value={tipo.id}
                  >
                    {tipo.nombre}
                  </option>

                )
              )}

            </select>

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
              min-w-[140px]
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
            Cambiar Estado
          </button>

        </div>

      </form>

    </>
  );
}