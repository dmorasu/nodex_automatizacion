"use client"

import { usePathname } from "next/navigation"
import { abrirModal } from "@/src/lib/modalesDetalle"
import { Flag } from "lucide-react"

export default function AddEstadosBoton() {
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
        hover:bg-sky-50
        hover:border-sky-200
        hover:text-sky-600
        focus:outline-none
        focus:ring-2
        focus:ring-sky-100
      "
      onClick={() =>
        abrirModal(pathname, "addEstado")
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
        group-hover:bg-sky-100
        group-hover:border-sky-200
        transition-all
      ">

        <Flag
          size={16}
          className="
            text-sky-500
            group-hover:text-sky-600
          "
        />

      </span>


      <span className="
        text-xs
        font-medium
        whitespace-nowrap
      ">

        Estado

      </span>

    </button>
  )
}