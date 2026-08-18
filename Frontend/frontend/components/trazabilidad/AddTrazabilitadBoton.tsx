"use client"

import { useRouter, usePathname } from "next/navigation"
import { Activity } from "lucide-react"

export default function AddTrazabilidadBoton() {

  const router = useRouter()
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
        hover:bg-blue-50
        hover:border-blue-200
        hover:text-blue-600
        focus:outline-none
        focus:ring-2
        focus:ring-blue-100
      "
      onClick={() =>
        router.push(
          `${pathname}?addTrazabilidad=true&showModal=true`
        )
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
        group-hover:bg-blue-100
        group-hover:border-blue-200
        transition-all
      ">

        <Activity
          size={16}
          className="
            text-blue-500
            group-hover:text-blue-600
          "
        />

      </span>

      <span className="
        text-xs
        font-medium
        whitespace-nowrap
      ">

        Trazabilidad

      </span>

    </button>
  )
}