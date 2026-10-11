"use client"

import { useState, useTransition } from "react"
import { toast } from "react-toastify"
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import clsx from "clsx"
import { FileCheck2, FileCode2, FileText, Loader2 } from "lucide-react"
import { facturarSolicitudes } from "@/actions/gastos/anticipos"
import { formatoMoneda } from "@/src/lib/formato"
import { claseBotonPrimario, claseBotonSecundario, claseInput } from "../ui/estilos"

export type SolicitudAFacturar = {
  id: number
  codigo: string
  cliente: { nombre: string, identificacion: string }
  valorConsignado: string
}

type Fila = { valorRecibido: string, numeroFactura: string, observacion: string, pdf: File | null, xml: File | null }

const centavos = (valor: string) => Math.round(Number(valor || 0) * 100)

function SelectorArchivo({ etiqueta, accept, archivo, onCambio, Icono }: {
  etiqueta: string
  accept: string
  archivo: File | null
  onCambio: (archivo: File | null) => void
  Icono: typeof FileText
}) {
  return (
    <label
      className={clsx(
        "flex h-9 min-w-0 cursor-pointer items-center gap-2 rounded-md border px-3 text-xs transition",
        archivo ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-dashed border-slate-300 text-slate-500 hover:border-emerald-400"
      )}
      title={archivo?.name}
    >
      <Icono size={15} className="shrink-0" />
      <span className="truncate">{archivo ? archivo.name : etiqueta}</span>
      <input type="file" accept={accept} className="sr-only" onChange={e => onCambio(e.target.files?.[0] ?? null)} />
    </label>
  )
}

// Contabilidad confirma que el dinero de la solicitud entró y registra la factura que hizo:
// valor real ingresado (precargado con el consignado), número de factura, PDF y XML.
// Sirve para una o para varias a la vez (todas o ninguna). Al terminar se le envía la factura al creador.
export default function ModalFacturarSolicitudes({
  solicitudes,
  onCerrar,
  onFacturadas
}: {
  solicitudes: SolicitudAFacturar[]
  onCerrar: () => void
  onFacturadas?: () => void
}) {
  const [filas, setFilas] = useState<Record<number, Fila>>(() =>
    Object.fromEntries(solicitudes.map(s => [s.id, { valorRecibido: String(Number(s.valorConsignado)), numeroFactura: "", observacion: "", pdf: null, xml: null }])))
  const [guardando, startGuardar] = useTransition()

  const cambiar = <K extends keyof Fila>(id: number, campo: K, valor: Fila[K]) =>
    setFilas(actuales => ({ ...actuales, [id]: { ...actuales[id], [campo]: valor } }))

  const totalRecibido = solicitudes.reduce((t, s) => t + centavos(filas[s.id].valorRecibido), 0) / 100
  const una = solicitudes.length === 1

  const facturar = () => {
    const numeros = new Set<string>()
    for (const s of solicitudes) {
      const fila = filas[s.id]
      const numero = fila.numeroFactura.trim().toUpperCase()
      if (!(Number(fila.valorRecibido) > 0)) return toast.error(`${s.codigo}: el valor recibido debe ser mayor a cero`)
      if (!numero) return toast.error(`${s.codigo}: indique el número de factura`)
      if (numeros.has(numero)) return toast.error(`La factura ${numero} está repetida`)
      numeros.add(numero)
      if (!fila.pdf) return toast.error(`${s.codigo}: adjunte la factura en PDF`)
      if (!fila.xml) return toast.error(`${s.codigo}: adjunte el XML de la factura`)
    }

    const formData = new FormData()
    formData.append("datos", JSON.stringify({
      solicitudes: solicitudes.map(s => ({
        id: s.id,
        valorRecibido: Number(filas[s.id].valorRecibido),
        numeroFactura: filas[s.id].numeroFactura.trim(),
        observacion: filas[s.id].observacion.trim() || null
      }))
    }))
    solicitudes.forEach(s => {
      formData.append(`pdf_${s.id}`, filas[s.id].pdf!)
      formData.append(`xml_${s.id}`, filas[s.id].xml!)
    })

    startGuardar(async () => {
      const resultado = await facturarSolicitudes(formData, solicitudes.map(s => s.id))
      if (!resultado.ok) {
        resultado.errores.forEach(error => toast.error(error))
        return
      }
      toast.success(una ? `Solicitud ${solicitudes[0].codigo} facturada` : `${solicitudes.length} solicitudes facturadas`)
      onFacturadas?.()
      onCerrar()
    })
  }

  return (
    <Dialog open onClose={() => !guardando && onCerrar()} className="relative z-50">
      <div className="fixed inset-0 bg-slate-900/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-xl bg-white shadow-xl">
          <div className="border-b border-slate-100 p-6 pb-4">
            <DialogTitle className="text-sm font-semibold text-slate-800">
              {una ? `Confirmar pago y facturar · ${solicitudes[0].codigo}` : `Confirmar pago y facturar ${solicitudes.length} solicitudes`}
            </DialogTitle>
            <p className="mt-1 text-xs text-slate-400">
              Verifique en el banco que el dinero entró. El valor recibido suma a la bolsa de anticipos facturados a nombre del cliente,
              y a quien registró la solicitud le llega la factura (PDF y XML) por correo. Si el pago no entró, cierre y use Novedad.
            </p>
          </div>

          <div className="flex-1 divide-y divide-slate-100 overflow-y-auto px-6">
            {solicitudes.map(s => {
              const fila = filas[s.id]
              const diferencia = (centavos(fila.valorRecibido) - centavos(s.valorConsignado)) / 100
              return (
                <div key={s.id} className="grid gap-3 py-4 md:grid-cols-12 md:items-start">
                  <div className="md:col-span-3">
                    <p className="text-xs font-semibold text-slate-700">{s.codigo}</p>
                    <p className="text-[11px] text-slate-400">{s.cliente.nombre} · {s.cliente.identificacion}</p>
                    <p className="mt-1 text-[11px] text-slate-500">Consignó <b>{formatoMoneda(s.valorConsignado)}</b></p>
                  </div>
                  <div className="md:col-span-2">
                    <input
                      type="number" min={0} step="0.01"
                      value={fila.valorRecibido}
                      onChange={e => cambiar(s.id, "valorRecibido", e.target.value)}
                      className={claseInput}
                      aria-label={`Valor recibido de ${s.codigo}`}
                      title="Valor recibido"
                    />
                    {diferencia !== 0 && (
                      <p className={`mt-1 text-[11px] font-medium ${diferencia < 0 ? "text-red-600" : "text-amber-700"}`}>
                        Diferencia {diferencia > 0 && "+"}{formatoMoneda(diferencia)}
                      </p>
                    )}
                  </div>
                  <input
                    value={fila.numeroFactura}
                    onChange={e => cambiar(s.id, "numeroFactura", e.target.value)}
                    maxLength={50}
                    placeholder="N.º de factura"
                    className={`${claseInput} md:col-span-2`}
                    aria-label={`Número de factura de ${s.codigo}`}
                  />
                  <div className="grid gap-2 md:col-span-3">
                    <SelectorArchivo etiqueta="Factura PDF" accept=".pdf,application/pdf" archivo={fila.pdf} onCambio={a => cambiar(s.id, "pdf", a)} Icono={FileText} />
                    <SelectorArchivo etiqueta="XML de la factura" accept=".xml,text/xml,application/xml" archivo={fila.xml} onCambio={a => cambiar(s.id, "xml", a)} Icono={FileCode2} />
                  </div>
                  <input
                    value={fila.observacion}
                    onChange={e => cambiar(s.id, "observacion", e.target.value)}
                    maxLength={1000}
                    placeholder={diferencia !== 0 ? "Explique la diferencia" : "Observación (opcional)"}
                    className={`${claseInput} md:col-span-2`}
                    aria-label={`Observación de ${s.codigo}`}
                  />
                </div>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-6 pt-4">
            <p className="text-xs text-slate-500">
              Ingresa <b className="text-slate-800">{formatoMoneda(totalRecibido)}</b>
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={onCerrar} disabled={guardando} className={claseBotonSecundario}>Cancelar</button>
              <button type="button" onClick={facturar} disabled={guardando} className={claseBotonPrimario}>
                {guardando ? <Loader2 size={15} className="animate-spin" /> : <FileCheck2 size={15} />}
                {una ? "Confirmar y facturar" : `Facturar ${solicitudes.length}`}
              </button>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
