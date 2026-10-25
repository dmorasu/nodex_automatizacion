"use client"

import { usePathname } from "next/navigation"
import { abrirModal } from "@/src/lib/modalesDetalle"
import { Calendar } from "lucide-react"

export default function AddProgramacionBoton() {
  const pathname = usePathname()

  return (
    <button
      type="button"
      className="
        group
        flex
        items-center
        gap-2.5
        h-10
        px-3
        rounded-lg
        bg-slate-50
        border
        border-slate-200
        text-slate-600
        transition-all
        duration-200
        hover:bg-teal-50
        hover:border-teal-200
        hover:text-teal-600
        focus:outline-none
        focus:ring-2
        focus:ring-teal-100
      "
      onClick={() =>
        abrirModal(pathname, "addProgramacion")
      }
    >

      <span className="
        flex
        items-center
        justify-center
        w-7
        h-7
        rounded-md
        bg-white
        border
        border-slate-200
        group-hover:bg-teal-100
        group-hover:border-teal-200
        transition-all
      ">

        <Calendar
          size={14}
          className="
            text-teal-500
            group-hover:text-teal-600
          "
        />

      </span>


      <span className="
        text-xs
        font-medium
        whitespace-nowrap
      ">

        Programación

      </span>

    </button>
  )
}