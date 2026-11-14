"use client"

import { useState, useTransition } from "react"
import { toast } from "react-toastify"
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { CheckCircle2, Loader2, Paperclip } from "lucide-react"
import { legalizarCuenta, subirDocumentosCuenta } from "@/actions/gastos/legalizacion"
import { formatoMoneda } from "@/src/lib/formato"
import { SIN_PAGO, type CuentaDetalle } from "@/src/schemas/gastos"
import { claseBotonPrimario, claseBotonSecundario, claseInput, claseLabel } from "../ui/estilos"

const hoyEnBogota = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })

export default function LegalizarCuenta({ cuenta }: { cuenta: CuentaDetalle }) {
  const [abierto, setAbierto] = useState(false)
  const [fechaRadicacion, setFechaRadicacion] = useState(cuenta.fechaRadicacion ?? hoyEnBogota())
  const [legalizando, startLegalizar] = useTransition()
  // La cuenta de cobro firmada se puede adjuntar al legalizar (queda en Documentos de la cuenta)
  const [archivos, setArchivos] = useState<File[]>([])

  // Legalización sin pago: el dinero no vuelve a la bolsa (el backend no registra movimiento)
  const sinPago = cuenta.tipo === SIN_PAGO

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

      // La cuenta ya quedó legalizada: si el archivo no sube, se avisa y se puede cargar en Documentos
      if (archivos.length) {
        const datos = new FormData()
        archivos.forEach(archivo => datos.append("archivos", archivo))
        const subida = await subirDocumentosCuenta(cuenta.id, datos)
        if (!subida.ok) subida.errores.forEach(error => toast.error(`Cuenta de cobro: ${error}`))
      }

      setArchivos([])
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
              Los {cuenta.lineas.length} gasto(s) quedan Legalizados, {sinPago ? "el dinero no vuelve a la bolsa" : "el total de la cuenta de cobro vuelve a la bolsa"} y la cuenta pasa a Contabilidad.
              Solo se puede reversar mientras Contabilidad no la contabilice.
            </p>

            <div className="mt-4 rounded-md bg-slate-50 px-4 py-3 text-xs">
              {!sinPago && <p className="mb-2 font-semibold text-slate-600">Vuelve a las bolsas</p>}
              {!sinPago && [...porBolsa].map(([bolsa, valor]) => (
                <p key={bolsa} className="flex justify-between text-slate-600">
                  <span>{bolsa}</span><b className="text-emerald-700">+{formatoMoneda(valor)}</b>
                </p>
              ))}
              <p className={`flex justify-between font-semibold text-slate-800 ${sinPago ? "" : "mt-2 border-t border-slate-200 pt-2"}`}>
                <span>Total legalizado</span><span>{formatoMoneda(cuenta.totalLegalizado)}</span>
              </p>
            </div>

            <label className="mt-4 block">
              <span className={claseLabel}>Fecha de radicación <span className="text-red-400">*</span></span>
              <input type="date" value={fechaRadicacion} onChange={e => setFechaRadicacion(e.target.value)} className={claseInput} />
            </label>

            {cuenta.permisos.subirDocumentos && (
              <div className="mt-4">
                <span className={claseLabel}>Cuenta de cobro</span>
                <label className={`${claseBotonSecundario} cursor-pointer`}>
                  <Paperclip size={15} /> Adjuntar archivo
                  <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" className="sr-only" onChange={e => setArchivos(Array.from(e.target.files ?? []))} />
                </label>
                {archivos.length > 0 && <ul className="mt-2 space-y-1 text-xs text-slate-600">{archivos.map(a => <li key={a.name}>· {a.name}</li>)}</ul>}
              </div>
            )}

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
