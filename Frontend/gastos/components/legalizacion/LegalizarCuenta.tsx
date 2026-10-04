"use client"

import { useState, useTransition } from "react"
import { toast } from "react-toastify"
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { CheckCircle2, Loader2 } from "lucide-react"
import { legalizarCuenta } from "@/actions/gastos/legalizacion"
import { formatoMoneda } from "@/src/lib/formato"
import type { CuentaDetalle } from "@/src/schemas/gastos"
import { claseBotonPrimario, claseBotonSecundario, claseInput, claseLabel } from "../ui/estilos"

const hoyEnBogota = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })

export default function LegalizarCuenta({ cuenta }: { cuenta: CuentaDetalle }) {
  const [abierto, setAbierto] = useState(false)
  const [fechaRadicacion, setFechaRadicacion] = useState(cuenta.fechaRadicacion ?? hoyEnBogota())
  const [legalizando, startLegalizar] = useTransition()

  // Cuánto vuelve a cada bolsa al legalizar
  const porBolsa = new Map<string, number>()
  for (const linea of cuenta.lineas) {
    const nombre = linea.solicitudGasto.bolsa?.nombre ?? "Sin bolsa"
    porBolsa.set(nombre, (porBolsa.get(nombre) ?? 0) + Number(linea.valorLegalizado))
  }

  const legalizar = () => {
    if (!fechaRadicacion) return toast.error("Indique la fecha de radicación")

    startLegalizar(async () => {
      const resultado = await legalizarCuenta(cuenta.id, fechaRadicacion)

      if (!resultado.ok) {
        resultado.errores.forEach(error => toast.error(error))
        return
      }

      toast.success(`Cuenta de cobro ${cuenta.numeroCuentaCobro} legalizada`)
      setAbierto(false)
    })
  }

  return (
    <>
      <button type="button" onClick={() => setAbierto(true)} disabled={cuenta.lineas.length === 0} className={claseBotonPrimario}>
        <CheckCircle2 size={15} />
        Legalizar
      </button>

      <Dialog open={abierto} onClose={() => !legalizando && setAbierto(false)} className="relative z-50">
        <div className="fixed inset-0 bg-slate-900/30" aria-hidden="true" />

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <DialogTitle className="text-sm font-semibold text-slate-800">Legalizar {cuenta.numeroCuentaCobro}</DialogTitle>
            <p className="mt-1 text-xs text-slate-400">
              Los {cuenta.lineas.length} gasto(s) quedan Legalizados, el total de la cuenta de cobro vuelve a la bolsa y la cuenta pasa a Contabilidad.
              No se puede deshacer.
            </p>

            <div className="mt-4 rounded-md bg-slate-50 px-4 py-3 text-xs">
              <p className="mb-2 font-semibold text-slate-600">Vuelve a las bolsas</p>
              {[...porBolsa].map(([bolsa, valor]) => (
                <p key={bolsa} className="flex justify-between text-slate-600">
                  <span>{bolsa}</span><b className="text-emerald-700">+{formatoMoneda(valor)}</b>
                </p>
              ))}
              <p className="mt-2 flex justify-between border-t border-slate-200 pt-2 font-semibold text-slate-800">
                <span>Total legalizado</span><span>{formatoMoneda(cuenta.totalLegalizado)}</span>
              </p>
            </div>

            <label className="mt-4 block">
              <span className={claseLabel}>Fecha de radicación <span className="text-red-400">*</span></span>
              <input type="date" value={fechaRadicacion} onChange={e => setFechaRadicacion(e.target.value)} className={claseInput} />
            </label>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setAbierto(false)} disabled={legalizando} className={claseBotonSecundario}>Cancelar</button>
              <button type="button" onClick={legalizar} disabled={legalizando} className={claseBotonPrimario}>
                {legalizando && <Loader2 size={15} className="animate-spin" />}
                Confirmar legalización
              </button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </>
  )
}
