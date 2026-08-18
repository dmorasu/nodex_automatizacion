"use client"

import {
  AlertCircle,
  CalendarClock,
  Clock3,
  CheckCircle2,
  List
} from "lucide-react"

import { usePanelControl } from "@/hooks/usePanelControl"


export default function PanelControl({
  setSemaforoFiltro
}: any) {

  const data = usePanelControl()

  if (!data) return null


  return (

    <div className="
      grid
      grid-cols-2
      lg:grid-cols-5

      gap-3

      mb-8
    ">


      {/* ================================================= */}
      {/* VENCIDOS                                        */}
      {/* ================================================= */}

      <Card
        titulo="Vencidos"
        valor={data.vencidos}
        filtro="VENCIDO"
        setSemaforoFiltro={setSemaforoFiltro}

        icon={
          <AlertCircle
            size={17}
          />
        }

        color="red"
      />


      {/* ================================================= */}
      {/* VENCE HOY                                       */}
      {/* ================================================= */}

      <Card
        titulo="Vence hoy"
        valor={data.vencen_hoy}
        filtro="VENCE_HOY"
        setSemaforoFiltro={setSemaforoFiltro}

        icon={
          <CalendarClock
            size={17}
          />
        }

        color="orange"
      />


      {/* ================================================= */}
      {/* PRÓXIMOS                                         */}
      {/* ================================================= */}

      <Card
        titulo="Próximos"
        valor={data.proximos}
        filtro="PROXIMO_A_VENCER"
        setSemaforoFiltro={setSemaforoFiltro}

        icon={
          <Clock3
            size={17}
          />
        }

        color="yellow"
      />


      {/* ================================================= */}
      {/* AL DÍA                                           */}
      {/* ================================================= */}

      <Card
        titulo="Al día"
        valor={data.al_dia}
        filtro="AL_DIA"
        setSemaforoFiltro={setSemaforoFiltro}

        icon={
          <CheckCircle2
            size={17}
          />
        }

        color="green"
      />


      {/* ================================================= */}
      {/* VER TODOS                                        */}
      {/* ================================================= */}

      <button
        type="button"
        onClick={() =>
          setSemaforoFiltro(null)
        }

        className="
          relative

          flex
          items-center
          justify-center
          gap-2

          min-h-[82px]

          px-4

          rounded-xl

          bg-white

          border
          border-slate-200

          text-slate-500

          shadow-sm

          transition-all
          duration-200

          hover:border-sky-200
          hover:bg-sky-50
          hover:text-sky-600

          hover:-translate-y-0.5
          hover:shadow-md

          focus:outline-none
          focus:ring-2
          focus:ring-sky-100
        "
      >

        <List
          size={17}
        />

        <div className="text-left">

          <p className="
            text-[10px]
            font-medium
            uppercase
            tracking-wide
          ">

            Mostrar

          </p>

          <p className="
            text-xs
            font-semibold
          ">

            Todos

          </p>

        </div>

      </button>

    </div>

  )
}



// =====================================================
// CARD
// =====================================================

function Card({
  titulo,
  valor,
  filtro,
  setSemaforoFiltro,
  icon,
  color
}: any) {


  const colores = {

    red: {
      border: "border-red-100",
      icon: "bg-red-50 text-red-500",
      number: "text-red-600",
      hover: "hover:border-red-200 hover:bg-red-50/30"
    },

    orange: {
      border: "border-orange-100",
      icon: "bg-orange-50 text-orange-500",
      number: "text-orange-600",
      hover: "hover:border-orange-200 hover:bg-orange-50/30"
    },

    yellow: {
      border: "border-yellow-100",
      icon: "bg-yellow-50 text-yellow-600",
      number: "text-yellow-600",
      hover: "hover:border-yellow-200 hover:bg-yellow-50/30"
    },

    green: {
      border: "border-green-100",
      icon: "bg-green-50 text-green-500",
      number: "text-green-600",
      hover: "hover:border-green-200 hover:bg-green-50/30"
    }

  }


  const estilo =
    colores[color as keyof typeof colores]


  return (

    <button
      type="button"

      onClick={() =>
        setSemaforoFiltro(filtro)
      }

      className={`
        relative

        min-h-[82px]

        flex
        items-center
        gap-3

        text-left

        px-4

        rounded-xl

        bg-white

        border
        ${estilo.border}

        shadow-sm

        transition-all
        duration-200

        ${estilo.hover}

        hover:-translate-y-0.5
        hover:shadow-md

        focus:outline-none
        focus:ring-2
        focus:ring-sky-100
      `}
    >


      {/* =============================================== */}
      {/* ICONO                                          */}
      {/* =============================================== */}

      <div className={`
        flex
        items-center
        justify-center

        shrink-0

        w-9
        h-9

        rounded-lg

        ${estilo.icon}
      `}>

        {icon}

      </div>



      {/* =============================================== */}
      {/* INFORMACIÓN                                    */}
      {/* =============================================== */}

      <div className="min-w-0">

        <p className="
          text-[10px]
          font-medium
          uppercase
          tracking-wide
          text-slate-400

          truncate
        ">

          {titulo}

        </p>


        <p className={`
          mt-0.5

          text-xl
          font-semibold

          ${estilo.number}
        `}>

          {valor}

        </p>

      </div>

    </button>

  )
}