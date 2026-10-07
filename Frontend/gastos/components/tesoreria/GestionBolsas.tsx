"use client"

import { useState, useTransition } from "react"
import { toast } from "react-toastify"
import Link from "next/link"
import { Plus, Pencil, Check, X, Loader2, PlusCircle, SlidersHorizontal, List } from "lucide-react"
import { guardarBolsa } from "@/actions/gastos/bolsas"
import { formatoMoneda } from "@/src/lib/formato"
import type { Bolsa } from "@/src/schemas/gastos"
import { claseBotonPrimario, claseInput } from "../ui/estilos"
import ModalSaldoBolsa from "./ModalSaldoBolsa"

type Edicion = { id?: number, nombre: string, lineaNegocio: string, tipo: string }

export default function GestionBolsas({ bolsas, esAdmin }: { bolsas: Bolsa[], esAdmin: boolean }) {
  // null = sin edición | sin id = bolsa nueva | con id = editando esa bolsa
  const [edicion, setEdicion] = useState<Edicion | null>(null)
  const [movimiento, setMovimiento] = useState<{ bolsa: Bolsa, tipo: "RECARGA" | "AJUSTE" } | null>(null)
  const [guardando, startGuardar] = useTransition()

  const ejecutar = (accion: () => ReturnType<typeof guardarBolsa>, mensaje: string) =>
    startGuardar(async () => {
      const resultado = await accion()

      if (!resultado.ok) {
        resultado.errores.forEach(error => toast.error(error))
        return
      }

      toast.success(mensaje)
      setEdicion(null)
    })

  const guardarEdicion = () => {
    if (!edicion?.nombre.trim()) return toast.error("El nombre de la bolsa es obligatorio")

    const datos = {
      nombre: edicion.nombre.trim(),
      lineaNegocio: edicion.lineaNegocio.trim() || null,
      // El tipo se elige solo al crear la bolsa
      ...(edicion.id ? {} : { tipo: edicion.tipo })
    }
    ejecutar(() => guardarBolsa(datos, edicion.id), edicion.id ? "Bolsa actualizada" : "Bolsa creada")
  }

  const alternarActivo = (bolsa: Bolsa) =>
    ejecutar(
      () => guardarBolsa({ activo: !bolsa.activo }, bolsa.id),
      bolsa.activo ? `Bolsa ${bolsa.nombre} desactivada` : `Bolsa ${bolsa.nombre} activada`
    )

  // Fila editable (nueva o existente)
  const filaEdicion = (clave: string | number) => (
    <tr key={clave} className="bg-emerald-50/40">
      <td className="px-4 py-2">
        <input
          value={edicion?.nombre ?? ""}
          onChange={e => setEdicion(actual => actual && { ...actual, nombre: e.target.value })}
          placeholder="Ej: Bolsa 1301"
          maxLength={100}
          className={claseInput}
          autoFocus
        />
      </td>
      <td className="px-4 py-2">
        <input
          value={edicion?.lineaNegocio ?? ""}
          onChange={e => setEdicion(actual => actual && { ...actual, lineaNegocio: e.target.value })}
          placeholder="Línea de negocio"
          maxLength={100}
          className={claseInput}
        />
      </td>
      <td className="px-4 py-2">
        {edicion?.id ? null : (
          <select
            value={edicion?.tipo ?? "GENERAL"}
            onChange={e => setEdicion(actual => actual && { ...actual, tipo: e.target.value })}
            className={claseInput}
            aria-label="Tipo de bolsa"
          >
            <option value="GENERAL">General</option>
            <option value="ANTICIPOS">Anticipos de clientes</option>
          </select>
        )}
      </td>
      <td colSpan={2} />
      <td className="px-4 py-2 text-right whitespace-nowrap">
        <button type="button" onClick={guardarEdicion} disabled={guardando} className="p-2 text-emerald-600 hover:text-emerald-800" aria-label="Guardar">
          {guardando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
        </button>
        <button type="button" onClick={() => setEdicion(null)} disabled={guardando} className="p-2 text-slate-400 hover:text-slate-600" aria-label="Cancelar">
          <X size={16} />
        </button>
      </td>
    </tr>
  )

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setEdicion({ nombre: "", lineaNegocio: "", tipo: "GENERAL" })}
          disabled={edicion !== null}
          className={claseBotonPrimario}
        >
          <Plus size={15} />
          Nueva bolsa
        </button>
      </div>

      <div className="overflow-x-auto rounded-md border border-slate-200">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Bolsa</th>
              <th className="px-4 py-3 font-semibold">Línea de negocio</th>
              <th className="px-4 py-3 font-semibold">Tipo</th>
              <th className="px-4 py-3 font-semibold text-right">Saldo</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {edicion && !edicion.id && filaEdicion("nueva")}

            {bolsas.map(bolsa =>
              edicion?.id === bolsa.id ? (
                filaEdicion(bolsa.id)
              ) : (
                <tr key={bolsa.id} className={bolsa.activo ? "" : "opacity-50"}>
                  <td className="px-4 py-3 font-medium text-slate-700">{bolsa.nombre}</td>
                  <td className="px-4 py-3 text-slate-600">{bolsa.lineaNegocio ?? "—"}</td>
                  <td className="px-4 py-3">
                    {bolsa.tipo === "ANTICIPOS"
                      ? <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">Anticipos</span>
                      : <span className="text-slate-500">General</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatoMoneda(bolsa.saldoActual)}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => alternarActivo(bolsa)}
                      disabled={guardando || edicion !== null}
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold border ${bolsa.activo ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}
                      title={bolsa.activo ? "Clic para desactivar" : "Clic para activar"}
                    >
                      {bolsa.activo ? "Activa" : "Inactiva"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {/* Las de anticipos se llenan con los anticipos confirmados; sus ajustes son por cliente (en el detalle) */}
                    {bolsa.activo && bolsa.tipo !== "ANTICIPOS" && (
                      <button
                        type="button"
                        onClick={() => setMovimiento({ bolsa, tipo: "RECARGA" })}
                        className="p-2 text-slate-400 hover:text-emerald-600"
                        title="Recargar"
                        aria-label={`Recargar ${bolsa.nombre}`}
                      >
                        <PlusCircle size={15} />
                      </button>
                    )}
                    {esAdmin && bolsa.tipo !== "ANTICIPOS" && (
                      <button
                        type="button"
                        onClick={() => setMovimiento({ bolsa, tipo: "AJUSTE" })}
                        className="p-2 text-slate-400 hover:text-amber-600"
                        title="Ajustar saldo"
                        aria-label={`Ajustar saldo de ${bolsa.nombre}`}
                      >
                        <SlidersHorizontal size={15} />
                      </button>
                    )}
                    <Link
                      href={`/tesoreria/bolsas/${bolsa.id}`}
                      className="inline-block p-2 text-slate-400 hover:text-emerald-600"
                      title={bolsa.tipo === "ANTICIPOS" ? "Ver movimientos y saldos por cliente" : "Ver movimientos"}
                      aria-label={`Movimientos de ${bolsa.nombre}`}
                    >
                      <List size={15} />
                    </Link>
                    <button
                      type="button"
                      title="Editar"
                      onClick={() => setEdicion({ id: bolsa.id, nombre: bolsa.nombre, lineaNegocio: bolsa.lineaNegocio ?? "", tipo: bolsa.tipo })}
                      disabled={edicion !== null}
                      className="p-2 text-slate-400 hover:text-emerald-600 disabled:opacity-30"
                      aria-label={`Editar ${bolsa.nombre}`}
                    >
                      <Pencil size={15} />
                    </button>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>

        {bolsas.length === 0 && !edicion && (
          <p className="py-10 text-center text-xs text-slate-400">Aún no hay bolsas. Cree la primera con “Nueva bolsa”.</p>
        )}
      </div>

      {movimiento && (
        <ModalSaldoBolsa bolsa={movimiento.bolsa} tipo={movimiento.tipo} onCerrar={() => setMovimiento(null)} />
      )}
    </div>
  )
}
