"use client"

import { usePathname } from "next/navigation"
import { abrirModal } from "@/src/lib/modalesDetalle"
import { Receipt } from "lucide-react"

export default function AddCuentaCobroBoton() {
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
        hover:bg-cyan-50
        hover:border-cyan-200
        hover:text-cyan-600
        focus:outline-none
        focus:ring-2
        focus:ring-cyan-100
      "
      onClick={() =>
        abrirModal(pathname, "addCuentaCobro")
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
        group-hover:bg-cyan-100
        group-hover:border-cyan-200
        transition-all
      ">

        <Receipt
          size={16}
          className="
            text-cyan-500
            group-hover:text-cyan-600
          "
        />

      </span>

      <span className="
        text-xs
        font-medium
        whitespace-nowrap
      ">

        Cuenta de Cobro

      </span>

    </button>
  )
}