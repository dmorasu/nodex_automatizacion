"use client"

import { useState } from "react"
import { toast } from "react-toastify"
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { CheckCircle2, Loader2, Paperclip, Trash2, Upload, XCircle } from "lucide-react"
import clsx from "clsx"
import { subirSoportesCaja } from "@/actions/gastos/cajaMenor"
import { proponerGasto } from "@/src/lib/asignarArchivos"
import { formatoMoneda } from "@/src/lib/formato"
import type { GastoListado } from "@/src/schemas/gastos"
import SelectBuscable from "@/components/ui/SelectBuscable"
import { claseBotonPrimario, claseBotonSecundario } from "../ui/estilos"

type Fila = { clave: string, archivo: File, gastoId: number | null, estado: "pendiente" | "subiendo" | "listo" | "error", error?: string }

const TIPOS = ["application/pdf", "image/jpeg", "image/png"]
const MAXIMO_MB = 15

let consecutivo = 0

// Cargue masivo de soportes de caja menor (Por legalizar): se eligen muchos archivos y cada uno se
// asigna a su gasto (se propone por el código del gasto, el N° de trámite, la placa o la matrícula en
// el nombre del archivo; se puede cambiar). Se suben agrupados por gasto; al legalizar esos gastos ya
// no hay que volver a subir el soporte
export default function ModalSoportesCaja({ gastos, onCerrar, onTerminado }: {
  gastos: GastoListado[]
  onCerrar: () => void
  onTerminado: () => void
}) {
  const [filas, setFilas] = useState<Fila[]>([])
  const [subiendo, setSubiendo] = useState(false)

  const agregar = (lista: FileList | null) => {
    const nuevas: Fila[] = []
    for (const archivo of Array.from(lista ?? [])) {
      if (!TIPOS.includes(archivo.type)) { toast.error(`"${archivo.name}" no es PDF, JPG ni PNG`); continue }
      if (archivo.size > MAXIMO_MB * 1024 * 1024) { toast.error(`"${archivo.name}" pesa más de ${MAXIMO_MB} MB`); continue }
      nuevas.push({ clave: `s${consecutivo++}`, archivo, gastoId: proponerGasto(archivo.name, gastos), estado: "pendiente" })
    }
    setFilas(f => [...f, ...nuevas])
  }

  const cambiar = (clave: string, cambios: Partial<Fila>) => setFilas(f => f.map(x => (x.clave === clave ? { ...x, ...cambios } : x)))

  const porSubir = filas.filter(f => f.estado !== "listo")
  const sinGasto = porSubir.filter(f => !f.gastoId).length

  const subir = async () => {
    if (!porSubir.length) return
    if (sinGasto) return toast.error(`Falta elegir el gasto de ${sinGasto} archivo(s)`)
    setSubiendo(true)
    // Un envío por gasto con todos sus archivos
    const grupos = new Map<number, Fila[]>()
    porSubir.forEach(f => grupos.set(f.gastoId!, [...(grupos.get(f.gastoId!) ?? []), f]))
    // Cada envío: hasta 10 archivos (límite del backend) y unos 40 MB (la server action admite 50)
    const envios: [number, Fila[]][] = []
    for (const [gastoId, grupo] of grupos) {
      let actual: Fila[] = []
      let tamano = 0
      for (const f of grupo) {
        if (actual.length && (actual.length === 10 || tamano + f.archivo.size > 40 * 1024 * 1024)) {
          envios.push([gastoId, actual])
          actual = []
          tamano = 0
        }
        actual.push(f)
        tamano += f.archivo.size
      }
      if (actual.length) envios.push([gastoId, actual])
    }
    let fallidos = 0
    for (const [gastoId, grupo] of envios) {
      grupo.forEach(f => cambiar(f.clave, { estado: "subiendo", error: undefined }))
      const formData = new FormData()
      grupo.forEach(f => formData.append("archivos", f.archivo))
      const resultado = await subirSoportesCaja(gastoId, formData).catch(() => ({ ok: false as const, errores: ["No hay conexión con el servidor"] }))
      if (!resultado.ok) fallidos += grupo.length
      grupo.forEach(f => cambiar(f.clave, resultado.ok ? { estado: "listo" } : { estado: "error", error: resultado.errores[0] }))
    }
    setSubiendo(false)
    onTerminado()
    if (fallidos) toast.error(`${fallidos} archivo(s) no se subieron: revise y vuelva a intentar`)
    else {
      toast.success(`Soportes cargados a ${grupos.size} gasto(s)`)
      onCerrar()
    }
  }

  return (
    <Dialog open onClose={() => !subiendo && onCerrar()} className="relative z-50">
      <div className="fixed inset-0 bg-slate-900/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-xl">
          <div className="border-b border-slate-100 p-6 pb-4">
            <DialogTitle className="text-sm font-semibold text-slate-800">Cargar soportes de caja menor</DialogTitle>
            <p className="mt-1 text-xs text-slate-500">
              {gastos.length} gasto(s) por legalizar. El gasto se propone por el código, el N° de trámite, la placa o la matrícula en el nombre del archivo.
            </p>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            <label className={`${claseBotonSecundario} cursor-pointer`}>
              <Paperclip size={15} /> Seleccionar archivos
              <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" className="sr-only" onChange={e => { agregar(e.target.files); e.target.value = "" }} />
            </label>

            {filas.length > 0 && (
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Archivo</th>
                      <th className="px-3 py-2 font-semibold">Gasto</th>
                      <th className="w-24 px-3 py-2 font-semibold">Estado</th>
                      <th className="w-10 px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filas.map(f => (
                      <tr key={f.clave} className={clsx(f.estado === "error" && "bg-red-50/50", f.estado === "listo" && "bg-emerald-50/40")}>
                        <td className="max-w-[16rem] px-3 py-2">
                          <p className="truncate font-medium text-slate-700" title={f.archivo.name}>{f.archivo.name}</p>
                          {f.error && <p className="text-[11px] text-red-600">{f.error}</p>}
                        </td>
                        <td className="px-3 py-2">
                          <SelectBuscable
                            value={f.gastoId ?? ""}
                            onChange={e => cambiar(f.clave, { gastoId: Number(e.target.value) || null })}
                            disabled={f.estado === "listo" || subiendo}
                            className={clsx("h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs", !f.gastoId && "border-amber-300 text-slate-400")}
                          >
                            <option value="">Elija el gasto</option>
                            {gastos.map(g => (
                              <option key={g.id} value={g.id} className="text-slate-700">
                                {g.codigo} · {g.conceptoPago} · {formatoMoneda(g.valorRealmentePagado)}{(g.soportesCaja ?? 0) > 0 ? " · ya tiene soporte" : ""}
                              </option>
                            ))}
                          </SelectBuscable>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {f.estado === "listo" && <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 size={13} /> Cargado</span>}
                          {f.estado === "subiendo" && <span className="inline-flex items-center gap-1 text-slate-500"><Loader2 size={13} className="animate-spin" /> Subiendo</span>}
                          {f.estado === "error" && <span className="inline-flex items-center gap-1 text-red-600"><XCircle size={13} /> Falló</span>}
                          {f.estado === "pendiente" && <span className="text-slate-400">Por subir</span>}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {f.estado !== "listo" && (
                            <button type="button" onClick={() => setFilas(x => x.filter(y => y.clave !== f.clave))} disabled={subiendo} className="p-1 text-slate-300 hover:text-red-500" aria-label={`Quitar ${f.archivo.name}`}>
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-slate-100 p-6 pt-4">
            <p className="text-xs text-slate-500">
              {porSubir.length} por subir{sinGasto > 0 && <span className="text-amber-700"> · {sinGasto} sin gasto</span>}
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={onCerrar} disabled={subiendo} className={claseBotonSecundario}>Cerrar</button>
              <button type="button" onClick={subir} disabled={subiendo || porSubir.length === 0} className={claseBotonPrimario}>
                {subiendo ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                {filas.some(f => f.estado === "error") ? "Reintentar y subir" : "Subir soportes"}
              </button>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
