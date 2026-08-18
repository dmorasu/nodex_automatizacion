"use client"

import Link from "next/link"
import { useState } from "react"
import {
  useRouter,
  useSearchParams
} from "next/navigation"

import {
  Search,
  Plus,
  MapPin,
  User,
  BriefcaseBusiness,
  CalendarDays,
  Clock3,
  UserRound,
  FileText,
  CircleDot,
  ChevronLeft,
  ChevronRight,
  ClipboardList
} from "lucide-react"

import SolicitudTramiteMenu
  from "@/components/solicitudTramites/MenuSolicitudTramites"

import {
  formatoFecha,
  formatoFechaFinaizacion
} from "@/src/ultis"

import {
  SolicitudTramites
} from "@/src/schemas"

import EliminarSolicitudTramiteModal
  from "./EliminarSolicitudTramiteModal"

import clsx from "clsx"



interface Props {
  solicitudes: SolicitudTramites[]
  currentPage: number
  totalPages: number
  searchInitial: string
}



export default function CenterPageClient({
  solicitudes,
  currentPage,
  totalPages,
  searchInitial
}: Props) {


  const router =
    useRouter()

  const params =
    useSearchParams()


  const [search, setSearch] =
    useState(searchInitial)



  // =====================================================
  // BUSCAR
  // =====================================================

  const ejecutarBusqueda = () => {

    const query =
      new URLSearchParams(
        params.toString()
      )

    if (search) {

      query.set(
        "search",
        search
      )

    } else {

      query.delete("search")

    }

    query.set(
      "page",
      "1"
    )

    router.push(
      `?${query.toString()}`
    )

  }



  // =====================================================
  // PAGINACIÓN
  // =====================================================

  const cambiarPagina =
    (page: number) => {

      if (
        page < 1 ||
        page > totalPages
      ) {
        return
      }

      const query =
        new URLSearchParams(
          params.toString()
        )

      query.set(
        "page",
        page.toString()
      )

      router.push(
        `?${query.toString()}`
      )

    }



  // =====================================================
  // ESTADO
  // =====================================================

  const obtenerEstado =
    (solicitud: SolicitudTramites) => {

      return (
        solicitud
          .estadosTramites
          ?.[0]
          ?.estado
          ?.nombreEstado
        ?? "Sin Iniciar"
      )

    }



  const estadoClasses = (
    estado: string
  ) => {

    return clsx(
      `
        inline-flex
        items-center
        gap-1.5
        px-2.5
        py-1
        rounded-md
        text-xs
        font-medium
        border
      `,
      {

        "bg-red-50 text-red-600 border-red-100":
          estado === "Sin Iniciar",

        "bg-amber-50 text-amber-600 border-amber-100":
          estado === "En Curso",

        "bg-green-50 text-green-600 border-green-100":
          estado === "Finalizado",

        "bg-sky-50 text-sky-600 border-sky-100":
          estado ===
          "Novedad Subsanada Continuar Trámite",

        "bg-orange-50 text-orange-600 border-orange-100":
          estado === "Desistido",

        "bg-violet-50 text-violet-600 border-violet-100":
          estado === "En espera por novedad",

        "bg-slate-50 text-slate-500 border-slate-200":
          ![
            "Sin Iniciar",
            "En Curso",
            "Finalizado",
            "Novedad Subsanada Continuar Trámite",
            "Desistido",
            "En espera por novedad"
          ].includes(estado)

      }
    )

  }



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

              <ClipboardList
                size={16}
                className="text-sky-500"
              />

            </div>


            <h1 className="
              text-base
              font-semibold
              text-slate-800
            ">

              Solicitudes de Trámite

            </h1>

          </div>


          <p className="
            mt-1
            ml-10
            text-xs
            text-slate-400
          ">

            Consulta y gestiona las solicitudes registradas.

          </p>

        </div>



        {/* ============================================= */}
        {/* CREAR TRÁMITE                                 */}
        {/* ============================================= */}

        <Link
          href="/center/solicitudTramites/nueva"
          className="
            h-9
            px-4
            flex
            items-center
            justify-center
            gap-2
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

          <Plus size={15} />

          Crear Trámite

        </Link>

      </div>



      {/* ================================================= */}
      {/* BUSCADOR                                         */}
      {/* ================================================= */}

      <div className="
        mb-5
        p-3
        bg-white
        border
        border-slate-200
        rounded-xl
        shadow-sm
      ">

        <div className="
          flex
          flex-col
          sm:flex-row
          gap-2
        ">


          <div className="
            relative
            flex-1
          ">

            <Search
              size={15}
              className="
                absolute
                left-3
                top-1/2
                -translate-y-1/2
                text-slate-400
              "
            />

            <input
              type="text"
              placeholder="Buscar por solicitud o identificación del cliente..."
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
              onKeyDown={(e) => {

                if (
                  e.key === "Enter"
                ) {
                  ejecutarBusqueda()
                }

              }}
              className="
                w-full
                h-9
                pl-9
                pr-3
                rounded-md
                border
                border-slate-200
                bg-slate-50
                text-xs
                text-slate-700

                outline-none

                transition

                placeholder:text-slate-400

                focus:bg-white
                focus:border-sky-400
                focus:ring-2
                focus:ring-sky-100
              "
            />

          </div>


          <button
            type="button"
            onClick={
              ejecutarBusqueda
            }
            className="
              h-9
              px-5
              flex
              items-center
              justify-center
              gap-2
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

            <Search size={14} />

            Buscar

          </button>

        </div>

      </div>



      {/* ================================================= */}
      {/* LISTADO                                           */}
      {/* ================================================= */}

      {solicitudes.length ? (

        <div className="
          space-y-3
        ">


          {solicitudes.map(
            (solicitud) => {

              const estado =
                obtenerEstado(
                  solicitud
                )


              return (

                <article
                  key={solicitud.id}
                  className="
                    bg-white
                    border
                    border-slate-200
                    rounded-xl
                    shadow-sm
                    overflow-hidden
                    transition

                    hover:border-sky-200
                    hover:shadow-md
                  "
                >


                  {/* ===================================== */}
                  {/* CABECERA                              */}
                  {/* ===================================== */}

                  <div className="
                    px-4
                    py-3
                    bg-slate-50
                    border-b
                    border-slate-100

                    flex
                    flex-col
                    gap-2

                    sm:flex-row
                    sm:items-center
                    sm:justify-between
                  ">


                    <Link
                      href={`/center/solicitudTramites/${solicitud.id}`}
                      className="
                        flex
                        items-center
                        gap-2
                        text-xs
                        font-semibold
                        text-slate-700
                        hover:text-sky-600
                        transition
                      "
                    >

                      <div className="
                        flex
                        items-center
                        justify-center
                        w-7
                        h-7
                        rounded-md
                        bg-white
                        border
                        border-slate-200
                      ">

                        <FileText
                          size={14}
                          className="text-sky-500"
                        />

                      </div>


                      Solicitud #{solicitud.id}

                    </Link>



                    <div className="
                      flex
                      items-center
                      gap-2
                    ">

                      <span className="
                        text-xs
                        text-slate-400
                      ">

                        Estado:

                      </span>


                      <span
                        className={
                          estadoClasses(
                            estado
                          )
                        }
                      >

                        <CircleDot
                          size={11}
                        />

                        {estado}

                      </span>

                    </div>

                  </div>



                  {/* ===================================== */}
                  {/* CONTENIDO                             */}
                  {/* ===================================== */}

                  <div className="
                    p-4
                  ">


                    {/* ================================= */}
                    {/* INFORMACIÓN PRINCIPAL             */}
                    {/* ================================= */}

                    <div className="
                      grid
                      grid-cols-1
                      md:grid-cols-2
                      xl:grid-cols-3
                      gap-x-6
                      gap-y-3
                    ">


                      {/* CLIENTE */}

                      <div className="
                        flex
                        items-start
                        gap-2
                      ">

                        <User
                          size={14}
                          className="
                            mt-0.5
                            shrink-0
                            text-sky-500
                          "
                        />

                        <div>

                          <p className="
                            text-xs
                            text-slate-400
                          ">

                            Cliente

                          </p>

                          <p className="
                            text-xs
                            font-medium
                            text-slate-700
                          ">

                            {
                              solicitud
                                .clientes
                                ?.nombreCliente
                              ?? "Sin cliente"
                            }

                          </p>

                        </div>

                      </div>



                      {/* MUNICIPIO */}

                      <div className="
                        flex
                        items-start
                        gap-2
                      ">

                        <MapPin
                          size={14}
                          className="
                            mt-0.5
                            shrink-0
                            text-sky-500
                          "
                        />

                        <div>

                          <p className="
                            text-xs
                            text-slate-400
                          ">

                            Municipio

                          </p>

                          <p className="
                            text-xs
                            font-medium
                            text-slate-700
                          ">

                            {
                              solicitud
                                .municipios
                                ?.nombreMunicipio
                              ?? "Sin municipio"
                            }

                          </p>

                        </div>

                      </div>



                      {/* OPERACIÓN */}

                      <div className="
                        flex
                        items-start
                        gap-2
                      ">

                        <BriefcaseBusiness
                          size={14}
                          className="
                            mt-0.5
                            shrink-0
                            text-sky-500
                          "
                        />

                        <div>

                          <p className="
                            text-xs
                            text-slate-400
                          ">

                            Operación

                          </p>

                          <p className="
                            text-xs
                            font-medium
                            text-slate-700
                          ">

                            {
                              solicitud
                                .operaciones
                                ?.nombreOperacion
                              ?? "Sin operación"
                            }

                          </p>

                        </div>

                      </div>



                      {/* ANALISTA */}

                      <div className="
                        flex
                        items-start
                        gap-2
                      ">

                        <UserRound
                          size={14}
                          className="
                            mt-0.5
                            shrink-0
                            text-sky-500
                          "
                        />

                        <div>

                          <p className="
                            text-xs
                            text-slate-400
                          ">

                            Analista

                          </p>

                          <p className="
                            text-xs
                            font-medium
                            text-slate-700
                          ">

                            {
                              solicitud
                                .tramite
                                ?.responsable
                              ?? "Sin analista asignado"
                            }

                          </p>

                        </div>

                      </div>



                      {/* FECHA RESULTADO */}

                      <div className="
                        flex
                        items-start
                        gap-2
                      ">

                        <CalendarDays
                          size={14}
                          className="
                            mt-0.5
                            shrink-0
                            text-sky-500
                          "
                        />

                        <div>

                          <p className="
                            text-xs
                            text-slate-400
                          ">

                            Fecha espera resultado

                          </p>

                          <p className="
                            text-xs
                            font-medium
                            text-slate-700
                          ">

                            {
                              formatoFecha(
                                solicitud
                                  .fechaEntregaResultado
                              )
                            }

                          </p>

                        </div>

                      </div>



                      {/* CREADO POR */}

                      <div className="
                        flex
                        items-start
                        gap-2
                      ">

                        <UserRound
                          size={14}
                          className="
                            mt-0.5
                            shrink-0
                            text-sky-500
                          "
                        />

                        <div>

                          <p className="
                            text-xs
                            text-slate-400
                          ">

                            Creado por

                          </p>

                          <p className="
                            text-xs
                            font-medium
                            text-slate-700
                          ">

                            {
                              solicitud
                                .usuario
                                ?.nombreUsuario
                              ?? "Sin información"
                            }

                          </p>

                        </div>

                      </div>

                    </div>



                    {/* ================================= */}
                    {/* DIRECCIÓN                           */}
                    {/* ================================= */}

                    <div className="
                      mt-4
                      pt-3
                      border-t
                      border-slate-100
                    ">

                      <div className="
                        flex
                        items-start
                        gap-2
                      ">

                        <MapPin
                          size={14}
                          className="
                            mt-0.5
                            shrink-0
                            text-slate-400
                          "
                        />

                        <div>

                          <p className="
                            text-xs
                            text-slate-400
                          ">

                            Dirección del trámite

                          </p>

                          <p className="
                            mt-0.5
                            text-xs
                            text-slate-600
                          ">

                            {
                              solicitud
                                .direccionTramite
                              ?? "Sin dirección"
                            }

                          </p>

                        </div>

                      </div>

                    </div>



                    {/* ================================= */}
                    {/* DETALLE                             */}
                    {/* ================================= */}

                    {solicitud.detalleSolicitud && (

                      <div className="
                        mt-3
                        p-3
                        rounded-lg
                        bg-slate-50
                        border
                        border-slate-100
                      ">

                        <p className="
                          text-xs
                          text-slate-400
                          mb-1
                        ">

                          Detalle de la solicitud

                        </p>

                        <p className="
                          text-xs
                          leading-5
                          text-slate-600
                        ">

                          {
                            solicitud
                              .detalleSolicitud
                          }

                        </p>

                      </div>

                    )}



                    {/* ================================= */}
                    {/* FECHAS                              */}
                    {/* ================================= */}

                    <div className="
                      mt-4
                      grid
                      grid-cols-1
                      sm:grid-cols-3
                      gap-2
                    ">


                      <div className="
                        px-3
                        py-2
                        rounded-md
                        bg-slate-50
                        border
                        border-slate-100
                      ">

                        <div className="
                          flex
                          items-center
                          gap-1.5
                        ">

                          <Clock3
                            size={12}
                            className="text-slate-400"
                          />

                          <span className="
                            text-xs
                            text-slate-400
                          ">

                            Creación

                          </span>

                        </div>


                        <p className="
                          mt-1
                          text-xs
                          font-medium
                          text-slate-600
                        ">

                          {
                            formatoFecha(
                              solicitud.createdAt
                            )
                          }

                        </p>

                      </div>



                      <div className="
                        px-3
                        py-2
                        rounded-md
                        bg-slate-50
                        border
                        border-slate-100
                      ">

                        <div className="
                          flex
                          items-center
                          gap-1.5
                        ">

                          <Clock3
                            size={12}
                            className="text-slate-400"
                          />

                          <span className="
                            text-xs
                            text-slate-400
                          ">

                            Actualización

                          </span>

                        </div>


                        <p className="
                          mt-1
                          text-xs
                          font-medium
                          text-slate-600
                        ">

                          {
                            formatoFecha(
                              solicitud.updatedAt
                            )
                          }

                        </p>

                      </div>



                      <div className="
                        px-3
                        py-2
                        rounded-md
                        bg-red-50
                        border
                        border-red-100
                      ">

                        <div className="
                          flex
                          items-center
                          gap-1.5
                        ">

                          <CalendarDays
                            size={12}
                            className="text-red-400"
                          />

                          <span className="
                            text-xs
                            text-red-400
                          ">

                            Finalización

                          </span>

                        </div>


                        <p className="
                          mt-1
                          text-xs
                          font-medium
                          text-slate-600
                        ">

                          {
                            formatoFechaFinaizacion(
                              solicitud
                                .programacion
                                ?.fechaFinalizacionServicio
                              ?? ""
                            )
                          }

                        </p>

                      </div>

                    </div>

                  </div>



                  {/* ===================================== */}
                  {/* ACCIONES                              */}
                  {/* ===================================== */}

                  <div className="
                    px-4
                    py-3
                    bg-slate-50
                    border-t
                    border-slate-100

                    flex
                    justify-end
                  ">

                    <SolicitudTramiteMenu
                      solicitudId={
                        solicitud.id
                      }
                    />

                  </div>

                </article>

              )

            }
          )}


          <EliminarSolicitudTramiteModal />

        </div>

      ) : (

        /* ================================================= */
        /* SIN RESULTADOS                                    */
        /* ================================================= */

        <div className="
          flex
          flex-col
          items-center
          justify-center
          py-16
          px-4
          text-center
          bg-white
          border
          border-slate-200
          rounded-xl
        ">

          <div className="
            flex
            items-center
            justify-center
            w-10
            h-10
            rounded-xl
            bg-slate-50
            border
            border-slate-200
          ">

            <Search
              size={18}
              className="text-slate-400"
            />

          </div>


          <p className="
            mt-3
            text-xs
            font-medium
            text-slate-600
          ">

            No hay solicitudes que coincidan con la búsqueda.

          </p>


          <Link
            href="/center/solicitudTramites/nueva"
            className="
              mt-3
              h-8
              px-3
              flex
              items-center
              gap-1.5
              rounded-md
              bg-sky-500
              text-white
              text-xs
              font-medium
              hover:bg-sky-600
              transition
            "
          >

            <Plus size={13} />

            Crear solicitud

          </Link>

        </div>

      )}



      {/* ================================================= */}
      {/* PAGINACIÓN                                        */}
      {/* ================================================= */}

      {totalPages > 1 && (

        <div className="
          mt-5
          flex
          items-center
          justify-center
        ">


          <div className="
            flex
            items-center
            gap-1
            p-1
            bg-white
            border
            border-slate-200
            rounded-lg
            shadow-sm
          ">


            {/* ANTERIOR */}

            <button
              type="button"
              onClick={() =>
                cambiarPagina(
                  currentPage - 1
                )
              }
              disabled={
                currentPage === 1
              }
              className="
                w-8
                h-8
                flex
                items-center
                justify-center
                rounded-md
                text-slate-500
                transition

                hover:bg-slate-50
                hover:text-sky-500

                disabled:opacity-30
                disabled:cursor-not-allowed
              "
              title="Página anterior"
            >

              <ChevronLeft
                size={15}
              />

            </button>



            {/* PÁGINA ACTUAL */}

            <div className="
              min-w-[110px]
              h-8
              px-3
              flex
              items-center
              justify-center
              gap-1
              rounded-md
              bg-sky-50
              border
              border-sky-100
              text-xs
              font-medium
              text-sky-600
            ">

              <span>
                Página
              </span>

              <span className="
                font-semibold
              ">

                {currentPage}

              </span>

              <span className="
                text-sky-400
              ">

                de

              </span>

              <span className="
                font-semibold
              ">

                {totalPages}

              </span>

            </div>



            {/* SIGUIENTE */}

            <button
              type="button"
              onClick={() =>
                cambiarPagina(
                  currentPage + 1
                )
              }
              disabled={
                currentPage ===
                totalPages
              }
              className="
                w-8
                h-8
                flex
                items-center
                justify-center
                rounded-md
                text-slate-500
                transition

                hover:bg-slate-50
                hover:text-sky-500

                disabled:opacity-30
                disabled:cursor-not-allowed
              "
              title="Página siguiente"
            >

              <ChevronRight
                size={15}
              />

            </button>

          </div>

        </div>

      )}

    </>

  )
}