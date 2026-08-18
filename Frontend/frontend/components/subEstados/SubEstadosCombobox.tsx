"use client"

import { useState } from "react"
import { Flag, ChevronDown } from "lucide-react"

import { useSubEstados } from "@/hooks/useSubEstados"


interface Props {
  tramiteId: number
  name?: string
}


export default function SubEstadosCombobox({
  tramiteId,
  name = "subEstadoId"
}: Props) {

  const { data, loading } =
    useSubEstados(tramiteId)

  const [selected, setSelected] =
    useState<string>("")


  return (

    <div className="
      relative
      w-full
    ">


      {/* ================================================= */}
      {/* ICONO                                             */}
      {/* ================================================= */}

      <div className="
        pointer-events-none
        absolute
        inset-y-0
        left-0
        flex
        items-center
        pl-3
        z-10
      ">

        <Flag
          size={15}
          className="
            text-violet-400
          "
        />

      </div>


      {/* ================================================= */}
      {/* SELECT                                            */}
      {/* ================================================= */}

      <select
        name={name}
        value={selected}

        onChange={(e) =>
          setSelected(e.target.value)
        }

        className="
          appearance-none
          w-full
          h-10
          pl-9
          pr-9
          rounded-md
          border
          border-slate-200
          bg-slate-50
          text-xs
          text-slate-700
          outline-none
          transition
          cursor-pointer

          hover:bg-white
          hover:border-violet-300

          focus:bg-white
          focus:border-violet-400
          focus:ring-2
          focus:ring-violet-100

          disabled:cursor-not-allowed
          disabled:bg-slate-100
          disabled:text-slate-400
        "

        required

        disabled={loading}
      >

        {/* ============================================= */}
        {/* OPCIÓN POR DEFECTO                             */}
        {/* ============================================= */}

        <option value="">

          {loading
            ? "Cargando..."
            : "Seleccione SubEstado"
          }

        </option>


        {/* ============================================= */}
        {/* SUBESTADOS                                     */}
        {/* ============================================= */}

        {data.map(subEstado => (

          <option
            key={subEstado.id}
            value={subEstado.id}
          >
            {subEstado.nombre}
          </option>

        ))}

      </select>


      {/* ================================================= */}
      {/* FLECHA                                            */}
      {/* ================================================= */}

      <div className="
        pointer-events-none
        absolute
        inset-y-0
        right-0
        flex
        items-center
        pr-3
      ">

        <ChevronDown
          size={16}
          className="
            text-slate-400
          "
        />

      </div>

    </div>

  )
}