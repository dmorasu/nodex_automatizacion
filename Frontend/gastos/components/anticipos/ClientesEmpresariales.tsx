"use client"

import { useState, useTransition } from "react"
import { toast } from "react-toastify"
import { Check, Loader2, Pencil, Plus, X } from "lucide-react"
import { guardarClienteEmpresarial } from "@/actions/gastos/anticipos"
import type { ClienteEmpresarial } from "@/src/schemas/gastos"
import { claseBotonPrimario, claseInput } from "../ui/estilos"

// Catálogo de clientes empresariales (ej: Davivienda) que se eligen al registrar un anticipo
export default function ClientesEmpresariales({ clientes }: { clientes: ClienteEmpresarial[] }) {
  // null = sin edición | id 0 = nuevo | id = editando
  const [edicion, setEdicion] = useState<{ id: number, nombre: string } | null>(null)
  const [guardando, startGuardar] = useTransition()

  const ejecutar = (accion: () => ReturnType<typeof guardarClienteEmpresarial>, mensaje: string) =>
    startGuardar(async () => {
      const resultado = await accion()
      if (!resultado.ok) {
        resultado.errores.forEach(error => toast.error(error))
        return
      }
      toast.success(mensaje)
      setEdicion(null)
    })

  const guardar = () => {
    if (!edicion?.nombre.trim()) return toast.error("Escriba el nombre")
    ejecutar(
      () => guardarClienteEmpresarial({ nombre: edicion.nombre.trim() }, edicion.id || undefined),
      edicion.id ? "Cliente empresarial actualizado" : "Cliente empresarial creado"
    )
  }

  const fila = (clave: string | number) => (
    <li key={clave} className="flex items-center gap-2 bg-emerald-50/40 px-4 py-2">
      <input
        value={edicion?.nombre ?? ""}
        onChange={e => setEdicion(actual => actual && { ...actual, nombre: e.target.value })}
        onKeyDown={e => e.key === "Enter" && guardar()}
        placeholder="Ej: Davivienda"
        maxLength={150}
        className={claseInput}
        autoFocus
      />
      <button type="button" onClick={guardar} disabled={guardando} className="p-2 text-emerald-600 hover:text-emerald-800" aria-label="Guardar">
        {guardando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
      </button>
      <button type="button" onClick={() => setEdicion(null)} disabled={guardando} className="p-2 text-slate-400 hover:text-slate-600" aria-label="Cancelar">
        <X size={16} />
      </button>
    </li>
  )

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">Se eligen al registrar un anticipo. Los inactivos no aparecen en el formulario.</p>
        <button type="button" onClick={() => setEdicion({ id: 0, nombre: "" })} disabled={edicion !== null} className={claseBotonPrimario}>
          <Plus size={15} />
          Nuevo
        </button>
      </div>

      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
        {edicion?.id === 0 && fila("nuevo")}
        {clientes.map(cliente => edicion?.id === cliente.id ? fila(cliente.id) : (
          <li key={cliente.id} className={`flex items-center justify-between gap-3 px-4 py-3 text-xs ${cliente.activo === false ? "opacity-50" : ""}`}>
            <span className="font-medium text-slate-700">{cliente.nombre}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => ejecutar(() => guardarClienteEmpresarial({ activo: cliente.activo === false }, cliente.id), cliente.activo === false ? "Activado" : "Desactivado")}
                disabled={guardando || edicion !== null}
                className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cliente.activo === false ? "border-slate-200 bg-slate-50 text-slate-500" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}
                title={cliente.activo === false ? "Clic para activar" : "Clic para desactivar"}
              >
                {cliente.activo === false ? "Inactivo" : "Activo"}
              </button>
              <button
                type="button"
                onClick={() => setEdicion({ id: cliente.id, nombre: cliente.nombre })}
                disabled={edicion !== null}
                className="p-2 text-slate-400 hover:text-emerald-600 disabled:opacity-30"
                aria-label={`Editar ${cliente.nombre}`}
              >
                <Pencil size={15} />
              </button>
            </div>
          </li>
        ))}
        {clientes.length === 0 && edicion === null && (
          <li className="py-10 text-center text-xs text-slate-400">Aún no hay clientes empresariales. Cree el primero con “Nuevo”.</li>
        )}
      </ul>
    </div>
  )
}
