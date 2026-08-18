import EditarSolicitudTramiteForm
  from "@/components/solicitudTramites/EditarSolicitudTramiteForm"

import {
  verificacionSesion
} from "@/src/auth/dal"

import {
  SolicitudAPIRespuestaSchema
} from "@/src/schemas"

import Link from "next/link"

import {
  ArrowLeft,
  FilePenLine,
  UserRound
} from "lucide-react"



const getSolicitudTramites = async (
  solicitudTramiteId: string
) => {

  const url =
    `${process.env.API_URL}/solicitudTramites/${solicitudTramiteId}`

  const req =
    await fetch(
      url,
      {
        cache: "no-store"
      }
    )

  const json =
    await req.json()

  const solicitud =
    SolicitudAPIRespuestaSchema.parse(
      json
    )

  return solicitud
}



// =====================================================
// PÁGINA
// =====================================================

export default async function EditarSolicitudTramitePage({
  params
}: {
  params: {
    id: string
  }
}) {

  const id =
    params.id


  const solicitud =
    await getSolicitudTramites(id)


  const {
    usuario
  } =
    await verificacionSesion()



  return (

    <>

      {/* ================================================= */}
      {/* ENCABEZADO                                       */}
      {/* ================================================= */}

      <div className="
        flex
        flex-col
        gap-4

        md:flex-row
        md:items-center
        md:justify-between

        mb-6
      ">


        {/* =============================================== */}
        {/* TÍTULO                                          */}
        {/* =============================================== */}

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

              w-8
              h-8

              rounded-lg

              bg-sky-50
              border
              border-sky-100
            ">

              <FilePenLine
                size={16}
                className="
                  text-sky-500
                "
              />

            </div>


            <h1 className="
              text-base
              font-semibold
              text-slate-800
            ">

              Editar Solicitud #{solicitud.id}

            </h1>

          </div>



          {/* ============================================= */}
          {/* DESCRIPCIÓN                                   */}
          {/* ============================================= */}

          <div className="
            flex
            items-center
            gap-2
            mt-2
            ml-10
          ">

            <UserRound
              size={13}
              className="
                text-slate-400
              "
            />

            <p className="
              text-xs
              text-slate-400
            ">

              Modifica la información de la solicitud de{" "}

              <span className="
                font-medium
                text-sky-500
              ">

                {solicitud.clientes?.nombreCliente
                  ?? "Cliente"}

              </span>

            </p>

          </div>

        </div>



        {/* =============================================== */}
        {/* VOLVER                                          */}
        {/* =============================================== */}

        <Link
          href="/center"
          className="
            h-9
            px-4

            flex
            items-center
            justify-center
            gap-2

            rounded-md

            bg-white
            border
            border-slate-200

            text-slate-600
            text-xs
            font-medium

            transition

            hover:bg-slate-50
            hover:border-slate-300
            hover:text-sky-600

            focus:outline-none
            focus:ring-2
            focus:ring-sky-100
          "
        >

          <ArrowLeft
            size={14}
          />

          Volver

        </Link>

      </div>



      {/* ================================================= */}
      {/* FORMULARIO                                       */}
      {/* ================================================= */}

      <div className="
        bg-white

        border
        border-slate-200

        rounded-xl

        shadow-sm

        p-5
        sm:p-6

        mt-5
      ">

        {/* =============================================== */}
        {/* CABECERA DEL FORMULARIO                        */}
        {/* =============================================== */}

        <div className="
          flex
          items-center
          gap-3

          pb-4
          mb-5

          border-b
          border-slate-100
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

            <FilePenLine
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

              Actualiza los datos registrados del trámite.

            </p>

          </div>

        </div>



        {/* =============================================== */}
        {/* FORMULARIO                                     */}
        {/* =============================================== */}

        <EditarSolicitudTramiteForm
          solicitud={solicitud}
          usuario={usuario}
        />

      </div>

    </>

  )
}