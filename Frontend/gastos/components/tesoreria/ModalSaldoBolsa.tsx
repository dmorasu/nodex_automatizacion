"use client"

import { useState, useTransition } from "react"
import { toast } from "react-toastify"
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { Loader2 } from "lucide-react"
import { moverSaldoBolsa } from "@/actions/gastos/tesoreria"
import { formatoMoneda } from "@/src/lib/formato"
import type { Bolsa } from "@/src/schemas/gastos"
import { claseBotonPrimario, claseBotonSecundario, claseInput, claseLabel, claseTextarea } from "../ui/estilos"

// RECARGA: suma saldo (Tesorería) | AJUSTE: suma o resta con motivo obligatorio (Admin).
// En una bolsa de anticipos el ajuste es al saldo de un cliente (`cliente`)
export default function ModalSaldoBolsa({
  bolsa,
  tipo,
  cliente,
  onCerrar
}: {
  bolsa: Pick<Bolsa, "id" | "nombre" | "saldoActual">
  tipo: "RECARGA" | "AJUSTE"
  cliente?: { id: number, nombre: string, saldo: number }
  onCerrar: () => void
}) {
  const [valor, setValor] = useState("")
  const [observacion, setObservacion] = useState("")
  const [guardando, startGuardar] = useTransition()

  const esAjuste = tipo === "AJUSTE"
  const numero = Number(valor)
  const saldoNuevo = Number(bolsa.saldoActual) + (Number.isFinite(numero) ? numero : 0)

  const guardar = () => {
    if (!numero || (!esAjuste && numero < 0)) return toast.error(esAjuste ? "El ajuste no puede ser cero" : "La recarga debe ser mayor a cero")
    if (esAjuste && !observacion.trim()) return toast.error("Explique el motivo del ajuste")

    startGuardar(async () => {
      const resultado = await moverSaldoBolsa(bolsa.id, tipo, numero, observacion.trim(), cliente?.id)

      if (!resultado.ok) {
        resultado.errores.forEach(error => toast.error(error))
        return
      }

      toast.success(`Nuevo saldo de ${bolsa.nombre}: ${formatoMoneda(resultado.datos.saldo)}`)
      onCerrar()
    })
  }

  return (
    <Dialog open onClose={() => !guardando && onCerrar()} className="relative z-50">
      <div className="fixed inset-0 bg-slate-900/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
          <DialogTitle className="text-sm font-semibold text-slate-800">
            {esAjuste ? "Ajustar saldo" : "Recargar"} · {bolsa.nombre}
          </DialogTitle>
          <p className="mt-1 text-xs text-slate-400">
            {cliente
              ? <>Cliente <b className="text-slate-600">{cliente.nombre}</b>: saldo {formatoMoneda(cliente.saldo)} (bolsa {formatoMoneda(bolsa.saldoActual)}).</>
              : <>Saldo actual {formatoMoneda(bolsa.saldoActual)}.</>}
            {esAjuste && " Use un valor negativo para restar."}
          </p>

          <div className="mt-4 space-y-4">
            <label className="block">
              <span className={claseLabel}>Valor</span>
              <input
                type="number"
                step="0.01"
                min={esAjuste ? undefined : 0}
                value={valor}
                onChange={e => setValor(e.target.value)}
                className={claseInput}
                autoFocus
              />
            </label>

            <label className="block">
              <span className={claseLabel}>
                {esAjuste ? <>Motivo <span className="text-red-400">*</span></> : "Observación"}
              </span>
              <textarea value={observacion} onChange={e => setObservacion(e.target.value)} rows={2} maxLength={1000} className={claseTextarea} />
            </label>

            <p className="text-xs text-slate-500">
              Saldo de la bolsa después: <b className={saldoNuevo < 0 ? "text-red-600" : "text-slate-800"}>{formatoMoneda(saldoNuevo)}</b>
              {cliente && <> · del cliente: <b>{formatoMoneda(cliente.saldo + (Number.isFinite(numero) ? numero : 0))}</b></>}
            </p>
          </div>

          <div className="mt-5 flex justify-end gap-3">
            <button type="button" onClick={onCerrar} disabled={guardando} className={claseBotonSecundario}>Cancelar</button>
            <button type="button" onClick={guardar} disabled={guardando} className={claseBotonPrimario}>
              {guardando && <Loader2 size={15} className="animate-spin" />}
              {esAjuste ? "Registrar ajuste" : "Recargar"}
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
