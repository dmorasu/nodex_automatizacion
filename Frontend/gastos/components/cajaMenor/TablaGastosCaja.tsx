"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "react-toastify"
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { Banknote, FileCheck2, Layers, Loader2, Undo2 } from "lucide-react"
import { crearReembolso, deshacerLegalizacionCaja } from "@/actions/gastos/cajaMenor"
import { formatoFecha, formatoMoneda } from "@/src/lib/formato"
import type { GastoListado } from "@/src/schemas/gastos"
import { claseBotonPrimario, claseBotonSecundario, claseInput, claseLabel } from "../ui/estilos"
import ModalPagarCaja from "./ModalPagarCaja"
import ModalLegalizarCaja from "./ModalLegalizarCaja"

export type VistaCaja = "por-pagar" | "por-legalizar" | "pendientes"

const COLUMNA_VALOR: Record<VistaCaja, string> = {
  "por-pagar": "Solicitado",
  "por-legalizar": "Entregado",
  pendientes: "Soporte"
}

const valorDe = (g: GastoListado, vista: VistaCaja) =>
  vista === "por-pagar" ? g.valorSolicitadoPago : vista === "por-legalizar" ? g.valorRealmentePagado : g.legalizacionCaja?.valorSoporte

// Gastos de una caja según la vista:
//  · por pagar: se marcan varios y se entrega el efectivo;
//  · por legalizar: cada uno se legaliza con su factura y soporte;
//  · pendientes por reembolso: se marcan varios y se arma el reembolso (o se deshace una legalización).
export default function TablaGastosCaja({ bolsaId, vista, gastos, disponible }: {
  bolsaId: number
  vista: VistaCaja
  gastos: GastoListado[]
  disponible: number
}) {
  const router = useRouter()
  const [seleccion, setSeleccion] = useState<number[]>([])
  const [pagando, setPagando] = useState(false)
  const [legalizando, setLegalizando] = useState<GastoListado | null>(null)
  const [armando, setArmando] = useState(false)
  const [observacion, setObservacion] = useState("")
  const [procesando, startProcesar] = useTransition()

  const seleccionable = vista !== "por-legalizar"
  const seleccionados = gastos.filter(g => seleccion.includes(g.id))
  const totalSeleccionado = seleccionados.reduce((t, g) => t + Number(valorDe(g, vista) ?? 0), 0)
  const todos = gastos.length > 0 && seleccion.length === gastos.length
  const alternar = (id: number) => setSeleccion(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  const listo = () => { setSeleccion([]); router.refresh() }

  const deshacer = (g: GastoListado) => {
    if (!confirm(`¿Deshacer la legalización de ${g.codigo}? Vuelve a "entregado sin legalizar" y la diferencia con el soporte se revierte en la caja.`)) return
    startProcesar(async () => {
      const resultado = await deshacerLegalizacionCaja(g.id)
      if (!resultado.ok) return resultado.errores.forEach(e => toast.error(e))
      toast.success("Se deshizo la legalización")
      router.refresh()
    })
  }

  const armarReembolso = () => startProcesar(async () => {
    const resultado = await crearReembolso({ bolsaId, gastoIds: seleccion, observacion: observacion.trim() || null })
    if (!resultado.ok) return resultado.errores.forEach(e => toast.error(e))
    toast.success("Reembolso creado en borrador")
    router.push(`/tesoreria/caja-menor/reembolsos/${resultado.id}`)
  })

  return (
    <div className="space-y-3">
      {seleccionable && seleccion.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2.5">
          <p className="text-xs text-emerald-800">{seleccion.length} seleccionado(s) · {formatoMoneda(totalSeleccionado)}</p>
          {vista === "por-pagar" ? (
            <button type="button" onClick={() => setPagando(true)} className={claseBotonPrimario}>
              <Banknote size={15} /> Entregar efectivo
            </button>
          ) : (
            <button type="button" onClick={() => setArmando(true)} className={claseBotonPrimario}>
              <Layers size={15} /> Armar reembolso
            </button>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              {seleccionable && (
                <th className="w-10 px-4 py-3">
                  <input type="checkbox" checked={todos} onChange={() => setSeleccion(todos ? [] : gastos.map(g => g.id))} className="h-4 w-4 accent-emerald-600" aria-label="Seleccionar todos" />
                </th>
              )}
              <th className="px-4 py-3 font-semibold">Gasto</th>
              <th className="px-4 py-3 font-semibold">Solicitado por</th>
              <th className="px-4 py-3 font-semibold">{vista === "pendientes" ? "Factura" : "Beneficiario"}</th>
              <th className="px-4 py-3 font-semibold">{vista === "por-pagar" ? "Creado" : "Entregado el"}</th>
              <th className="px-4 py-3 text-right font-semibold">{COLUMNA_VALOR[vista]}</th>
              {!seleccionable || vista === "pendientes" ? <th className="w-28 px-4 py-3"><span className="sr-only">Acciones</span></th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {gastos.map(g => (
              <tr key={g.id} className={seleccion.includes(g.id) ? "bg-emerald-50/40" : "hover:bg-slate-50"}>
                {seleccionable && (
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={seleccion.includes(g.id)} onChange={() => alternar(g.id)} className="h-4 w-4 accent-emerald-600" aria-label={`Seleccionar ${g.codigo}`} />
                  </td>
                )}
                <td className="px-4 py-3">
                  <Link href={`/solicitudes/${g.id}`} className="font-semibold text-emerald-700 hover:underline">{g.codigo}</Link>
                  <p className="text-[11px] text-slate-400">{g.conceptoPago}</p>
                </td>
                <td className="px-4 py-3 text-slate-600">{g.creador?.nombreUsuario}</td>
                <td className="px-4 py-3 text-slate-600">
                  {vista === "pendientes" && g.legalizacionCaja ? (
                    <>
                      <p className="font-medium">{g.legalizacionCaja.numeroFactura} · {formatoFecha(g.legalizacionCaja.fechaFactura)}</p>
                      <p className="text-[11px] text-slate-400">{g.legalizacionCaja.beneficiario} · trajo {g.legalizacionCaja.quienLegaliza}</p>
                    </>
                  ) : g.beneficiario.nombre}
                </td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{vista === "por-pagar" ? formatoFecha(g.createdAt.slice(0, 10)) : formatoFecha(g.fechaPago)}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <p className="font-semibold text-slate-800">{formatoMoneda(valorDe(g, vista))}</p>
                  {vista === "pendientes" && g.legalizacionCaja && Number(g.legalizacionCaja.diferencia) !== 0 && (
                    <p className="text-[11px] text-slate-400">entregado {formatoMoneda(g.valorRealmentePagado)}</p>
                  )}
                </td>
                {vista === "por-legalizar" && (
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => setLegalizando(g)} className={`${claseBotonSecundario} h-8 px-3`}>
                      <FileCheck2 size={14} /> Legalizar
                    </button>
                  </td>
                )}
                {vista === "pendientes" && (
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => deshacer(g)} disabled={procesando} className="rounded-md p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600" title="Deshacer legalización" aria-label="Deshacer legalización">
                      <Undo2 size={14} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {gastos.length === 0 && <p className="py-14 text-center text-sm text-slate-400">No hay gastos en esta vista.</p>}
      </div>

      {pagando && <ModalPagarCaja bolsaId={bolsaId} gastos={seleccionados} disponible={disponible} onCerrar={() => setPagando(false)} onPagados={listo} />}
      {legalizando && <ModalLegalizarCaja gasto={legalizando} onCerrar={() => setLegalizando(null)} onLegalizado={() => router.refresh()} />}

      {armando && (
        <Dialog open onClose={() => !procesando && setArmando(false)} className="relative z-50">
          <div className="fixed inset-0 bg-slate-900/30" aria-hidden="true" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <DialogPanel className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
              <DialogTitle className="text-sm font-semibold text-slate-800">Armar reembolso</DialogTitle>
              <p className="mt-1 text-xs text-slate-500">
                {seleccion.length} gasto(s) por {formatoMoneda(totalSeleccionado)}. Queda en borrador hasta que lo envíe a Dirección de Negocio.
              </p>
              <label className="mt-4 block">
                <span className={claseLabel}>Observación</span>
                <input value={observacion} onChange={e => setObservacion(e.target.value)} maxLength={1000} placeholder="Opcional" className={claseInput} />
              </label>
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setArmando(false)} disabled={procesando} className={claseBotonSecundario}>Cancelar</button>
                <button type="button" onClick={armarReembolso} disabled={procesando} className={claseBotonPrimario}>
                  {procesando ? <Loader2 size={15} className="animate-spin" /> : <Layers size={15} />} Crear reembolso
                </button>
              </div>
            </DialogPanel>
          </div>
        </Dialog>
      )}
    </div>
  )
}
