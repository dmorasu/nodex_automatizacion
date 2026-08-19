"use client"

import { useState } from "react"
import Link from "next/link"

import {
  Search,
  Filter,
  Trash2,
  Plus,
  Radar,
  Database,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  MapPin,
  User,
  BriefcaseBusiness,
  PlayCircle,
  Clock3,
  CircleCheck,
  CheckCircle2,
  Ban,
  CircleDashed
} from "lucide-react"

import { useTramites } from "@/hooks/useTramites"
import { useTramitadores } from "@/hooks/useTramitadores"
import { useOperaciones } from "@/hooks/useOperaciones"
import { useEstados } from "@/hooks/useEstadosSelect"
import { useSolicitudesFiltradas } from "@/hooks/useSolicitudesFiltradas"

import SolicitudTramiteMenu
  from "@/components/solicitudTramites/MenuSolicitudTramites"

import EliminarSolicitudTramiteModal
  from "@/components/solicitudTramites/EliminarSolicitudTramiteModal"

import {
  formatoFechaFinaizacion,
  formatoFechaSinZona
} from "@/src/ultis"


export default function DashboardPageClient() {

  // =====================================================
  // FILTROS
  // =====================================================

  const [search, setSearch] =
    useState("")

  const [estadoId, setEstadoId] =
    useState("")

  const [tramiteId, setTramiteId] =
    useState("")

  const [tramitadorId, setTramitadorId] =
    useState("")

  const [operacionesId, setOperacionesId] =
    useState("")

  const [placa, setPlaca] =
    useState("")

  const [fechaFinalizacionDesde, setFechaFinalizacionDesde] =
    useState("")

  const [fechaFinalizacionHasta, setFechaFinalizacionHasta] =
    useState("")

  const [page, setPage] =
    useState(1)


  // =====================================================
  // DATOS
  // =====================================================

  const { data: tramites } =
    useTramites()

  const { data: tramitadores } =
    useTramitadores()

  const { data: operaciones } =
    useOperaciones()

  const { data: estados } =
    useEstados()


  const {
    data: solicitudes,
    loading,
    totalPages,
    currentPage
  } = useSolicitudesFiltradas({
    search,
    estadoId,
    tramiteId,
    tramitadorId,
    operacionesId,
    placa,
    fechaFinalizacionDesde,
    fechaFinalizacionHasta,
    page
  })


  // =====================================================
  // FILTROS
  // =====================================================

  const aplicarFiltros = () => {
    setPage(1)
  }


  const borrarFiltros = () => {

    setSearch("")
    setEstadoId("")
    setTramiteId("")
    setTramitadorId("")
    setOperacionesId("")
    setPlaca("")
    setFechaFinalizacionDesde("")
    setFechaFinalizacionHasta("")
    setPage(1)

  }


  // =====================================================
  // ESTADO VISUAL
  // =====================================================

  const getEstadoVisual = (
    nombreEstado: string
  ) => {

    const nombre =
      nombreEstado
        .toLowerCase()
        .trim()


    if (nombre === "finalizado") {

      return {
        icon: CheckCircle2,
        container:
          "bg-emerald-50 border-emerald-100",
        iconColor:
          "text-emerald-500",
        textColor:
          "text-emerald-700"
      }

    }


    if (nombre === "desistido") {

      return {
        icon: Ban,
        container:
          "bg-red-50 border-red-100",
        iconColor:
          "text-red-500",
        textColor:
          "text-red-700"
      }

    }


    if (
      nombre ===
      "novedad subsanada continuar trámite"
    ) {

      return {
        icon: CircleCheck,
        container:
          "bg-violet-50 border-violet-100",
        iconColor:
          "text-violet-500",
        textColor:
          "text-violet-700"
      }

    }


    if (
      nombre ===
      "en espera por novedad"
    ) {

      return {
        icon: Clock3,
        container:
          "bg-amber-50 border-amber-100",
        iconColor:
          "text-amber-500",
        textColor:
          "text-amber-700"
      }

    }


    if (nombre === "en curso") {

      return {
        icon: PlayCircle,
        container:
          "bg-sky-50 border-sky-100",
        iconColor:
          "text-sky-500",
        textColor:
          "text-sky-700"
      }

    }


    return {
      icon: CircleDashed,
      container:
        "bg-slate-50 border-slate-200",
      iconColor:
        "text-slate-400",
      textColor:
        "text-slate-600"
    }

  }


  return (

    <div className="
      w-full
      space-y-6
    ">


      {/* ================================================= */}
      {/* ENCABEZADO                                       */}
      {/* ================================================= */}

      <div className="
        flex
        flex-col
        sm:flex-row
        sm:items-center
        sm:justify-between
        gap-4
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
              w-9
              h-9
              rounded-lg
              bg-sky-50
              border
              border-sky-100
            ">

              <Radar
                size={19}
                className="text-sky-500"
              />

            </div>


            <h1 className="
              text-xl
              font-semibold
              text-slate-800
            ">
              Torre de Control
            </h1>

          </div>


          <p className="
            mt-1
            ml-11
            text-xs
            text-slate-400
          ">
            Gestión y seguimiento de las solicitudes de trámite.
          </p>

        </div>



        {/* ================================================= */}
        {/* ACCIONES                                         */}
        {/* ================================================= */}

        <div className="
          flex
          items-center
          gap-2
        ">

          <Link
            href="/center/solicitudTramites/nueva"
            className="
              inline-flex
              items-center
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

            <Plus size={15} />

            Nuevo trámite

          </Link>


          <Link
            href="/center/gestionMasiva"
            className="
              inline-flex
              items-center
              gap-2
              h-9
              px-3
              rounded-md
              border
              border-slate-200
              bg-white
              text-slate-600
              text-xs
              font-medium
              transition
              hover:bg-slate-50
              hover:border-slate-300
            "
          >

            <Database size={15} />

            Gestión masiva

          </Link>

        </div>

      </div>



      {/* ================================================= */}
      {/* BUSCADOR                                         */}
      {/* ================================================= */}

      <div className="
        bg-white
        border
        border-slate-200
        rounded-xl
        p-4
      ">

        <div className="
          flex
          flex-col
          md:flex-row
          gap-3
        ">


          <div className="
            relative
            flex-1
          ">

            <Search
              size={16}
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
              placeholder="Buscar por ID o identificación"
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }

              className="
                w-full
                h-10
                pl-9
                pr-3
                rounded-md
                border
                border-slate-200
                bg-slate-50
                text-xs
                text-slate-700
                placeholder:text-slate-400
                outline-none
                transition
                focus:bg-white
                focus:border-sky-400
                focus:ring-2
                focus:ring-sky-100
              "
            />

          </div>


          <button
            type="button"
            onClick={aplicarFiltros}
            className="
              inline-flex
              items-center
              justify-center
              gap-2
              h-10
              px-4
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

            <Search size={15} />

            Buscar

          </button>

        </div>

      </div>



      {/* ================================================= */}
      {/* FILTROS                                          */}
      {/* ================================================= */}

      <div className="
        bg-white
        border
        border-slate-200
        rounded-xl
        p-4
      ">


        <div className="
          flex
          items-center
          justify-between
          mb-4
        ">


          <div className="
            flex
            items-center
            gap-2
          ">

            <Filter
              size={16}
              className="text-sky-500"
            />

            <h2 className="
              text-sm
              font-semibold
              text-slate-700
            ">
              Filtros
            </h2>

          </div>


          <button
            type="button"
            onClick={borrarFiltros}
            className="
              inline-flex
              items-center
              gap-1.5
              text-xs
              text-slate-400
              hover:text-red-500
              transition
            "
          >

            <Trash2 size={14} />

            Limpiar filtros

          </button>

        </div>



        {/* ================================================= */}
        {/* FILTROS PRINCIPALES                             */}
        {/* ================================================= */}

        <div className="
          grid
          grid-cols-1
          sm:grid-cols-2
          lg:grid-cols-5
          gap-3
        ">


          {/* PLACA */}

          <div className="relative">

            <MapPin
              size={14}
              className="
                absolute
                left-3
                top-1/2
                -translate-y-1/2
                text-slate-400
                pointer-events-none
              "
            />

            <input
              type="text"
              placeholder="Placa"
              value={placa}
              onChange={(e) =>
                setPlaca(e.target.value)
              }

              className="
                w-full
                h-10
                pl-9
                pr-3
                rounded-md
                border
                border-slate-200
                bg-slate-50
                text-xs
                text-slate-700
                outline-none
                focus:bg-white
                focus:border-sky-400
                focus:ring-2
                focus:ring-sky-100
              "
            />

          </div>



          {/* ESTADO */}

          <select
            value={estadoId}
            onChange={(e) =>
              setEstadoId(e.target.value)
            }

            className="
              h-10
              px-3
              rounded-md
              border
              border-slate-200
              bg-slate-50
              text-xs
              text-slate-600
              outline-none
              cursor-pointer
              focus:bg-white
              focus:border-sky-400
              focus:ring-2
              focus:ring-sky-100
            "
          >

            <option value="">
              Estado
            </option>

            {estados.map((estado) => (

              <option
                key={estado.id}
                value={estado.id}
              >
                {estado.nombreEstado}
              </option>

            ))}

          </select>



          {/* TRÁMITE */}

          <select
            value={tramiteId}
            onChange={(e) =>
              setTramiteId(e.target.value)
            }

            className="
              h-10
              px-3
              rounded-md
              border
              border-slate-200
              bg-slate-50
              text-xs
              text-slate-600
              outline-none
              cursor-pointer
              focus:bg-white
              focus:border-sky-400
              focus:ring-2
              focus:ring-sky-100
            "
          >

            <option value="">
              Trámite
            </option>

            {tramites.map((tramite) => (

              <option
                key={tramite.id}
                value={tramite.id}
              >
                {tramite.nombreTramite}
              </option>

            ))}

          </select>



          {/* TRAMITADOR */}

          <select
            value={tramitadorId}
            onChange={(e) =>
              setTramitadorId(e.target.value)
            }

            className="
              h-10
              px-3
              rounded-md
              border
              border-slate-200
              bg-slate-50
              text-xs
              text-slate-600
              outline-none
              cursor-pointer
              focus:bg-white
              focus:border-sky-400
              focus:ring-2
              focus:ring-sky-100
            "
          >

            <option value="">
              Tramitador
            </option>

            {tramitadores.map((tramitador) => (

              <option
                key={tramitador.id}
                value={tramitador.id}
              >
                {tramitador.nombreTramitador}
              </option>

            ))}

          </select>



          {/* OPERACIÓN */}

          <select
            value={operacionesId}
            onChange={(e) =>
              setOperacionesId(e.target.value)
            }

            className="
              h-10
              px-3
              rounded-md
              border
              border-slate-200
              bg-slate-50
              text-xs
              text-slate-600
              outline-none
              cursor-pointer
              focus:bg-white
              focus:border-sky-400
              focus:ring-2
              focus:ring-sky-100
            "
          >

            <option value="">
              Operación
            </option>

            {operaciones.map((operacion) => (

              <option
                key={operacion.id}
                value={operacion.id}
              >
                {operacion.nombreOperacion}
              </option>

            ))}

          </select>

        </div>



        {/* ================================================= */}
        {/* FECHAS                                           */}
        {/* ================================================= */}

        <div className="
          mt-4
          pt-4
          border-t
          border-slate-100
        ">

          <div className="
            flex
            items-center
            gap-2
            mb-3
          ">

            <CalendarDays
              size={15}
              className="text-slate-400"
            />

            <span className="
              text-xs
              font-medium
              text-slate-600
            ">
              Fecha de finalización del servicio
            </span>

          </div>


          <div className="
            grid
            grid-cols-1
            sm:grid-cols-2
            gap-3
            max-w-xl
          ">


            <div>

              <label className="
                block
                mb-1
                text-[11px]
                text-slate-400
              ">
                Desde
              </label>

              <input
                type="date"
                value={fechaFinalizacionDesde}
                onChange={(e) =>
                  setFechaFinalizacionDesde(
                    e.target.value
                  )
                }

                className="
                  w-full
                  h-10
                  px-3
                  rounded-md
                  border
                  border-slate-200
                  bg-slate-50
                  text-xs
                  text-slate-600
                  outline-none
                  focus:bg-white
                  focus:border-sky-400
                  focus:ring-2
                  focus:ring-sky-100
                "
              />

            </div>


            <div>

              <label className="
                block
                mb-1
                text-[11px]
                text-slate-400
              ">
                Hasta
              </label>

              <input
                type="date"
                value={fechaFinalizacionHasta}
                onChange={(e) =>
                  setFechaFinalizacionHasta(
                    e.target.value
                  )
                }

                className="
                  w-full
                  h-10
                  px-3
                  rounded-md
                  border
                  border-slate-200
                  bg-slate-50
                  text-xs
                  text-slate-600
                  outline-none
                  focus:bg-white
                  focus:border-sky-400
                  focus:ring-2
                  focus:ring-sky-100
                "
              />

            </div>

          </div>

        </div>



        {/* ================================================= */}
        {/* BOTONES FILTROS                                  */}
        {/* ================================================= */}

        <div className="
          flex
          justify-end
          gap-2
          mt-4
          pt-4
          border-t
          border-slate-100
        ">

          <button
            type="button"
            onClick={borrarFiltros}
            className="
              inline-flex
              items-center
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
            "
          >

            <Trash2 size={14} />

            Limpiar

          </button>


          <button
            type="button"
            onClick={aplicarFiltros}
            className="
              inline-flex
              items-center
              gap-2
              h-9
              px-4
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

            <Filter size={14} />

            Aplicar filtros

          </button>

        </div>

      </div>



      {/* ================================================= */}
      {/* RESULTADOS                                       */}
      {/* ================================================= */}

      {loading ? (

        <div className="
          flex
          items-center
          justify-center
          py-16
        ">

          <p className="
            text-xs
            text-slate-400
          ">
            Cargando solicitudes...
          </p>

        </div>

      ) : solicitudes.length > 0 ? (

        <div className="
          space-y-3
        ">


          {/* ================================================= */}
          {/* INFORMACIÓN RESULTADOS                           */}
          {/* ================================================= */}

          <div className="
            flex
            items-center
            justify-between
            px-1
          ">

            <p className="
              text-xs
              text-slate-400
            ">
              Solicitudes encontradas
            </p>


            <span className="
              text-xs
              text-slate-400
            ">

              Página{" "}

              <span className="
                font-semibold
                text-slate-600
              ">
                {currentPage}
              </span>

              {" "}de{" "}

              <span className="
                font-semibold
                text-slate-600
              ">
                {totalPages}
              </span>

            </span>

          </div>



          {/* ================================================= */}
          {/* SOLICITUDES                                      */}
          {/* ================================================= */}

          <div className="
            space-y-3
          ">


            {solicitudes.map((solicitud) => {

              const nombreEstado =
                solicitud
                  .estadosTramites?.[0]
                  ?.estado
                  ?.nombreEstado ??
                "Sin Iniciar"


              const estadoVisual =
                getEstadoVisual(
                  nombreEstado
                )


              const EstadoIcon =
                estadoVisual.icon


              return (

                <div
                  key={solicitud.id}
                  className="
                    bg-white
                    border
                    border-slate-200
                    rounded-xl
                    p-4
                    sm:p-5
                    transition-all
                    hover:border-slate-300
                    hover:shadow-sm
                  "
                >

                  <div className="
                    flex
                    flex-col
                    lg:flex-row
                    lg:items-start
                    lg:justify-between
                    gap-5
                  ">


                    {/* ===================================== */}
                    {/* INFORMACIÓN                            */}
                    {/* ===================================== */}

                    <div className="
                      min-w-0
                      flex-1
                    ">


                      {/* SOLICITUD */}

                      <Link
                        href={`/center/solicitudTramites/${solicitud.id}`}
                        className="
                          inline-flex
                          items-center
                          gap-1.5
                          text-sm
                          font-semibold
                          text-slate-800
                          hover:text-sky-600
                          transition
                        "
                      >

                        Solicitud de Trámite

                        <span className="
                          text-sky-500
                        ">
                          #{solicitud.id}
                        </span>

                      </Link>



                      {/* CLIENTE */}

                      <div className="
                        flex
                        items-center
                        gap-2
                        mt-3
                      ">

                        <User
                          size={14}
                          className="
                            text-slate-400
                            shrink-0
                          "
                        />

                        <span className="
                          text-xs
                          text-slate-500
                        ">

                          Cliente:

                          <span className="
                            ml-1
                            font-medium
                            text-slate-700
                          ">

                            {
                              solicitud
                                .clientes
                                ?.nombreCliente
                            }

                          </span>

                        </span>

                      </div>



                      {/* MUNICIPIO / DIRECCIÓN */}

                      <div className="
                        flex
                        flex-wrap
                        items-center
                        gap-x-5
                        gap-y-2
                        mt-2
                      ">

                        <span className="
                          inline-flex
                          items-center
                          gap-1.5
                          text-xs
                          text-slate-500
                        ">

                          <MapPin
                            size={13}
                          />

                          {
                            solicitud
                              .municipios
                              ?.nombreMunicipio
                          }

                        </span>


                        <span className="
                          text-xs
                          text-slate-500
                        ">

                          {
                            solicitud
                              .direccionTramite
                          }

                        </span>

                      </div>



                      {/* DETALLE */}

                      <p className="
                        mt-3
                        max-w-3xl
                        text-xs
                        leading-5
                        text-slate-500
                      ">

                        {
                          solicitud
                            .detalleSolicitud
                        }

                      </p>



                      {/* ================================================= */}
                      {/* METADATOS                                        */}
                      {/* ================================================= */}

                      <div className="
                        grid
                        grid-cols-1
                        sm:grid-cols-2
                        xl:grid-cols-5
                        gap-x-6
                        gap-y-3
                        mt-4
                        pt-3
                        border-t
                        border-slate-100
                      ">


                        {/* OPERACIÓN */}

                        <div className="
                          flex
                          items-center
                          gap-2
                        ">

                          <BriefcaseBusiness
                            size={13}
                            className="
                              text-slate-400
                              shrink-0
                            "
                          />

                          <div>

                            <span className="
                              block
                              text-[11px]
                              text-slate-400
                            ">
                              Operación
                            </span>

                            <span className="
                              text-xs
                              text-slate-600
                            ">

                              {
                                solicitud
                                  .operaciones
                                  ?.nombreOperacion
                              }

                            </span>

                          </div>

                        </div>



                        {/* ASIGNADO */}

                        <div>

                          <span className="
                            block
                            text-[11px]
                            text-slate-400
                          ">
                            Asignado a
                          </span>

                          <p className="
                            text-xs
                            text-slate-600
                          ">

                            {
                              solicitud.municipios?.responsable??
                              "Sin analista asignado"
                            }

                          </p>

                        </div>
                        {/* ASIGNADO */}

                        <div>

                          <span className="
                            block
                            text-[11px]
                            text-slate-400
                          ">
                            Creado por:
                          </span>

                          <p className="
                            text-xs
                            text-slate-600
                          ">

                            {
                              solicitud
                                .usuario
                                ?.nombreUsuario ??
                              "creado automaticamente"
                            }

                          </p>

                        </div>


                        {/* FECHA CREACIÓN */}

                        <div>

                          <span className="
                            block
                            text-[11px]
                            text-slate-400
                          ">
                            Fecha de creación
                          </span>

                          <p className="
                            text-xs
                            text-slate-600
                          ">

                            {
                              formatoFechaFinaizacion(
                                solicitud.createdAt
                              )
                            }

                          </p>

                        </div>



                        {/* ENTREGA */}

                        <div>

                          <span className="
                            block
                            text-[11px]
                            text-slate-400
                          ">
                            Entrega de resultado
                          </span>

                          <p className="
                            text-xs
                            text-slate-600
                          ">

                            {
                              formatoFechaSinZona(
                                solicitud
                                  .fechaEntregaResultado
                              )
                            }

                          </p>

                        </div>

                      </div>



                      {/* FECHA FINALIZACIÓN */}

                      <div className="
                        flex
                        flex-wrap
                        items-center
                        gap-2
                        mt-3
                      ">

                        <CalendarDays
                          size={13}
                          className="
                            text-slate-400
                          "
                        />

                        <span className="
                          text-[11px]
                          text-slate-400
                        ">
                          Finalización del servicio:
                        </span>

                        <span className="
                          text-xs
                          font-medium
                          text-slate-600
                        ">

                          {
                            formatoFechaFinaizacion(
                              solicitud
                                .programacion
                                ?.fechaFinalizacionServicio ??
                              ""
                            )
                          }

                        </span>

                      </div>

                    </div>



                    {/* ================================================= */}
                    {/* ESTADO + MENÚ                                    */}
                    {/* ================================================= */}

                    <div className="
                      flex
                      lg:flex-col
                      items-center
                      lg:items-end
                      justify-between
                      lg:justify-start
                      gap-4
                      shrink-0
                    ">


                      {/* ESTADO */}

                      <div
                        className={`
                          inline-flex
                          items-center
                          gap-2
                          px-3
                          py-2
                          rounded-lg
                          border
                          ${estadoVisual.container}
                        `}
                      >

                        <EstadoIcon
                          size={15}
                          className={
                            estadoVisual.iconColor
                          }
                        />


                        <span className={`
                          text-xs
                          font-medium
                          ${estadoVisual.textColor}
                        `}>

                          {nombreEstado}

                        </span>

                      </div>



                      {/* MENÚ */}

                      <SolicitudTramiteMenu
                        solicitudId={
                          solicitud.id
                        }
                      />

                    </div>

                  </div>

                </div>

              )

            })}

          </div>



          {/* ================================================= */}
          {/* PAGINACIÓN                                       */}
          {/* ================================================= */}

          <div className="
            flex
            flex-col
            sm:flex-row
            sm:items-center
            sm:justify-between
            gap-3
            pt-3
          ">


            {/* INFORMACIÓN */}

            <div className="
              text-xs
              text-slate-400
            ">

              Página{" "}

              <span className="
                font-semibold
                text-slate-700
              ">
                {currentPage}
              </span>

              {" "}de{" "}

              <span className="
                font-semibold
                text-slate-700
              ">
                {totalPages}
              </span>

            </div>



            {/* CONTROLES */}

            <div className="
              flex
              items-center
              gap-1
            ">


              {/* ANTERIOR */}

              <button
                type="button"
                disabled={
                  currentPage === 1
                }

                onClick={() =>
                  setPage(
                    p => p - 1
                  )
                }

                className="
                  flex
                  items-center
                  justify-center
                  w-8
                  h-8
                  rounded-md
                  border
                  border-slate-200
                  bg-white
                  text-slate-500
                  transition

                  hover:bg-slate-50
                  hover:text-sky-500

                  disabled:opacity-30
                  disabled:cursor-not-allowed

                  focus:outline-none
                  focus:ring-2
                  focus:ring-sky-100
                "

                aria-label="
                  Página anterior
                "
              >

                <ChevronLeft
                  size={15}
                />

              </button>



              {/* PÁGINA ACTUAL */}

              <div className="
                flex
                items-center
                justify-center
                min-w-8
                h-8
                px-2
                rounded-md
                bg-sky-500
                text-white
                text-xs
                font-semibold
              ">

                {currentPage}

              </div>



              {/* SIGUIENTE */}

              <button
                type="button"
                disabled={
                  currentPage === totalPages
                }

                onClick={() =>
                  setPage(
                    p => p + 1
                  )
                }

                className="
                  flex
                  items-center
                  justify-center
                  w-8
                  h-8
                  rounded-md
                  border
                  border-slate-200
                  bg-white
                  text-slate-500
                  transition

                  hover:bg-slate-50
                  hover:text-sky-500

                  disabled:opacity-30
                  disabled:cursor-not-allowed

                  focus:outline-none
                  focus:ring-2
                  focus:ring-sky-100
                "

                aria-label="
                  Página siguiente
                "
              >

                <ChevronRight
                  size={15}
                />

              </button>

            </div>

          </div>

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
            rounded-lg
            bg-slate-50
            border
            border-slate-200
          ">

            <Search
              size={18}
              className="
                text-slate-400
              "
            />

          </div>


          <p className="
            mt-3
            text-sm
            font-medium
            text-slate-600
          ">
            No se encontraron solicitudes
          </p>


          <p className="
            mt-1
            text-xs
            text-slate-400
          ">
            Intente modificar los criterios de búsqueda.
          </p>

        </div>

      )}

    </div>

  )
}