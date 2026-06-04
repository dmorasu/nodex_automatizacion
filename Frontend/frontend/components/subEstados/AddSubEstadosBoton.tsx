"use client"

import { useRouter, usePathname } from "next/navigation"
import { Flag} from "lucide-react"

export default function AddSubEstadoBoton() {

  const router = useRouter()
  const pathname = usePathname()

  return (
    <button
      type="button"
      className="
        flex items-center justify-center gap-2
        h-10 min-w-[140px]
        px-4
        bg-violet-500 text-white
        font-medium rounded-md
        transition-all
        hover:bg-white hover:text-violet-500
        hover:border border-violet-500
      "
      onClick={() =>
        router.push(`${pathname}?addSubEstado=true&showModal=true`)
      }
    >
      <Flag size={18}/>
      SubEstado
    </button>
  )
}