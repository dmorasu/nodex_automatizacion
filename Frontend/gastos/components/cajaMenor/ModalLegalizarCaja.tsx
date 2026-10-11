"use client"

import { useState, useTransition } from "react"
import { toast } from "react-toastify"
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { FileCheck2, Loader2, Paperclip } from "lucide-react"
import { legalizarGastoCaja } from "@/actions/gastos/cajaMenor"
import { formatoMoneda } from "@/src/lib/formato"
import type { GastoListado } from "@/src/schemas/gastos"
import { claseBotonPrimario, claseBotonSecundario, claseInput, claseLabel } from "../ui/estilos"

function Campo({ etiqueta, obligatorio = true, className, children }: { etiqueta: string, obligatorio?: boolean, className?: string, children: React.ReactNode }) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className={claseLabel}>{etiqueta} {obligatorio && <span className="text-red-400">*</span>}</span>
      {children}
    </label>
  )
}

const centavos = (valor: string | number | null) => Math.round(Number(valor || 0) * 100)

// Tesorería legaliza un gasto pagado por caja: la factura que trajo quien recibió el efectivo,
// con su soporte obligatorio. Queda pendiente por reembolso.
export default function ModalLegalizarCaja({ gasto, onCerrar, onLegalizado }: {
  gasto: GastoListado
  onCerrar: () => void
  onLegalizado: () => void
}) {
  const [datos, setDatos] = useState({
    numeroFactura: "",
    fechaFactura: "",
    beneficiario: gasto.beneficiario.nombre,
    tipoIdentificacion: "NIT",
    identificacion: gasto.beneficiario.identificacion,
    placa: gasto.placa ?? "",
    matriculaInmobiliaria: gasto.matriculaInmobiliaria ?? "",
    quienLegaliza: "",
    valorSoporte: String(Number(gasto.valorRealmentePagado ?? gasto.valorSolicitadoPago)),
    observacion: ""
  })
  const [archivos, setArchivos] = useState<File[]>([])
  const [guardando, startGuardar] = useTransition()

  const cambiar = (campo: keyof typeof datos, valor: string) => setDatos(d => ({ ...d, [campo]: valor }))
  const entregado = Number(gasto.valorRealmentePagado ?? 0)
  const diferencia = (centavos(datos.valorSoporte) - centavos(entregado)) / 100

  const legalizar = () => {
    const faltantes = [
      !datos.numeroFactura.trim() && "el número de factura",
      !datos.fechaFactura && "la fecha de la factura",
      !datos.beneficiario.trim() && "el beneficiario",
      !datos.identificacion.trim() && "la identificación",
      !datos.quienLegaliza.trim() && "quién legaliza",
      !(Number(datos.valorSoporte) > 0) && "el valor del soporte",
      archivos.length === 0 && "el soporte"
    ].filter(Boolean)
    if (faltantes.length) return toast.error(`Falta ${faltantes.join(", ")}`)

    const formData = new FormData()
    formData.append("datos", JSON.stringify({
      ...datos,
      placa: datos.placa.trim() || null,
      matriculaInmobiliaria: datos.matriculaInmobiliaria.trim() || null,
      valorSoporte: Number(datos.valorSoporte),
      observacion: datos.observacion.trim() || null
    }))
    archivos.forEach(a => formData.append("archivos", a))

    startGuardar(async () => {
      const resultado = await legalizarGastoCaja(gasto.id, formData)
      if (!resultado.ok) return resultado.errores.forEach(e => toast.error(e))
      toast.success(`${gasto.codigo} legalizado: queda pendiente por reembolso`)
      onLegalizado()
      onCerrar()
    })
  }

  return (
    <Dialog open onClose={() => !guardando && onCerrar()} className="relative z-50">
      <div className="fixed inset-0 bg-slate-900/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-xl">
          <div className="border-b border-slate-100 p-6 pb-4">
            <DialogTitle className="text-sm font-semibold text-slate-800">Legalizar {gasto.codigo}</DialogTitle>
            <p className="mt-1 text-xs text-slate-500">{gasto.conceptoPago} · entregado {formatoMoneda(entregado)}</p>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Campo etiqueta="Número de factura">
                <input value={datos.numeroFactura} onChange={e => cambiar("numeroFactura", e.target.value)} maxLength={50} className={claseInput} />
              </Campo>
              <Campo etiqueta="Fecha de factura">
                <input type="date" value={datos.fechaFactura} onChange={e => cambiar("fechaFactura", e.target.value)} className={claseInput} />
              </Campo>
              <Campo etiqueta="Valor del soporte">
                <input type="number" min={0} step="0.01" value={datos.valorSoporte} onChange={e => cambiar("valorSoporte", e.target.value)} className={claseInput} />
                {diferencia !== 0 && (
                  <span className={`mt-1 block text-[11px] font-medium ${diferencia < 0 ? "text-emerald-700" : "text-amber-700"}`}>
                    {diferencia < 0 ? `Devuelve ${formatoMoneda(-diferencia)} a la caja` : `La caja paga ${formatoMoneda(diferencia)} más`}
                  </span>
                )}
              </Campo>
              <Campo etiqueta="Beneficiario" className="sm:col-span-2 lg:col-span-1">
                <input value={datos.beneficiario} onChange={e => cambiar("beneficiario", e.target.value)} maxLength={200} className={claseInput} />
              </Campo>
              <Campo etiqueta="Tipo de documento">
                <select value={datos.tipoIdentificacion} onChange={e => cambiar("tipoIdentificacion", e.target.value)} className={claseInput}>
                  <option value="CC">CC</option>
                  <option value="NIT">NIT</option>
                </select>
              </Campo>
              <Campo etiqueta="Identificación">
                <input value={datos.identificacion} onChange={e => cambiar("identificacion", e.target.value)} maxLength={30} className={claseInput} />
              </Campo>
              <Campo etiqueta="Placa" obligatorio={false}>
                <input value={datos.placa} onChange={e => cambiar("placa", e.target.value.toUpperCase())} maxLength={20} className={claseInput} />
              </Campo>
              <Campo etiqueta="Matrícula inmobiliaria" obligatorio={false}>
                <input value={datos.matriculaInmobiliaria} onChange={e => cambiar("matriculaInmobiliaria", e.target.value)} maxLength={50} className={claseInput} />
              </Campo>
              <Campo etiqueta="Quién legaliza">
                <input value={datos.quienLegaliza} onChange={e => cambiar("quienLegaliza", e.target.value)} maxLength={150} placeholder="Nombre de quien trae la factura" className={claseInput} />
              </Campo>
              <Campo etiqueta="Observación" obligatorio={false} className="sm:col-span-2 lg:col-span-3">
                <input value={datos.observacion} onChange={e => cambiar("observacion", e.target.value)} maxLength={1000} className={claseInput} />
              </Campo>
            </div>

            <div className="mt-5">
              <span className={claseLabel}>Soporte <span className="text-red-400">*</span></span>
              <label className={`${claseBotonSecundario} cursor-pointer`}>
                <Paperclip size={15} />
                Seleccionar archivos
                <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" className="sr-only" onChange={e => setArchivos(Array.from(e.target.files ?? []))} />
              </label>
              {archivos.length > 0 && <ul className="mt-2 space-y-1 text-xs text-slate-600">{archivos.map(a => <li key={a.name}>· {a.name}</li>)}</ul>}
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-100 p-6 pt-4">
            <button type="button" onClick={onCerrar} disabled={guardando} className={claseBotonSecundario}>Cancelar</button>
            <button type="button" onClick={legalizar} disabled={guardando} className={claseBotonPrimario}>
              {guardando ? <Loader2 size={15} className="animate-spin" /> : <FileCheck2 size={15} />}
              Legalizar
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
