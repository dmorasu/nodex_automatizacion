"use client"

import { usePathname } from "next/navigation"
import { abrirModal } from "@/src/lib/modalesDetalle"
import { User } from "lucide-react"

export default function AddTramitadorBoton() {
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
        hover:bg-indigo-50
        hover:border-indigo-200
        hover:text-indigo-600
        focus:outline-none
        focus:ring-2
        focus:ring-indigo-100
      "
      onClick={() =>
        abrirModal(pathname, "addTramitador")
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
        group-hover:bg-indigo-100
        group-hover:border-indigo-200
        transition-all
      ">

        <User
          size={16}
          className="
            text-indigo-500
            group-hover:text-indigo-600
          "
        />

      </span>


      <span className="
        text-xs
        font-medium
        whitespace-nowrap
      ">

        Tramitador

      </span>

    </button>
  )
}