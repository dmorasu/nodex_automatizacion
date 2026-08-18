import Link from "next/link";
import { Metadata } from "next";

import {
  ArrowLeft,
  FilePlus2,
  UserPlus,
} from "lucide-react";

import CrearClientesForm
  from "@/components/clientes/crearCliente";


export const metadata: Metadata = {
  title: "Nodex - Nuevo Cliente",
  description: "Nodex - Creación de nuevo cliente",
};


export default function CrearClientesPage() {

  return (

    <div className="
      w-full
      space-y-6
    ">


      {/* ===================================================== */}
      {/* ENCABEZADO                                            */}
      {/* ===================================================== */}

      <div className="
        flex
        flex-col
        sm:flex-row
        sm:items-center
        sm:justify-between
        gap-4
      ">


        {/* ================================================= */}
        {/* TÍTULO                                             */}
        {/* ================================================= */}

        <div>

          <div className="
            flex
            items-center
            gap-2
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

              <UserPlus
                size={18}
                className="text-sky-500"
              />

            </div>


            <h1 className="
              text-xs
              font-semibold
              text-slate-800
            ">

              Nuevo Cliente

            </h1>

          </div>


          <p className="
            mt-1
            ml-11
            text-xs
            text-slate-400
          ">

            Complete el formulario para registrar un nuevo cliente.

          </p>

        </div>



        {/* ================================================= */}
        {/* ACCIONES                                           */}
        {/* ================================================= */}

        <div className="
          flex
          items-center
          gap-2
        ">


          {/* =============================================== */}
          {/* CREAR TRÁMITE                                   */}
          {/* =============================================== */}

          <Link
            href="/center/solicitudTramites/nueva"
            className="
              inline-flex
              items-center
              justify-center
              gap-2
              h-9
              px-3
              rounded-md
              bg-sky-500
              text-white
              text-xs
              font-medium
              transition
              hover:bg-sky-600
              focus:outline-none
              focus:ring-2
              focus:ring-sky-200
            "
          >

            <FilePlus2
              size={14}
            />

            Crear Trámite

          </Link>



          {/* =============================================== */}
          {/* VOLVER                                           */}
          {/* =============================================== */}

          <Link
            href="/center"
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
              text-slate-500
              text-xs
              font-medium
              transition
              hover:bg-slate-50
              hover:text-slate-700
              hover:border-slate-300
            "
          >

            <ArrowLeft
              size={14}
            />

            Volver

          </Link>

        </div>

      </div>



      {/* ===================================================== */}
      {/* FORMULARIO                                            */}
      {/* ===================================================== */}

      <div className="
        bg-white
        border
        border-slate-200
        rounded-xl
        p-5
      ">


        {/* ================================================= */}
        {/* ENCABEZADO DEL FORMULARIO                         */}
        {/* ================================================= */}

        <div className="
          flex
          items-center
          gap-2
          mb-5
        ">

          <div className="
            flex
            items-center
            justify-center
            w-8
            h-8
            rounded-lg
            bg-sky-50
            border
            border-sky-100
          ">

            <UserPlus
              size={15}
              className="text-sky-500"
            />

          </div>


          <div>

            <h2 className="
              text-xs
              font-semibold
              text-slate-700
            ">

              Información del cliente

            </h2>


            <p className="
              mt-0.5
              text-xs
              text-slate-400
            ">

              Registre la información requerida para crear el cliente.

            </p>

          </div>

        </div>



        {/* ================================================= */}
        {/* FORMULARIO EXISTENTE                              */}
        {/* ================================================= */}

        <CrearClientesForm />

      </div>

    </div>

  );
}