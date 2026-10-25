"use client";

import { DialogTitle } from "@headlessui/react";
import EstadosComboBox from "./EstadosCombobox";
import CrearEstadoTramite from "@/actions/crear-estatoTramite";
import { useParams, usePathname, useRouter } from "next/navigation";
import AvisarErrores from "../ui/AvisarErrores";
import { useActionState, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useTiposRechazo } from "@/hooks/useTiposRechazos";
import { Flag } from "lucide-react";
import SelectBuscable from "@/components/ui/SelectBuscable"
import { conservarCampos } from "@/src/lib/formularios"
import { cambiarModal } from "@/src/lib/modalesDetalle"

export default function AddExpenseForm({
  closeModal,
}: {
  closeModal: () => void;
}) {

  const router = useRouter();
  const pathname = usePathname();
  const { id } = useParams<{ id: string }>();

  const [estadoSeleccionado, setEstadoSeleccionado] =
    useState<number>(0);

  const { data: tiposRechazo } =
    useTiposRechazo();

  // Hoy en Colombia (YYYY-MM-DD): la nueva fecha de entrega no puede ser anterior
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());

  const crearEstadoconId =
    CrearEstadoTramite.bind(null, +id);

  const [state, dispatch] =
    useActionState(crearEstadoconId, {
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

        cambiarModal(pathname, "evaluar");

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

      <AvisarErrores errores={state.errors} />



      {/* ================================================= */}
      {/* FORMULARIO                                        */}
      {/* ================================================= */}

      <form
        className="
          space-y-5
        "
        noValidate
        action={dispatch}
        onReset={conservarCampos}
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


            <SelectBuscable
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
            >

              <option value="">
                Seleccione un motivo de subsanación
              </option>


              {tiposRechazo?.map(
                (tipo) => (

                  <option
                    key={tipo.id}
                    value={tipo.id}
                  >
                    {tipo.nombre}
                  </option>

                )
              )}

            </SelectBuscable>

          </div>

        )}



        {/* =============================================== */}
        {/* NUEVA FECHA DE ENTREGA (NOVEDAD SUBSANADA)      */}
        {/* La anterior queda en el historial del trámite   */}
        {/* =============================================== */}

        {estadoSeleccionado === 4 && (
          <div>
            <label htmlFor="fechaEntregaResultado" className="block mb-1.5 text-xs font-medium text-slate-600">
              Nueva fecha de entrega del resultado <span className="text-red-400">*</span>
            </label>
            <input
              id="fechaEntregaResultado"
              name="fechaEntregaResultado"
              type="date"
              min={hoy}
              className="w-full h-10 px-3 rounded-md border border-slate-200 bg-slate-50 text-xs text-slate-700 outline-none transition focus:bg-white focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            />
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