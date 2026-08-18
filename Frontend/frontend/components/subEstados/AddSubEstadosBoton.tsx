"use client"

import { useRouter, usePathname } from "next/navigation"
import { Flag } from "lucide-react"

export default function AddSubEstadoBoton() {

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
        hover:bg-violet-50
        hover:border-violet-200
        hover:text-violet-600
        focus:outline-none
        focus:ring-2
        focus:ring-violet-100
      "
      onClick={() =>
        router.push(
          `${pathname}?addSubEstado=true&showModal=true`
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
        group-hover:bg-violet-100
        group-hover:border-violet-200
        transition-all
      ">

        <Flag
          size={16}
          className="
            text-violet-500
            group-hover:text-violet-600
          "
        />

      </span>

      <span className="
        text-xs
        font-medium
        whitespace-nowrap
      ">

        SubEstado

      </span>

    </button>
  )
}