"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CheckCircle2 } from "lucide-react"
import { formatoFecha, formatoMoneda } from "@/src/lib/formato"
import { ESTADOS_LOTE, type LoteListado } from "@/src/schemas/gastos"
import EstadoGasto from "../gastos/EstadoGasto"
import { claseBotonPrimario } from "../ui/estilos"
import ModalConfirmarLotes from "./ModalConfirmarLotes"

// Cuántos códigos de gasto se muestran por lote antes de resumir con "+N"
const GASTOS_VISIBLES = 3

// Tabla de lotes de pago. Con `confirmables` (Tesorería → Programados) los lotes aprobados por
// Dirección se pueden marcar y confirmar juntos con el mismo soporte del banco.
export default function TablaLotes({
  registros,
  estado,
  rutaDetalle,
  vacio,
  confirmables = false
}: {
  registros: LoteListado[]
  estado: string
  rutaDetalle: string
  vacio: string
  confirmables?: boolean
}) {
  const router = useRouter()
  const [seleccion, setSeleccion] = useState<number[]>([])
  const [confirmando, setConfirmando] = useState(false)

  const variosEstados = estado.includes(",")
  const aprobados = confirmables ? registros.filter(l => l.estado === "APROBADO") : []
  const seleccionados = aprobados.filter(l => seleccion.includes(l.id))
  const todos = aprobados.length > 0 && seleccionados.length === aprobados.length
  const alternar = (id: number) => setSeleccion(actual => actual.includes(id) ? actual.filter(x => x !== id) : [...actual, id])

  return (
    <div className="space-y-3">
      {confirmables && aprobados.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2.5">
          <p className="text-xs text-emerald-800">
            {seleccionados.length
              ? `${seleccionados.length} lote(s) seleccionado(s) · ${formatoMoneda(seleccionados.reduce((t, l) => t + Number(l.total), 0))}`
              : `${aprobados.length} lote(s) aprobado(s) por Dirección: márquelos para adjuntar el soporte del banco y confirmar el pago.`}
          </p>
          <button type="button" onClick={() => setConfirmando(true)} disabled={!seleccionados.length} className={claseBotonPrimario}>
            <CheckCircle2 size={15} />
            Confirmar pago
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              {confirmables && (
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={todos}
                    disabled={!aprobados.length}
                    onChange={() => setSeleccion(todos ? [] : aprobados.map(l => l.id))}
                    className="h-4 w-4 accent-emerald-600"
                    aria-label="Seleccionar todos los aprobados"
                  />
                </th>
              )}
              <th className="px-4 py-3 font-semibold">Lote</th>
              {variosEstados && <th className="px-4 py-3 font-semibold">Estado</th>}
              <th className="px-4 py-3 font-semibold">Gastos</th>
              <th className="px-4 py-3 font-semibold">{estado === "PAGADO" ? "Fecha de pago" : "Fecha"}</th>
              <th className="px-4 py-3 font-semibold">Bolsa</th>
              <th className="px-4 py-3 font-semibold">Programado por</th>
              <th className="px-4 py-3 font-semibold text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {registros.map(lote => {
              const aprobado = lote.estado === "APROBADO"
              return (
                <tr key={lote.id} className={`align-top ${seleccion.includes(lote.id) ? "bg-emerald-50/40" : "hover:bg-slate-50"}`}>
                  {confirmables && (
                    <td className="px-4 py-3">
                      {aprobado && (
                        <input
                          type="checkbox"
                          checked={seleccion.includes(lote.id)}
                          onChange={() => alternar(lote.id)}
                          className="h-4 w-4 accent-emerald-600"
                          aria-label={`Seleccionar lote #${lote.id}`}
                        />
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <Link href={`${rutaDetalle}/${lote.id}`} className="font-semibold text-emerald-700 hover:underline">#{lote.id}</Link>
                  </td>
                  {variosEstados && (
                    <td className="px-4 py-3"><EstadoGasto codigo={lote.estado} nombre={ESTADOS_LOTE[lote.estado] ?? lote.estado} /></td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-x-2 gap-y-1">
                      {lote.gastos.slice(0, GASTOS_VISIBLES).map(gasto => (
                        <Link key={gasto.id} href={`/solicitudes/${gasto.id}`} className="text-emerald-700 hover:underline whitespace-nowrap">
                          {gasto.codigo}
                        </Link>
                      ))}
                      {lote.gastos.length > GASTOS_VISIBLES && (
                        <Link href={`${rutaDetalle}/${lote.id}`} className="text-slate-400 hover:text-slate-600 whitespace-nowrap">
                          +{lote.gastos.length - GASTOS_VISIBLES} más
                        </Link>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatoFecha(lote.fechaPago)}</td>
                  <td className="px-4 py-3 text-slate-600">{lote.bolsa.nombre}</td>
                  <td className="px-4 py-3 text-slate-600">{lote.creador?.nombreUsuario}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800 whitespace-nowrap">{formatoMoneda(lote.total)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {registros.length === 0 && <p className="py-14 text-center text-sm text-slate-400">{vacio}</p>}
      </div>

      {confirmando && (
        <ModalConfirmarLotes
          lotes={seleccionados}
          onCerrar={() => setConfirmando(false)}
          onConfirmados={() => { setSeleccion([]); router.refresh() }}
        />
      )}
    </div>
  )
}
