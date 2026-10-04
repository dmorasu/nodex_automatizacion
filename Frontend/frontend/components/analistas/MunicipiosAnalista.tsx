"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "react-toastify"
import { ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react"
import { asignarAnalistaMunicipios } from "@/actions/analistas-action"
import type { Analista } from "@/hooks/useAnalistas"

export type MunicipioAnalista = {
  id: number
  nombreMunicipio: string
  departamento: string | null
  analistaId: number | null
  nombreAnalista: string | null
}

const claseInput = "h-10 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"

// Municipios con su analista por defecto. Se seleccionan varios y se les asigna un analista.
export default function MunicipiosAnalista({ analistas, municipios, total, pagina, paginas, filtros }: {
  analistas: Analista[]
  municipios: MunicipioAnalista[]
  total: number
  pagina: number
  paginas: number
  filtros: { busqueda: string, analistaId: string }
}) {
  const router = useRouter()
  const [seleccion, setSeleccion] = useState<number[]>([])
  const [analistaNuevo, setAnalistaNuevo] = useState("")
  const [guardando, start] = useTransition()

  const todos = municipios.length > 0 && municipios.every(m => seleccion.includes(m.id))
  const alternar = (id: number) =>
    setSeleccion(actual => (actual.includes(id) ? actual.filter(x => x !== id) : [...actual, id]))

  const enlacePagina = (numero: number) => {
    const consulta = new URLSearchParams()
    if (filtros.busqueda) consulta.set("busqueda", filtros.busqueda)
    if (filtros.analistaId) consulta.set("analistaId", filtros.analistaId)
    consulta.set("pagina", String(numero))
    return `/center/analistas?${consulta}`
  }

  const asignar = () => {
    if (seleccion.length === 0) return toast.error("Seleccione al menos un municipio")
    if (!analistaNuevo) return toast.error("Elija el analista")

    start(async () => {
      const resultado = await asignarAnalistaMunicipios(seleccion, analistaNuevo === "sin" ? null : Number(analistaNuevo))
      if (!resultado.ok) {
        resultado.errores.forEach(error => toast.error(error))
        return
      }
      toast.success(`${resultado.datos.actualizados} municipio(s) actualizado(s)`)
      setSeleccion([])
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      {/* FILTROS (formulario GET: quedan en la URL) */}
      <form className="flex flex-wrap gap-3" action="/center/analistas">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
          <input name="busqueda" defaultValue={filtros.busqueda} placeholder="Municipio o departamento" className={`${claseInput} w-full pl-9`} aria-label="Buscar municipio" />
        </div>
        <select name="analistaId" defaultValue={filtros.analistaId} className={claseInput} aria-label="Filtrar por analista">
          <option value="">Todos los analistas</option>
          <option value="sin">Sin analista</option>
          {analistas.map(a => <option key={a.id} value={a.id}>{a.nombreUsuario}</option>)}
        </select>
        <button type="submit" className="h-10 rounded-md border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50">
          Filtrar
        </button>
      </form>

      {/* ACCIÓN SOBRE LA SELECCIÓN */}
      {seleccion.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2.5 text-xs text-sky-800">
          <span className="font-semibold">{seleccion.length} seleccionado(s)</span>
          <select value={analistaNuevo} onChange={e => setAnalistaNuevo(e.target.value)} disabled={guardando} className={`${claseInput} h-8`} aria-label="Analista para los municipios seleccionados">
            <option value="">Asignar a…</option>
            {analistas.map(a => <option key={a.id} value={a.id}>{a.nombreUsuario}</option>)}
            <option value="sin">Sin analista</option>
          </select>
          <button type="button" onClick={asignar} disabled={guardando} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-sky-500 px-3 font-semibold text-white hover:bg-sky-600 disabled:opacity-50">
            {guardando && <Loader2 size={13} className="animate-spin" />}
            Asignar
          </button>
          <button type="button" onClick={() => setSeleccion([])} className="font-medium hover:underline">Quitar selección</button>
        </div>
      )}

      {/* TABLA */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={todos}
                  onChange={() => setSeleccion(todos ? [] : municipios.map(m => m.id))}
                  className="h-4 w-4 accent-sky-500"
                  aria-label="Seleccionar todos los de esta página"
                />
              </th>
              <th className="px-4 py-3 font-semibold">Municipio</th>
              <th className="px-4 py-3 font-semibold">Departamento</th>
              <th className="px-4 py-3 font-semibold">Analista por defecto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {municipios.map(m => (
              <tr key={m.id} className={seleccion.includes(m.id) ? "bg-sky-50/50" : undefined}>
                <td className="px-4 py-2.5">
                  <input type="checkbox" checked={seleccion.includes(m.id)} onChange={() => alternar(m.id)} className="h-4 w-4 accent-sky-500" aria-label={`Seleccionar ${m.nombreMunicipio}`} />
                </td>
                <td className="px-4 py-2.5 font-medium text-slate-700">{m.nombreMunicipio}</td>
                <td className="px-4 py-2.5 text-slate-500">{m.departamento ?? "—"}</td>
                <td className="px-4 py-2.5 text-slate-700">{m.nombreAnalista ?? <span className="text-amber-700">Sin analista</span>}</td>
              </tr>
            ))}
            {municipios.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">No hay municipios con esos filtros.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINACIÓN */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{total.toLocaleString("es-CO")} municipio(s)</span>
        <div className="flex items-center gap-2">
          {pagina > 1 && (
            <Link href={enlacePagina(pagina - 1)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white hover:bg-slate-50" aria-label="Página anterior">
              <ChevronLeft size={15} />
            </Link>
          )}
          <span>Página {pagina} de {paginas}</span>
          {pagina < paginas && (
            <Link href={enlacePagina(pagina + 1)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white hover:bg-slate-50" aria-label="Página siguiente">
              <ChevronRight size={15} />
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
