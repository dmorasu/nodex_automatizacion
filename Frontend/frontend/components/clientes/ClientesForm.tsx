"use client";

import { SolicitudTramites } from "@/src/schemas";


export default function ClientesForm({
  solicitud
}: {
  solicitud?: SolicitudTramites
}) {

  return (

    <div className="
      w-full
      space-y-4
    ">


      {/* ================================================= */}
      {/* NOMBRE COMPLETO                                   */}
      {/* ================================================= */}

      <div className="
        space-y-1.5
      ">

        <label
          htmlFor="nombreCliente"
          className="
            block
            text-xs
            font-medium
            text-slate-600
          "
        >

          Nombre completo del cliente

        </label>


        <input
          type="text"
          id="nombreCliente"
          name="nombreCliente"
          placeholder="Nombre completo del cliente"
          defaultValue={
            solicitud?.direccionTramite
          }
          className="
            w-full
            h-10
            px-3
            text-xs
            text-slate-700
            bg-white
            border
            border-slate-200
            rounded-md
            outline-none
            transition
            placeholder:text-slate-300
            focus:border-sky-400
            focus:ring-2
            focus:ring-sky-100
          "
        />

      </div>



      {/* ================================================= */}
      {/* IDENTIFICACIÓN                                    */}
      {/* ================================================= */}

      <div className="
        space-y-1.5
      ">

        <label
          htmlFor="identificacionCliente"
          className="
            block
            text-xs
            font-medium
            text-slate-600
          "
        >

          Identificación

        </label>


        <input
          type="text"
          id="identificacionCliente"
          name="identificacionCliente"
          placeholder="Número de identificación"
          defaultValue={
            solicitud?.direccionTramite
          }
          className="
            w-full
            h-10
            px-3
            text-xs
            text-slate-700
            bg-white
            border
            border-slate-200
            rounded-md
            outline-none
            transition
            placeholder:text-slate-300
            focus:border-sky-400
            focus:ring-2
            focus:ring-sky-100
          "
        />

      </div>



      {/* ================================================= */}
      {/* TELÉFONO FIJO                                     */}
      {/* ================================================= */}

      <div className="
        space-y-1.5
      ">

        <label
          htmlFor="telefono"
          className="
            block
            text-xs
            font-medium
            text-slate-600
          "
        >

          Teléfono

        </label>


        <input
          type="text"
          id="telefono"
          name="telefono"
          placeholder="Teléfono fijo"
          defaultValue={
            solicitud?.direccionTramite
          }
          className="
            w-full
            h-10
            px-3
            text-xs
            text-slate-700
            bg-white
            border
            border-slate-200
            rounded-md
            outline-none
            transition
            placeholder:text-slate-300
            focus:border-sky-400
            focus:ring-2
            focus:ring-sky-100
          "
        />

      </div>



      {/* ================================================= */}
      {/* TELÉFONO MÓVIL                                    */}
      {/* ================================================= */}

      <div className="
        space-y-1.5
      ">

        <label
          htmlFor="telefonoMovil"
          className="
            block
            text-xs
            font-medium
            text-slate-600
          "
        >

          Teléfono móvil

        </label>


        <input
          type="text"
          id="telefonoMovil"
          name="telefonoMovil"
          placeholder="Número de teléfono móvil"
          defaultValue={
            solicitud?.direccionTramite
          }
          className="
            w-full
            h-10
            px-3
            text-xs
            text-slate-700
            bg-white
            border
            border-slate-200
            rounded-md
            outline-none
            transition
            placeholder:text-slate-300
            focus:border-sky-400
            focus:ring-2
            focus:ring-sky-100
          "
        />

      </div>

    </div>

  );
}