"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "react-toastify"
import clsx from "clsx"
import { Check, Loader2, Pencil, Plus, Power, UserMinus, UserPlus, X } from "lucide-react"
import { asignarCaja, guardarCaja } from "@/actions/gastos/cajaMenor"
import { formatoMoneda } from "@/src/lib/formato"
import type { ResumenCaja, UsuariosCaja } from "@/src/schemas/gastos"
import Seccion from "../ui/Seccion"
import { claseBotonPrimario, claseBotonSecundario, claseInput, claseLabel } from "../ui/estilos"

type Edicion = { id?: number, nombre: string, fondo: string, topeAlerta: string }

const sinTildes = (texto: string) => texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

// Cajas menores (nombre, fondo fijo y tope de alerta) y la caja que maneja cada Auxiliar de
// Tesorería - Caja menor (solo ve, paga y legaliza esa caja)
export default function ConfiguracionCajas({ cajas, usuarios }: { cajas: ResumenCaja[], usuarios: UsuariosCaja }) {
  const router = useRouter()
  const [edicion, setEdicion] = useState<Edicion | null>(null)
  const [procesando, startProcesar] = useTransition()
  const [busqueda, setBusqueda] = useState("")
  const [usuarioId, setUsuarioId] = useState<number | null>(null)
  const [cajaId, setCajaId] = useState<number | null>(cajas.find(c => c.activo)?.id ?? null)

  const ejecutar = (accion: () => Promise<{ ok: true } | { ok: false, errores: string[] }>, exito: string, despues?: () => void) =>
    startProcesar(async () => {
      const resultado = await accion()
      if (!resultado.ok) return resultado.errores.forEach(e => toast.error(e))
      toast.success(exito)
      despues?.()
      router.refresh()
    })

  const guardar = () => {
    if (!edicion) return
    if (!edicion.nombre.trim()) return toast.error("Escriba el nombre de la caja")
    if (!(Number(edicion.fondo) > 0)) return toast.error("El fondo debe ser mayor a cero")
    if (!(Number(edicion.topeAlerta) >= 0)) return toast.error("El tope de alerta no es válido")
    ejecutar(
      () => guardarCaja({ nombre: edicion.nombre.trim(), fondo: Number(edicion.fondo), topeAlerta: Number(edicion.topeAlerta) }, edicion.id),
      edicion.id ? "Caja actualizada" : "Caja creada",
      () => setEdicion(null)
    )
  }

  const nombreUsuario = useMemo(() => new Map(usuarios.usuarios.map(u => [u.id, u.nombreUsuario])), [usuarios])
  const cajaDe = useMemo(() => new Map(usuarios.asignaciones.map(a => [a.usuarioId, a.bolsaId])), [usuarios])
  const sugerencias = busqueda.trim().length >= 2
    ? usuarios.usuarios.filter(u => sinTildes(`${u.nombreUsuario} ${u.correoUsuario}`).includes(sinTildes(busqueda.trim()))).slice(0, 8)
    : []

  const asignar = () => {
    if (!usuarioId || !cajaId) return toast.error("Elija el usuario y la caja")
    ejecutar(() => asignarCaja(usuarioId, cajaId), "Caja asignada", () => { setUsuarioId(null); setBusqueda("") })
  }

  const filaEdicion = (
    <div className="grid gap-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 sm:grid-cols-4 sm:items-end">
      <label className="block">
        <span className={claseLabel}>Nombre</span>
        <input value={edicion?.nombre ?? ""} onChange={e => setEdicion(d => d && { ...d, nombre: e.target.value })} maxLength={100} placeholder="Caja menor Medellín" className={claseInput} />
      </label>
      <label className="block">
        <span className={claseLabel}>Fondo asignado</span>
        <input type="number" min={0} step="1000" value={edicion?.fondo ?? ""} onChange={e => setEdicion(d => d && { ...d, fondo: e.target.value })} className={claseInput} />
      </label>
      <label className="block">
        <span className={claseLabel}>Tope de alerta</span>
        <input type="number" min={0} step="1000" value={edicion?.topeAlerta ?? ""} onChange={e => setEdicion(d => d && { ...d, topeAlerta: e.target.value })} className={claseInput} />
      </label>
      <div className="flex gap-2">
        <button type="button" onClick={guardar} disabled={procesando} className={claseBotonPrimario}>
          {procesando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Guardar
        </button>
        <button type="button" onClick={() => setEdicion(null)} disabled={procesando} className={`${claseBotonSecundario} px-3`} aria-label="Cancelar"><X size={14} /></button>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <Seccion
        titulo="Cajas"
        acciones={!edicion && (
          <button type="button" onClick={() => setEdicion({ nombre: "", fondo: "15000000", topeAlerta: "400000" })} className={claseBotonPrimario}>
            <Plus size={15} /> Nueva caja
          </button>
        )}
      >
        <div className="space-y-3">
          {edicion && !edicion.id && filaEdicion}
          {cajas.map(c => edicion?.id === c.id ? <div key={c.id}>{filaEdicion}</div> : (
            <div key={c.id} className={clsx("flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-3", !c.activo && "opacity-60")}>
              <div>
                <p className="text-sm font-semibold text-slate-800">{c.nombre} {!c.activo && <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-px text-[10px] font-normal text-slate-500">Inactiva</span>}</p>
                <p className="text-xs text-slate-500">
                  Fondo {formatoMoneda(c.fondo)} · disponible {formatoMoneda(c.saldo)} · tope {formatoMoneda(c.topeAlerta)}
                </p>
              </div>
              <div className="flex gap-1">
                <button type="button" onClick={() => setEdicion({ id: c.id, nombre: c.nombre, fondo: String(c.fondo), topeAlerta: String(c.topeAlerta) })} className="rounded-md p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600" title="Editar" aria-label="Editar">
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => ejecutar(() => guardarCaja({ activo: !c.activo }, c.id), c.activo ? "Caja desactivada" : "Caja activada")}
                  disabled={procesando}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600"
                  title={c.activo ? "Desactivar" : "Activar"}
                  aria-label={c.activo ? "Desactivar" : "Activar"}
                >
                  <Power size={14} />
                </button>
              </div>
            </div>
          ))}
          {cajas.length === 0 && !edicion && <p className="py-6 text-center text-sm text-slate-400">No hay cajas menores todavía.</p>}
        </div>
      </Seccion>

      <Seccion titulo="Auxiliares de cada caja">
        <div className="grid gap-3 sm:grid-cols-[1fr_220px_auto] sm:items-end">
          <div className="relative">
            <span className={claseLabel}>Auxiliar</span>
            <input
              value={usuarioId ? nombreUsuario.get(usuarioId) ?? "" : busqueda}
              onChange={e => { setUsuarioId(null); setBusqueda(e.target.value) }}
              placeholder="Buscar por nombre o correo"
              className={claseInput}
            />
            {!usuarioId && sugerencias.length > 0 && (
              <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
                {sugerencias.map(u => (
                  <li key={u.id}>
                    <button type="button" onClick={() => setUsuarioId(u.id)} className="w-full px-3 py-2 text-left text-xs hover:bg-emerald-50">
                      <span className="font-medium text-slate-700">{u.nombreUsuario}</span>
                      <span className="ml-2 text-slate-400">{u.correoUsuario}</span>
                      {cajaDe.has(u.id) && <span className="ml-2 text-amber-700">· ya en {cajas.find(c => c.id === cajaDe.get(u.id))?.nombre}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <label className="block">
            <span className={claseLabel}>Caja</span>
            <select value={cajaId ?? ""} onChange={e => setCajaId(Number(e.target.value) || null)} className={claseInput}>
              {cajas.filter(c => c.activo).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </label>
          <button type="button" onClick={asignar} disabled={procesando || !usuarioId} className={claseBotonPrimario}>
            <UserPlus size={15} /> Asignar
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {cajas.map(c => {
            const asignados = usuarios.asignaciones.filter(a => a.bolsaId === c.id)
            return (
              <div key={c.id} className="rounded-lg border border-slate-200">
                <p className="border-b border-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{c.nombre} · {asignados.length}</p>
                <ul className="divide-y divide-slate-100">
                  {asignados.map(a => (
                    <li key={a.usuarioId} className="flex items-center justify-between px-3 py-1.5 text-xs text-slate-700">
                      {nombreUsuario.get(a.usuarioId) ?? `Usuario ${a.usuarioId}`}
                      <button
                        type="button"
                        onClick={() => ejecutar(() => asignarCaja(a.usuarioId, null), "Caja quitada")}
                        disabled={procesando}
                        className="rounded-md p-1 text-slate-300 hover:bg-red-50 hover:text-red-600"
                        title="Quitar de la caja"
                        aria-label="Quitar de la caja"
                      >
                        <UserMinus size={14} />
                      </button>
                    </li>
                  ))}
                  {asignados.length === 0 && <li className="px-3 py-3 text-[11px] text-slate-400">Sin usuarios.</li>}
                </ul>
              </div>
            )
          })}
        </div>
      </Seccion>
    </div>
  )
}
