"use client"

import { useTransition } from "react"
import { toast } from "react-toastify"
import { Loader2, Play } from "lucide-react"
import { claseBotonPrimario } from "../ui/estilos"
import { iniciarDiligencia } from "@/actions/ruta"
import { posicionActual } from "@/src/lib/gps"

// Al llegar al sitio: marca la hora (y el GPS) de inicio de la diligencia. Su fin es la confirmación.
export default function IniciarDiligencia({ paradaId, deshabilitado }: { paradaId: number, deshabilitado?: string | null }) {
  const [iniciando, startIniciar] = useTransition()

  const iniciar = () => startIniciar(async () => {
    const r = await iniciarDiligencia(paradaId, await posicionActual())
    if (!r.ok) return void r.errores.forEach(e => toast.error(e))
    toast.success("Diligencia iniciada")
  })

  return (
    <div>
      <button type="button" onClick={iniciar} disabled={iniciando || Boolean(deshabilitado)} className={`${claseBotonPrimario} w-full disabled:opacity-50`}>
        {iniciando ? <Loader2 size={17} className="animate-spin" /> : <Play size={17} />} Iniciar diligencia
      </button>
      {deshabilitado && <p className="mt-1 text-center text-xs text-slate-500">{deshabilitado}</p>}
    </div>
  )
}
