"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "react-toastify"
import { Loader2, Pencil, X } from "lucide-react"
import { asignarAnalista } from "@/actions/analistas-action"
import { useAnalistas } from "@/hooks/useAnalistas"
import { usePermisosAnalistas } from "@/src/auth/PerfilContexto"

// Analista asignado del trámite. El Administrador de Torre de control lo puede cambiar aquí.
export default function CambiarAnalista({ solicitudId, analistaId, nombreAnalista }: {
  solicitudId: number
  analistaId: number | null
  nombreAnalista: string | null
}) {
  const router = useRouter()
  const { puedeAsignarAnalistas } = usePermisosAnalistas()
  const [editando, setEditando] = useState(false)
  const [seleccion, setSeleccion] = useState(analistaId ? String(analistaId) : "")
  const [guardando, startGuardar] = useTransition()
  const { data: analistas, loading } = useAnalistas()

  if (!editando) {
    return (
      <span className="inline-flex items-center gap-2 text-xs text-gray-800">
        {nombreAnalista ?? "Sin analista asignado"}
        {puedeAsignarAnalistas && (
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-sky-600 hover:bg-sky-50"
          >
            <Pencil size={12} />
            Cambiar
          </button>
        )}
      </span>
    )
  }

  const guardar = () =>
    startGuardar(async () => {
      const resultado = await asignarAnalista(solicitudId, seleccion ? Number(seleccion) : null)
      if (!resultado.ok) {
        resultado.errores.forEach(error => toast.error(error))
        return
      }
      toast.success("Analista actualizado")
      setEditando(false)
      router.refresh()
    })

  return (
    <span className="flex flex-wrap items-center gap-2">
      <select
        value={seleccion}
        onChange={e => setSeleccion(e.target.value)}
        disabled={guardando || loading}
        className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
        aria-label="Analista asignado"
      >
        <option value="">Sin analista</option>
        {analistas.map(a => <option key={a.id} value={a.id}>{a.nombreUsuario}</option>)}
      </select>
      <button
        type="button"
        onClick={guardar}
        disabled={guardando}
        className="inline-flex h-8 items-center gap-1.5 rounded-md bg-sky-500 px-3 text-xs font-semibold text-white hover:bg-sky-600 disabled:opacity-50"
      >
        {guardando && <Loader2 size={13} className="animate-spin" />}
        Guardar
      </button>
      <button type="button" onClick={() => setEditando(false)} disabled={guardando} className="p-1 text-slate-400 hover:text-slate-600" aria-label="Cancelar">
        <X size={15} />
      </button>
      {!loading && analistas.length === 0 && (
        <span className="w-full text-[11px] text-amber-700">
          Ningún usuario tiene el rol &quot;Analista de trámites&quot;. Asígnelo en Administración.
        </span>
      )}
    </span>
  )
}
