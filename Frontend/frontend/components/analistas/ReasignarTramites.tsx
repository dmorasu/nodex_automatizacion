"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "react-toastify"
import { ArrowRight, Loader2 } from "lucide-react"
import { reasignarTramites } from "@/actions/analistas-action"
import type { Analista } from "@/hooks/useAnalistas"

const claseSelect = "h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"

// "sin" = trámites sin analista
const aId = (valor: string) => (valor === "sin" ? null : Number(valor))

export default function ReasignarTramites({ analistas, conTramites }: {
  analistas: Analista[]
  // Quienes hoy tienen trámites (puede haber alguien que ya no tenga el rol)
  conTramites: { id: number | null, nombre: string, abiertos: number }[]
}) {
  const router = useRouter()
  const [desde, setDesde] = useState("")
  const [hacia, setHacia] = useState("")
  const [procesando, start] = useTransition()

  const origen = conTramites.find(c => String(c.id ?? "sin") === desde)

  const reasignar = () => {
    if (!desde || !hacia) return toast.error("Elija de quién y a quién pasar los trámites")
    if (desde === hacia) return toast.error("Elija dos analistas distintos")
    const destino = hacia === "sin" ? "sin analista" : analistas.find(a => String(a.id) === hacia)?.nombreUsuario
    if (!confirm(`¿Pasar los ${origen?.abiertos ?? 0} trámites abiertos de ${origen?.nombre ?? "este analista"} a ${destino}?`)) return

    start(async () => {
      const resultado = await reasignarTramites(aId(desde), aId(hacia))
      if (!resultado.ok) {
        resultado.errores.forEach(error => toast.error(error))
        return
      }
      toast.success(`${resultado.datos.actualizados} trámite(s) reasignado(s)`)
      setDesde("")
      setHacia("")
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end">
      <label className="block flex-1">
        <span className="mb-1.5 block text-xs font-medium text-slate-600">De</span>
        <select value={desde} onChange={e => setDesde(e.target.value)} disabled={procesando} className={claseSelect}>
          <option value="">Seleccione</option>
          {conTramites.map(c => (
            <option key={c.id ?? "sin"} value={c.id ?? "sin"}>{c.nombre} ({c.abiertos} abiertos)</option>
          ))}
        </select>
      </label>

      <ArrowRight size={18} className="mx-auto hidden shrink-0 text-slate-300 sm:mb-2.5 sm:block" />

      <label className="block flex-1">
        <span className="mb-1.5 block text-xs font-medium text-slate-600">A</span>
        <select value={hacia} onChange={e => setHacia(e.target.value)} disabled={procesando} className={claseSelect}>
          <option value="">Seleccione</option>
          {analistas.map(a => <option key={a.id} value={a.id}>{a.nombreUsuario}</option>)}
          <option value="sin">Sin analista</option>
        </select>
      </label>

      <button
        type="button"
        onClick={reasignar}
        disabled={procesando}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-sky-500 px-4 text-xs font-semibold text-white hover:bg-sky-600 disabled:opacity-50"
      >
        {procesando && <Loader2 size={15} className="animate-spin" />}
        Reasignar
      </button>
    </div>
  )
}
