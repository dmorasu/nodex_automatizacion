"use client"

import { useState, useTransition } from "react"
import clsx from "clsx"
import { toast } from "react-toastify"
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { Loader2 } from "lucide-react"
import { registrarFactura } from "@/actions/gastos/legalizacion"
import { formatoMoneda, formatoPorcentaje } from "@/src/lib/formato"
import type { Factura } from "@/src/schemas/gastos"
import { claseBotonPrimario, claseBotonSecundario, claseInput, claseLabel, claseTextarea } from "../ui/estilos"

export type GastoAFacturar = {
  id: number
  codigo: string
  valorRealmentePagado: string | null
  numeroFactura: string | null
  reembolsable: boolean
  beneficiario: { identificacion: string, nombre: string }
}

export type Tasas = { retencion: number, gmf: number }

const centavos = (valor: string | number | null) => Math.round(Number(valor || 0) * 100)

// Registra o corrige la factura real de un gasto pagado
export default function ModalFactura({
  gasto,
  factura,
  tasas,
  tipoDocumentoFacturaId,
  onCerrar
}: {
  gasto: GastoAFacturar
  factura: Factura | null
  tasas: Tasas
  tipoDocumentoFacturaId: number | null
  onCerrar: () => void
}) {
  const pagado = Number(gasto.valorRealmentePagado ?? 0)

  const [datos, setDatos] = useState({
    numeroFactura: factura?.numeroFactura ?? gasto.numeroFactura ?? "",
    tieneFacturaReal: factura?.tieneFacturaReal ?? true,
    identificacionTerceroReal: factura?.identificacionTerceroReal ?? gasto.beneficiario.identificacion,
    nombreTerceroReal: factura?.nombreTerceroReal ?? gasto.beneficiario.nombre,
    valorFactura: factura ? String(Number(factura.valorFactura)) : String(pagado),
    observacion: factura?.observacion ?? ""
  })
  const [archivos, setArchivos] = useState<File[]>([])
  const [guardando, startGuardar] = useTransition()

  const cambiar = <K extends keyof typeof datos>(campo: K, valor: (typeof datos)[K]) =>
    setDatos(actuales => ({ ...actuales, [campo]: valor }))

  // Vista previa (el cálculo definitivo lo hace el backend), en centavos
  const facturaC = centavos(datos.valorFactura)
  const gmfC = Math.round(facturaC * tasas.gmf)
  const diferenciaC = centavos(pagado) - facturaC

  const guardar = () => {
    if (!(facturaC > 0)) return toast.error("El valor de la factura debe ser mayor a cero")

    let archivo: FormData | null = null
    if (archivos.length > 0 && tipoDocumentoFacturaId) {
      archivo = new FormData()
      archivo.append("tipoDocumentoId", String(tipoDocumentoFacturaId))
      archivos.forEach(a => archivo!.append("archivos", a))
    }

    startGuardar(async () => {
      const resultado = await registrarFactura(gasto.id, {
        ...datos,
        valorFactura: facturaC / 100
      }, archivo)

      if (!resultado.ok) {
        resultado.errores.forEach(error => toast.error(error))
        return
      }

      const { diferencia } = resultado.datos
      toast.success(diferencia > 0
        ? `Factura registrada. Reintegro pendiente de ${formatoMoneda(diferencia)}`
        : "Factura registrada")
      if (resultado.advertencia) toast.warning(resultado.advertencia, { autoClose: false })
      onCerrar()
    })
  }

  return (
    <Dialog open onClose={() => !guardando && onCerrar()} className="relative z-50">
      <div className="fixed inset-0 bg-slate-900/30" aria-hidden="true" />

      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <DialogPanel className="w-full max-w-2xl rounded-xl bg-white shadow-xl">

            <div className="px-6 py-4 border-b border-slate-100">
              <DialogTitle className="text-sm font-semibold text-slate-800">
                {factura ? "Corregir" : "Registrar"} factura real · {gasto.codigo}
              </DialogTitle>
              <p className="mt-0.5 text-xs text-slate-400">Valor pagado por Tesorería: <b className="text-slate-600">{formatoMoneda(pagado)}</b></p>
              <p className={clsx("mt-2 rounded-md px-3 py-1.5 text-xs", gasto.reembolsable ? "bg-sky-50 text-sky-800" : "bg-amber-50 text-amber-800")}>
                {gasto.reembolsable
                  ? "Reembolsable: con la factura queda listo para agregarlo a una cuenta de cobro."
                  : "No reembolsable: con la factura queda Legalizado (lo asume la bolsa, no va a cuenta de cobro) y pasa a Contabilidad."}
              </p>
            </div>

            <div className="px-6 py-5 space-y-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block">
                  <span className={claseLabel}>Número de factura</span>
                  <input value={datos.numeroFactura} onChange={e => cambiar("numeroFactura", e.target.value)} maxLength={50} className={claseInput} />
                </label>
                <label className="block">
                  <span className={claseLabel}>Valor de la factura <span className="text-red-400">*</span></span>
                  <input type="number" min={0} step="0.01" value={datos.valorFactura} onChange={e => cambiar("valorFactura", e.target.value)} className={claseInput} autoFocus />
                </label>
                <label className="block">
                  <span className={claseLabel}>Identificación del tercero</span>
                  <input value={datos.identificacionTerceroReal} onChange={e => cambiar("identificacionTerceroReal", e.target.value)} maxLength={30} className={claseInput} />
                </label>
                <label className="block sm:col-span-3">
                  <span className={claseLabel}>Nombre del tercero (quien factura)</span>
                  <input value={datos.nombreTerceroReal} onChange={e => cambiar("nombreTerceroReal", e.target.value)} maxLength={200} className={claseInput} />
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-600 sm:col-span-3">
                  <input type="checkbox" checked={datos.tieneFacturaReal} onChange={e => cambiar("tieneFacturaReal", e.target.checked)} className="h-4 w-4 accent-emerald-600" />
                  Tiene factura real (si no, se legaliza con otro soporte)
                </label>
              </div>

              {/* Cálculos (la retención se define al crear el gasto) */}
              <div className="grid gap-x-6 gap-y-2 rounded-md bg-slate-50 px-4 py-3 text-xs sm:grid-cols-2">
                <p className="flex justify-between"><span className="text-slate-500">4x1000 ({formatoPorcentaje(tasas.gmf)} sobre la factura)</span><b>{formatoMoneda(gmfC / 100)}</b></p>
                <p className="flex justify-between"><span className="text-slate-500">Valor a legalizar (factura + 4x1000)</span><b className="text-slate-800">{formatoMoneda((facturaC + gmfC) / 100)}</b></p>
                <p className={clsx(
                  "flex justify-between border-t border-slate-200 pt-2 sm:col-span-2",
                  diferenciaC > 0 ? "text-amber-700" : diferenciaC < 0 ? "text-red-600" : "text-emerald-700"
                )}>
                  <span>
                    {diferenciaC > 0 ? "Reintegro que debe devolver el tramitador (pagado − factura)"
                      : diferenciaC < 0 ? "La factura supera lo pagado"
                        : "Lo pagado coincide con la factura: sin reintegro"}
                  </span>
                  {diferenciaC !== 0 && <b>{formatoMoneda(Math.abs(diferenciaC) / 100)}</b>}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className={claseLabel}>Archivo de la factura (opcional)</span>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={e => setArchivos(Array.from(e.target.files ?? []))}
                    className="block w-full text-xs text-slate-500 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-medium file:text-slate-600 hover:file:bg-slate-200"
                  />
                </label>
                <label className="block">
                  <span className={claseLabel}>Observación</span>
                  <textarea value={datos.observacion} onChange={e => cambiar("observacion", e.target.value)} rows={2} maxLength={2000} className={claseTextarea} />
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button type="button" onClick={onCerrar} disabled={guardando} className={claseBotonSecundario}>Cancelar</button>
              <button type="button" onClick={guardar} disabled={guardando} className={claseBotonPrimario}>
                {guardando && <Loader2 size={15} className="animate-spin" />}
                {factura ? "Guardar corrección" : "Registrar factura"}
              </button>
            </div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  )
}
