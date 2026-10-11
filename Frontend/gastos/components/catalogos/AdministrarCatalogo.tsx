"use client"

import { FormEvent, useState, useTransition } from "react"
import { toast } from "react-toastify"
import clsx from "clsx"
import { Check, Loader2, Pencil, Plus, Power, Search, Trash2, X } from "lucide-react"
import { eliminarDeCatalogo, guardarEnCatalogo } from "@/actions/gastos/catalogos"
import type { RegistroCatalogo } from "@/src/schemas/admin"
import { claseBotonPrimario, claseBotonSecundario, claseInput } from "../ui/estilos"

const sinTildes = (texto: string) => texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

function FormularioNombre({ inicial = "", onGuardar, onCancelar }: {
  inicial?: string
  onGuardar: (nombre: string) => Promise<boolean>
  onCancelar: () => void
}) {
  const [guardando, setGuardando] = useState(false)

  const enviar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const nombre = String(new FormData(e.currentTarget).get("nombre") ?? "").trim()
    if (!nombre) return
    setGuardando(true)
    const ok = await onGuardar(nombre)
    setGuardando(false)
    if (ok) onCancelar()
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input name="nombre" defaultValue={inicial} placeholder="Nombre" aria-label="Nombre" maxLength={100} required autoFocus className={clsx(claseInput, "h-9 sm:flex-1")} />
      <div className="flex gap-2">
        <button type="submit" disabled={guardando} className={`${claseBotonPrimario} h-9`}>
          {guardando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Guardar
        </button>
        <button type="button" onClick={onCancelar} disabled={guardando} className={`${claseBotonSecundario} h-9 px-3`} aria-label="Cancelar">
          <X size={14} />
        </button>
      </div>
    </form>
  )
}

const claseIcono = "rounded-md p-1.5 text-slate-400 transition disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"

// Un catálogo de Nodex Gastos: crear, renombrar, activar o desactivar y eliminar lo que no se usa.
// Lo que usa el sistema no se elimina; lo que está en uso se desactiva en lugar de eliminarse.
export default function AdministrarCatalogo({
  catalogo,
  textoNuevo,
  uso: [usoUno, usoVarios],
  permiteCrear,
  registros
}: {
  catalogo: string
  textoNuevo: string
  uso: readonly [string, string]
  permiteCrear: boolean
  registros: RegistroCatalogo[]
}) {
  const [filtro, setFiltro] = useState("")
  const [creando, setCreando] = useState(false)
  const [editando, setEditando] = useState<number | null>(null)
  const [ocupado, startOcupado] = useTransition()

  const usoTexto = (n: number) => (n === 0 ? "Sin uso" : `${n.toLocaleString("es-CO")} ${n === 1 ? usoUno : usoVarios}`)

  const guardar = async (datos: { nombre?: string, activo?: boolean }, id?: number) => {
    const resultado = await guardarEnCatalogo(catalogo, datos, id)
    if (!resultado.ok) {
      resultado.errores.forEach(error => toast.error(error))
      return false
    }
    toast.success(id ? "Cambios guardados" : "Registro creado")
    return true
  }

  const alternarActivo = (registro: RegistroCatalogo) =>
    startOcupado(async () => { await guardar({ activo: !registro.activo }, registro.id) })

  const eliminar = (registro: RegistroCatalogo) => {
    if (!confirm(`¿Eliminar "${registro.nombre}"?`)) return
    startOcupado(async () => {
      const resultado = await eliminarDeCatalogo(catalogo, registro.id)
      if (!resultado.ok) return resultado.errores.forEach(error => toast.error(error))
      toast.success("Registro eliminado")
    })
  }

  const visibles = registros.filter(r => sinTildes(r.nombre).includes(sinTildes(filtro.trim())))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
          <input value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="Buscar..." aria-label="Buscar" className={`${claseInput} h-9 pl-9`} />
        </div>
        {permiteCrear && !creando && (
          <button type="button" onClick={() => { setCreando(true); setEditando(null) }} className={`${claseBotonPrimario} h-9`}>
            <Plus size={15} /> {textoNuevo}
          </button>
        )}
      </div>

      {creando && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
          <p className="mb-2 text-xs font-semibold text-emerald-800">{textoNuevo}</p>
          <FormularioNombre onGuardar={nombre => guardar({ nombre })} onCancelar={() => setCreando(false)} />
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Nombre</th>
              <th className="hidden px-4 py-3 font-semibold sm:table-cell">Uso</th>
              <th className="w-28 px-4 py-3"><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibles.map(r => (
              <tr key={r.id} className={clsx("hover:bg-slate-50/70", !r.activo && "bg-slate-50/50")}>
                {editando === r.id ? (
                  <td colSpan={3} className="px-4 py-2.5">
                    <FormularioNombre inicial={r.nombre} onGuardar={nombre => guardar({ nombre }, r.id)} onCancelar={() => setEditando(null)} />
                  </td>
                ) : (
                  <>
                    <td className="px-4 py-2.5">
                      <span className={clsx("font-medium", r.activo ? "text-slate-700" : "text-slate-400 line-through")}>{r.nombre}</span>
                      {!r.activo && <span className="ml-2 rounded-full bg-slate-100 px-1.5 py-px text-[10px] text-slate-500">Inactivo</span>}
                    </td>
                    <td className="hidden px-4 py-2.5 text-slate-500 sm:table-cell">{usoTexto(r.uso)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        <button type="button" onClick={() => { setEditando(r.id); setCreando(false) }} className={`${claseIcono} hover:bg-emerald-50 hover:text-emerald-600`} aria-label="Renombrar" title="Renombrar">
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => alternarActivo(r)}
                          // Lo que usa el sistema no se desactiva (los tipos de gasto sí)
                          disabled={ocupado || (r.activo && r.delSistema && catalogo !== "tiposGasto")}
                          className={`${claseIcono} hover:bg-amber-50 hover:text-amber-600`}
                          aria-label={r.activo ? "Desactivar" : "Activar"}
                          title={r.activo ? "Desactivar" : "Activar"}
                        >
                          <Power size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => eliminar(r)}
                          disabled={ocupado || r.uso > 0 || r.delSistema}
                          className={`${claseIcono} hover:bg-red-50 hover:text-red-600`}
                          aria-label="Eliminar"
                          title={r.delSistema ? "Lo usa el sistema" : r.uso > 0 ? `En uso: ${usoTexto(r.uso)}` : "Eliminar"}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {visibles.length === 0 && (
          <p className="py-12 text-center text-sm text-slate-400">
            {filtro.trim() ? "Nada coincide con la búsqueda." : "No hay registros todavía."}
          </p>
        )}
      </div>
    </div>
  )
}
