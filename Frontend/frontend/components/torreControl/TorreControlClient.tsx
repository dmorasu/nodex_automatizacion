"use client"

import Link from "next/link"
import PanelControl from "./PanelControl"
import { useEffect, useState } from "react"

import {
  Search,
  Satellite,
  CalendarClock,
  CheckCircle2,
  Clock3,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  FileText,
  Activity,
  Timer
} from "lucide-react"


export default function TorreControlClient() {

  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState("")
  const [searchDebounced, setSearchDebounced] = useState("")

  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const [semaforoFiltro, setSemaforoFiltro] =
    useState<string | null>(null)


  // =====================================================
  // DEBOUNCE BUSCADOR
  // =====================================================

  useEffect(() => {

    const timeout = setTimeout(() => {
      setSearchDebounced(search)
    }, 500)

    return () => clearTimeout(timeout)

  }, [search])


  // =====================================================
  // FETCH
  // =====================================================

  useEffect(() => {

    setLoading(true)

    const query = new URLSearchParams()

    if (semaforoFiltro) {
      query.append("semaforo", semaforoFiltro)
    }

    if (searchDebounced) {
      query.append("search", searchDebounced)
    }

    query.append("page", String(page))

    fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/solicitudTramites/torre-control?${query}`
    )
      .then(res => res.json())
      .then(res => {

        setData(res.data ?? [])
        setTotalPages(res.totalPages ?? 1)

      })
      .catch(error => {
        console.error("Error cargando Torre de Control:", error)
        setData([])
      })
      .finally(() => {
        setLoading(false)
      })

  }, [
    semaforoFiltro,
    page,
    searchDebounced
  ])


  // =====================================================
  // CONFIGURACIÓN SEMÁFORO
  // =====================================================

  const semaforoConfig: any = {

    VENCIDO: {
      label: "Vencido",
      color: "text-red-600",
      bg: "bg-red-50",
      border: "border-red-100",
      icon: <AlertCircle size={14} />
    },

    VENCE_HOY: {
      label: "Vence hoy",
      color: "text-orange-600",
      bg: "bg-orange-50",
      border: "border-orange-100",
      icon: <CalendarClock size={14} />
    },

    PROXIMO_A_VENCER: {
      label: "Próximo a vencer",
      color: "text-yellow-600",
      bg: "bg-yellow-50",
      border: "border-yellow-100",
      icon: <Clock3 size={14} />
    },

    AL_DIA: {
      label: "Al día",
      color: "text-sky-600",
      bg: "bg-sky-50",
      border: "border-sky-100",
      icon: <Activity size={14} />
    },

    CUMPLIDO: {
      label: "Cumplido",
      color: "text-green-600",
      bg: "bg-green-50",
      border: "border-green-100",
      icon: <CheckCircle2 size={14} />
    },

    SIN_FECHA: {
      label: "Sin fecha",
      color: "text-slate-500",
      bg: "bg-slate-50",
      border: "border-slate-200",
      icon: <Clock3 size={14} />
    }

  }


  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {

    return (

      <div className="
        min-h-[400px]
        flex
        flex-col
        items-center
        justify-center
        gap-3
      ">

        <div className="
          w-8
          h-8
          rounded-full
          border-2
          border-slate-200
          border-t-sky-500
          animate-spin
        " />

        <p className="
          text-xs
          text-slate-400
        ">

          Cargando Torre de Control...

        </p>

      </div>

    )
  }


  // =====================================================
  // UI
  // =====================================================

  return (

    <div className="
      max-w-7xl
      mx-auto
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

        mb-7
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
              text-sky-500
            ">

              <Satellite size={17} />

            </div>

            <div>

              <h1 className="
                text-sm
                font-semibold
                text-slate-800
              ">

                Torre de Control

              </h1>

              <p className="
                text-[10px]
                text-slate-400
                mt-0.5
              ">

                Seguimiento y cumplimiento de trámites

              </p>

            </div>

          </div>

        </div>


        <Link
          href="/center/dashboard"
          className="
            inline-flex
            items-center
            justify-center
            gap-2

            h-9

            px-4

            rounded-lg

            border
            border-slate-200

            bg-white

            text-[11px]
            font-medium
            text-slate-600

            shadow-sm

            transition-all
            duration-200

            hover:bg-slate-50
            hover:border-slate-300
            hover:text-slate-800
          "
        >

          <ChevronLeft size={14} />

          Dashboard

        </Link>

      </div>



      {/* ================================================= */}
      {/* BUSCADOR                                         */}
      {/* ================================================= */}

      <div className="
        flex
        flex-col
        sm:flex-row

        gap-3

        mb-7
      ">


        <div className="
          relative
          flex-1
          max-w-xl
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
            placeholder="Buscar por solicitud..."
            value={search}

            onChange={(e) => {

              setSearch(e.target.value)
              setPage(1)

            }}

            className="
              w-full

              h-10

              pl-9
              pr-4

              rounded-lg

              border
              border-slate-200

              bg-white

              text-xs
              text-slate-700

              placeholder:text-slate-400

              shadow-sm

              outline-none

              transition

              focus:border-sky-300
              focus:ring-2
              focus:ring-sky-100
            "
          />

        </div>

      </div>



      {/* ================================================= */}
      {/* PANEL CONTROL                                    */}
      {/* ================================================= */}

      <PanelControl
        setSemaforoFiltro={(filtro: string | null) => {

          setSemaforoFiltro(filtro)
          setPage(1)

        }}
      />



      {/* ================================================= */}
      {/* CONTADOR                                         */}
      {/* ================================================= */}

      <div className="
        flex
        items-center
        justify-between

        mb-3
      ">

        <p className="
          text-[10px]
          text-slate-400
        ">

          {data.length} solicitudes encontradas

        </p>

        {semaforoFiltro && (

          <button
            type="button"
            onClick={() => {
              setSemaforoFiltro(null)
              setPage(1)
            }}
            className="
              text-[10px]
              font-medium
              text-sky-500
              hover:text-sky-700
            "
          >

            Limpiar filtro

          </button>

        )}

      </div>



      {/* ================================================= */}
      {/* LISTADO                                          */}
      {/* ================================================= */}

      {data.length === 0 ? (

        <div className="
          flex
          flex-col
          items-center
          justify-center

          py-16

          rounded-xl

          border
          border-dashed
          border-slate-200

          bg-white
        ">

          <FileText
            size={28}
            className="text-slate-300"
          />

          <p className="
            mt-3
            text-xs
            font-medium
            text-slate-500
          ">

            No se encontraron solicitudes

          </p>

          <p className="
            mt-1
            text-[10px]
            text-slate-400
          ">

            Intenta modificar los filtros de búsqueda

          </p>

        </div>

      ) : (

        <ul className="
          grid
          grid-cols-1
          lg:grid-cols-2

          gap-3
        ">

          {data.map((solicitud: any) => {

            const config =
              semaforoConfig[
                solicitud.semaforo
              ] ?? semaforoConfig.SIN_FECHA


            return (

              <li
                key={solicitud.id}

                className="
                  group

                  relative

                  bg-white

                  border
                  border-slate-200

                  rounded-xl

                  p-4

                  shadow-sm

                  transition-all
                  duration-200

                  hover:-translate-y-0.5
                  hover:shadow-md
                  hover:border-slate-300
                "
              >


                {/* ===================================== */}
                {/* CABECERA                              */}
                {/* ===================================== */}

                <div className="
                  flex
                  items-start
                  justify-between

                  gap-3
                ">


                  <Link
                    href={`/center/solicitudTramites/${solicitud.id}`}

                    className="
                      flex
                      items-center
                      gap-2

                      min-w-0

                      text-xs
                      font-semibold

                      text-slate-700

                      hover:text-sky-600

                      transition-colors
                    "
                  >

                    <FileText
                      size={15}
                      className="
                        shrink-0
                        text-slate-400
                        group-hover:text-sky-500
                      "
                    />

                    <span className="truncate">

                      Solicitud #{solicitud.id}

                    </span>

                  </Link>


                  {/* SEMÁFORO */}

                  <div className={`
                    shrink-0

                    inline-flex
                    items-center
                    gap-1.5

                    px-2
                    py-1

                    rounded-md

                    border

                    ${config.bg}
                    ${config.border}
                    ${config.color}

                    text-[9px]
                    font-semibold
                  `}>

                    {config.icon}

                    {config.label}

                  </div>

                </div>



                {/* ===================================== */}
                {/* INFORMACIÓN                           */}
                {/* ===================================== */}

                <div className="
                  grid
                  grid-cols-2

                  gap-x-5
                  gap-y-3

                  mt-4

                  pt-4

                  border-t
                  border-slate-100
                ">


                  {/* ESTADO */}

                  <Info
                    icon={
                      <Activity size={13} />
                    }
                    label="Estado"
                    value={solicitud.estado}
                  />


                  {/* CUMPLIMIENTO */}

                  <Info
                    icon={
                      <CheckCircle2 size={13} />
                    }
                    label="Cumplimiento ANS"
                    value={solicitud.cumplimiento_ans}
                  />


                  {/* DÍAS ANS */}

                  <Info
                    icon={
                      <Timer size={13} />
                    }
                    label="Días ANS"
                    value={solicitud.dias_ans}
                  />


                  {/* DÍAS CASO */}

                  <Info
                    icon={
                      <Clock3 size={13} />
                    }
                    label="Días caso"
                    value={solicitud.dias_caso}
                  />

                </div>



                {/* ===================================== */}
                {/* VER DETALLE                           */}
                {/* ===================================== */}

                <div className="
                  mt-4
                  pt-3
                  border-t
                  border-slate-100
                ">

                  <Link
                    href={`/center/solicitudTramites/${solicitud.id}`}

                    className="
                      inline-flex
                      items-center
                      gap-1

                      text-[10px]
                      font-medium

                      text-sky-500

                      hover:text-sky-700
                    "
                  >

                    Ver detalle

                    <ChevronRight size={12} />

                  </Link>

                </div>

              </li>

            )

          })}

        </ul>

      )}



      {/* ================================================= */}
      {/* PAGINACIÓN                                       */}
      {/* ================================================= */}

      <div className="
        flex
        items-center
        justify-center

        gap-3

        mt-8
        pt-5

        border-t
        border-slate-100
      ">


        <button
          type="button"

          disabled={page === 1}

          onClick={() =>
            setPage(prev => prev - 1)
          }

          className="
            flex
            items-center
            justify-center

            w-8
            h-8

            rounded-lg

            border
            border-slate-200

            bg-white

            text-slate-500

            transition

            hover:bg-slate-50
            hover:text-slate-700

            disabled:opacity-40
            disabled:cursor-not-allowed
          "
        >

          <ChevronLeft size={15} />

        </button>


        <div className="
          flex
          items-center
          gap-1
        ">

          <span className="
            text-[10px]
            text-slate-400
          ">

            Página

          </span>

          <span className="
            text-xs
            font-semibold
            text-slate-700
          ">

            {page}

          </span>

          <span className="
            text-[10px]
            text-slate-400
          ">

            de {totalPages}

          </span>

        </div>


        <button
          type="button"

          disabled={page === totalPages}

          onClick={() =>
            setPage(prev => prev + 1)
          }

          className="
            flex
            items-center
            justify-center

            w-8
            h-8

            rounded-lg

            border
            border-slate-200

            bg-white

            text-slate-500

            transition

            hover:bg-slate-50
            hover:text-slate-700

            disabled:opacity-40
            disabled:cursor-not-allowed
          "
        >

          <ChevronRight size={15} />

        </button>

      </div>

    </div>

  )
}



// =====================================================
// INFO
// =====================================================

function Info({
  icon,
  label,
  value
}: {
  icon: React.ReactNode
  label: string
  value: any
}) {

  return (

    <div className="
      flex
      items-start
      gap-2
    ">

      <div className="
        mt-0.5

        text-slate-400

        shrink-0
      ">

        {icon}

      </div>

      <div className="min-w-0">

        <p className="
          text-[9px]
          uppercase
          tracking-wide
          text-slate-400
        ">

          {label}

        </p>

        <p className="
          mt-0.5

          text-[11px]
          font-medium

          text-slate-700

          truncate
        ">

          {value ?? "—"}

        </p>

      </div>

    </div>

  )
}