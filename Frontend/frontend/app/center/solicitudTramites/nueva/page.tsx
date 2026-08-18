export const dynamic = "force-dynamic"

import CrearSolicitudesForm
  from "@/components/solicitudTramites/CrearSolicitudes"

import Link from "next/link"

import { Metadata } from "next"

import {
  ArrowLeft,
  FilePlus2,
} from "lucide-react"

import { verificacionSesion }
  from "@/src/auth/dal"


export const metadata: Metadata = {
  title: "Nodex - Nuevo Trámite",
  description: "Nodex - Creación de nuevo trámite"
}


export default async function CrearSolicitudesPage() {

  // =====================================================
  // SESIÓN
  // =====================================================

  const { usuario } =
    await verificacionSesion()


  return (

    <div className="
      w-full
      space-y-6
    ">


      {/* ================================================= */}
      {/* ENCABEZADO                                        */}
      {/* ================================================= */}

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

              <FilePlus2
                size={18}
                className="
                  text-sky-500
                "
              />

            </div>


            <h1 className="
              text-xs
              font-semibold
              text-slate-800
            ">

              Nuevo Trámite

            </h1>

          </div>


          <p className="
            mt-1
            ml-11
            text-xs
            text-slate-400
          ">

            Complete la información para registrar una nueva solicitud de trámite.

          </p>

        </div>



        {/* ================================================= */}
        {/* VOLVER                                             */}
        {/* ================================================= */}

        <Link
          href="/center/dashboard"
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
            focus:outline-none
            focus:ring-2
            focus:ring-slate-100
          "
        >

          <ArrowLeft
            size={14}
          />

          Volver

        </Link>

      </div>



      {/* ================================================= */}
      {/* FORMULARIO                                        */}
      {/* ================================================= */}

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

            <FilePlus2
              size={15}
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

              Información de la solicitud

            </h2>


            <p className="
              mt-0.5
              text-xs
              text-slate-400
            ">

              Registre los datos asociados al nuevo trámite.

            </p>

          </div>

        </div>



        {/* ================================================= */}
        {/* FORMULARIO                                        */}
        {/* ================================================= */}

        <CrearSolicitudesForm
          usuario={usuario}
        />

      </div>

    </div>

  )
}