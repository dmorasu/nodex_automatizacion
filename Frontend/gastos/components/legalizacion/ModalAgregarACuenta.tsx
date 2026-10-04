"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "react-toastify"
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { Loader2 } from "lucide-react"
import { agregarGastosACuenta, crearCuenta } from "@/actions/gastos/legalizacion"
import { formatoMoneda } from "@/src/lib/formato"
import type { CuentaListado, GastoListado } from "@/src/schemas/gastos"
import { claseBotonPrimario, claseBotonSecundario, claseInput, claseLabel } from "../ui/estilos"

// Agrega los gastos seleccionados a una cuenta de cobro en borrador o a una nueva
export default function ModalAgregarACuenta({
  gastos,
  borradores,
  onCerrar
}: {
  gastos: GastoListado[]
  borradores: CuentaListado[]
  onCerrar: () => void
}) {
  const router = useRouter()
  const [destino, setDestino] = useState<"nueva" | number>(borradores[0]?.id ?? "nueva")
  const [numero, setNumero] = useState("")
  const [guardando, startGuardar] = useTransition()

  const total = gastos.reduce((suma, g) => suma + Number(g.factura?.valorLegalizado ?? 0), 0)

  const agregar = () => {
    if (destino === "nueva" && !numero.trim()) return toast.error("Escriba el número de la cuenta de cobro")

    startGuardar(async () => {
      let cuentaId = destino

      if (cuentaId === "nueva") {
        const creada = await crearCuenta({
          numeroCuentaCobro: numero.trim(),
          fechaRadicacion: "",
          observacion: ""
        })

        if (!creada.ok) {
          creada.errores.forEach(error => toast.error(error))
          return
        }
        cuentaId = creada.datos.id
      }

      const resultado = await agregarGastosACuenta(cuentaId, gastos.map(g => g.id))

      if (!resultado.ok) {
        resultado.errores.forEach(error => toast.error(error))
        return
      }

      toast.success(`${gastos.length} gasto(s) agregado(s) a la cuenta de cobro`)
      router.push(`/legalizacion/cuentas/${cuentaId}`)
    })
  }

  return (
    <Dialog open onClose={() => !guardando && onCerrar()} className="relative z-50">
      <div className="fixed inset-0 bg-slate-900/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
          <DialogTitle className="text-sm font-semibold text-slate-800">
            Agregar {gastos.length} gasto(s) a una cuenta de cobro
          </DialogTitle>
          <p className="mt-1 text-xs text-slate-400">Total a legalizar de los seleccionados: {formatoMoneda(total)}</p>

          <div className="mt-5 space-y-3">
            {borradores.map(cuenta => (
              <label key={cuenta.id} className="flex items-center gap-3 rounded-md border border-slate-200 px-3 py-2 text-xs cursor-pointer hover:bg-slate-50">
                <input type="radio" checked={destino === cuenta.id} onChange={() => setDestino(cuenta.id)} className="accent-emerald-600" />
                <span>
                  <b className="text-slate-700">{cuenta.numeroCuentaCobro}</b>
                  <span className="text-slate-400"> · borrador · {cuenta.cantidadGastos} gasto(s) · {formatoMoneda(cuenta.totalLegalizado)}</span>
                </span>
              </label>
            ))}

            <label className="flex items-center gap-3 rounded-md border border-slate-200 px-3 py-2 text-xs cursor-pointer hover:bg-slate-50">
              <input type="radio" checked={destino === "nueva"} onChange={() => setDestino("nueva")} className="accent-emerald-600" />
              <b className="text-slate-700">Nueva cuenta de cobro</b>
            </label>

            {destino === "nueva" && (
              <div className="grid gap-3 pl-7">
                <label className="block">
                  <span className={claseLabel}>Número <span className="text-red-400">*</span></span>
                  <input value={numero} onChange={e => setNumero(e.target.value)} maxLength={50} placeholder="Ej: CC-045" className={claseInput} autoFocus />
                </label>
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={onCerrar} disabled={guardando} className={claseBotonSecundario}>Cancelar</button>
            <button type="button" onClick={agregar} disabled={guardando} className={claseBotonPrimario}>
              {guardando && <Loader2 size={15} className="animate-spin" />}
              Agregar
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
