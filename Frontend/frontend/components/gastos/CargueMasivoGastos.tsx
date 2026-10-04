"use client"

import { useRef, useState } from "react"
import { toast } from "react-toastify"
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Loader2, ShieldCheck, Upload, XCircle } from "lucide-react"

type ErrorFila = { fila: number, error: string }

type Estado =
  | { tipo: "inicial" }
  | { tipo: "conErrores", total: number, errores: ErrorFila[], mensaje?: string }
  | { tipo: "valido", total: number }
  | { tipo: "cargado", total: number, codigos: string[] }

const API = "/api/backend/gastos/cargue-masivo"

// Envía el archivo al backend (por el proxy, que agrega la sesión)
const enviar = async (accion: "validar" | "cargar", archivo: File) => {
  const datos = new FormData()
  datos.append("archivo", archivo)
  const respuesta = await fetch(`${API}/${accion}`, { method: "POST", body: datos })
  const json = await respuesta.json().catch(() => ({}))
  return { ok: respuesta.ok, json }
}

// Cargue masivo de gastos (Gestión de activos). Primero se valida todo el archivo:
// si alguna fila tiene error no se carga nada y se muestran los errores para corregir.
export default function CargueMasivoGastos() {
  const entrada = useRef<HTMLInputElement>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [estado, setEstado] = useState<Estado>({ tipo: "inicial" })
  const [procesando, setProcesando] = useState<"validar" | "cargar" | null>(null)

  const elegirArchivo = (nuevo: File | null) => {
    setArchivo(nuevo)
    // Un archivo nuevo siempre se vuelve a validar
    setEstado({ tipo: "inicial" })
  }

  const validar = async () => {
    if (!archivo) return toast.error("Seleccione el archivo Excel")
    setProcesando("validar")
    try {
      const { ok, json } = await enviar("validar", archivo)
      if (!ok) {
        setEstado({ tipo: "conErrores", total: 0, errores: [], mensaje: json.error ?? "No se pudo validar el archivo" })
        return
      }
      setEstado(json.errores.length
        ? { tipo: "conErrores", total: json.total, errores: json.errores }
        : { tipo: "valido", total: json.total })
    } catch {
      toast.error("No se pudo conectar con el servidor")
    } finally {
      setProcesando(null)
    }
  }

  const cargar = async () => {
    if (!archivo) return
    setProcesando("cargar")
    try {
      const { ok, json } = await enviar("cargar", archivo)
      if (!ok) {
        setEstado({ tipo: "conErrores", total: json.total ?? 0, errores: json.errores ?? [], mensaje: json.error })
        return
      }
      setEstado({ tipo: "cargado", total: json.total, codigos: json.codigos })
      setArchivo(null)
      if (entrada.current) entrada.current.value = ""
      toast.success(`${json.codigos.length} gasto(s) creados en Nodex Gastos`)
    } catch {
      toast.error("No se pudo conectar con el servidor")
    } finally {
      setProcesando(null)
    }
  }

  return (
    <div className="space-y-6">

      {/* PASOS */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-600">1 · Plantilla</p>
          <p className="mt-1 text-xs text-slate-500">Una fila por gasto. Trae las hojas con los ids de bolsas, tipos, formas de pago y operaciones.</p>
          <a href={`${API}/plantilla`} className="mt-3 inline-flex items-center gap-2 h-9 px-3 rounded-md border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50">
            <Download size={14} />
            Descargar plantilla
          </a>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-600">2 · Validar</p>
          <p className="mt-1 text-xs text-slate-500">Se revisan todas las filas sin guardar nada.</p>
          <label className="mt-3 flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50">
            <FileSpreadsheet size={15} className="text-emerald-600" />
            <span className="truncate">{archivo ? archivo.name : "Seleccionar archivo .xlsx"}</span>
            <input ref={entrada} type="file" accept=".xlsx" className="hidden" onChange={e => elegirArchivo(e.target.files?.[0] ?? null)} />
          </label>
          <button type="button" onClick={validar} disabled={!archivo || procesando !== null} className="mt-2 inline-flex items-center gap-2 h-9 px-3 rounded-md bg-slate-800 text-white text-xs font-semibold hover:bg-slate-900 disabled:opacity-40">
            {procesando === "validar" ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
            Validar archivo
          </button>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-600">3 · Cargar</p>
          <p className="mt-1 text-xs text-slate-500">Solo con el archivo validado sin errores. Se crean todos o ninguno.</p>
          <button type="button" onClick={cargar} disabled={estado.tipo !== "valido" || procesando !== null} className="mt-3 inline-flex items-center gap-2 h-9 px-3 rounded-md bg-sky-500 text-white text-xs font-semibold hover:bg-sky-600 disabled:opacity-40">
            {procesando === "cargar" ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            Cargar gastos
          </button>
        </div>
      </div>

      {/* RESULTADO */}
      {estado.tipo === "valido" && (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 size={18} />
          <p>El archivo no tiene errores: <b>{estado.total}</b> gasto(s) listos para cargar.</p>
        </div>
      )}

      {estado.tipo === "cargado" && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={18} />
            <p><b>{estado.codigos.length}</b> gasto(s) creados. Quedan pendientes de pago en Tesorería (Nodex Gastos).</p>
          </div>
          <p className="mt-2 text-xs text-emerald-700">{estado.codigos.join(" · ")}</p>
        </div>
      )}

      {estado.tipo === "conErrores" && (
        <div className="overflow-hidden rounded-lg border border-red-200 bg-white shadow-sm">
          <div className="flex items-start gap-3 bg-red-50 px-4 py-3 text-sm text-red-700">
            <XCircle size={18} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{estado.mensaje ?? `El archivo tiene ${estado.errores.length} error(es). No se cargó ningún gasto.`}</p>
              {estado.errores.length > 0 && <p className="text-xs">Corrija las filas indicadas en el Excel y vuelva a seleccionarlo para validar.</p>}
            </div>
          </div>
          {estado.errores.length > 0 && (
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-semibold w-20">Fila</th>
                    <th className="px-4 py-2 font-semibold">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {estado.errores.map((e, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2 font-semibold text-slate-700">{e.fila}</td>
                      <td className="px-4 py-2 text-slate-600">
                        <span className="inline-flex items-center gap-1.5"><AlertCircle size={13} className="text-red-400" />{e.error}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
