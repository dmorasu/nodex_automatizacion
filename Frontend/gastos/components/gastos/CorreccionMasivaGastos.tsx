"use client"

import { useRef, useState } from "react"
import { toast } from "react-toastify"
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Loader2, ShieldCheck, Upload, XCircle } from "lucide-react"
import { claseInput } from "@/components/ui/estilos"

type ErrorFila = { fila: number, error: string }
type CambioFila = { fila: number, codigo: string, cambios: string[] }

type Estado =
  | { tipo: "inicial" }
  | { tipo: "conErrores", errores: ErrorFila[], mensaje?: string }
  | { tipo: "valido", sinCambios: number, cambios: CambioFila[] }
  | { tipo: "aplicado", cambios: CambioFila[] }

const API = "/correccion-gastos"

// Envía el archivo al backend (por el proxy, que agrega la sesión)
const enviar = async (accion: "validar" | "aplicar", archivo: File, motivo = "") => {
  const datos = new FormData()
  datos.append("archivo", archivo)
  if (motivo) datos.append("motivo", motivo)
  const respuesta = await fetch(`${API}/${accion}`, { method: "POST", body: datos })
  const json = await respuesta.json().catch(() => ({}))
  return { ok: respuesta.ok, json }
}

// Corrección masiva de gastos (solo administrador). El Excel sale con los gastos de los filtros
// del Tablero de Control; se valida mostrando qué cambia en cada gasto y se aplica todo o nada.
export default function CorreccionMasivaGastos({ filtros }: { filtros: string }) {
  const entrada = useRef<HTMLInputElement>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [motivo, setMotivo] = useState("")
  const [estado, setEstado] = useState<Estado>({ tipo: "inicial" })
  const [procesando, setProcesando] = useState<"validar" | "aplicar" | null>(null)

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
        setEstado({ tipo: "conErrores", errores: [], mensaje: json.error ?? "No se pudo validar el archivo" })
        return
      }
      if (json.errores.length) setEstado({ tipo: "conErrores", errores: json.errores })
      else if (!json.cambios.length) setEstado({ tipo: "conErrores", errores: [], mensaje: "El archivo no tiene cambios: todos los gastos ya tienen esos datos" })
      else setEstado({ tipo: "valido", sinCambios: json.sinCambios, cambios: json.cambios })
    } catch {
      toast.error("No se pudo conectar con el servidor")
    } finally {
      setProcesando(null)
    }
  }

  const aplicar = async () => {
    if (!archivo) return
    if (!motivo.trim()) return toast.error("Indique el motivo de la corrección")
    setProcesando("aplicar")
    try {
      const { ok, json } = await enviar("aplicar", archivo, motivo.trim())
      if (!ok) {
        setEstado({ tipo: "conErrores", errores: json.errores ?? [], mensaje: json.error })
        return
      }
      setEstado({ tipo: "aplicado", cambios: json.cambios })
      setArchivo(null)
      setMotivo("")
      if (entrada.current) entrada.current.value = ""
      toast.success(`${json.cambios.length} gasto(s) corregidos`)
    } catch {
      toast.error("No se pudo conectar con el servidor")
    } finally {
      setProcesando(null)
    }
  }

  return (
    <div className="space-y-6">

      {/* QUÉ SE PUEDE CAMBIAR (pedido del usuario: que quede claro en la pantalla) */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600">Qué se puede cambiar</p>
        <div className="mt-3 grid gap-4 text-xs text-slate-600 md:grid-cols-2">
          <ul className="space-y-1.5">
            <li><b className="text-slate-700">tipoGastoId</b>: tipo de gasto (ids en la hoja TiposGasto).</li>
            <li><b className="text-slate-700">bolsaId</b>: bolsa de la que sale el pago (ids en la hoja Bolsas).</li>
            <li><b className="text-slate-700">valorSolicitado</b>: valor del gasto, sin puntos ni $ (ej: 150000).</li>
            <li><b className="text-slate-700">valorPagado</b>: solo en gastos ya pagados; vacío si aún no se paga.</li>
            <li><b className="text-slate-700">placa, transito y matriculaInmobiliaria</b>: según el tipo (Vehículo: placa y tránsito; Inmueble: matrícula).</li>
            <li><b className="text-slate-700">codigo, estado y conceptoPago</b> (columnas grises) no se cambian.</li>
          </ul>
          <ul className="space-y-1.5">
            <li><b className="text-slate-700">Solicitado</b>: se corrige todo, sin mover dinero.</li>
            <li><b className="text-slate-700">Programado o Aprobado</b>: solo tipo, placa, tránsito y matrícula. Para cambiar bolsa o valor, Tesorería debe quitarlo del lote.</li>
            <li><b className="text-slate-700">Pagado</b>: si cambia la bolsa, el pago vuelve a la bolsa anterior y se descuenta de la nueva; si cambia el valor pagado, la bolsa y el lote se ajustan por la diferencia.</li>
            <li><b className="text-slate-700">Pagado en caja</b>: se corrige el valor; la caja no se cambia.</li>
            <li><b className="text-slate-700">Facturado en adelante</b>: no se corrige aquí. En los gastos de anticipos la bolsa no se cambia.</li>
            <li>Solo se aplica lo que cambie. Si una fila tiene error, no se aplica ninguna.</li>
          </ul>
        </div>
      </div>

      {/* PASOS */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600">1 · Excel</p>
          <a href={`${API}/plantilla?${filtros}`} className="mt-3 inline-flex items-center gap-2 h-9 px-3 rounded-md border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50">
            <Download size={14} />
            Descargar gastos filtrados
          </a>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600">2 · Validar</p>
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
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600">3 · Aplicar</p>
          <label className="mt-3 block">
            <span className="block mb-1 text-[11px] font-medium text-slate-500">Motivo</span>
            <input value={motivo} onChange={e => setMotivo(e.target.value)} maxLength={500} className={`${claseInput} h-9`} />
          </label>
          <button type="button" onClick={aplicar} disabled={estado.tipo !== "valido" || !motivo.trim() || procesando !== null} className="mt-2 inline-flex items-center gap-2 h-9 px-3 rounded-md bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-40">
            {procesando === "aplicar" ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            Aplicar correcciones
          </button>
        </div>
      </div>

      {/* RESULTADO */}
      {estado.tipo === "valido" && (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 size={18} />
          <p>Sin errores: <b>{estado.cambios.length}</b> gasto(s) con cambios{estado.sinCambios > 0 ? ` · ${estado.sinCambios} sin cambios` : ""}.</p>
        </div>
      )}

      {estado.tipo === "aplicado" && (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 size={18} />
          <p><b>{estado.cambios.length}</b> gasto(s) corregidos.</p>
        </div>
      )}

      {(estado.tipo === "valido" || estado.tipo === "aplicado") && (
        <div className="max-h-[32rem] overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 font-semibold w-16">Fila</th>
                <th className="px-4 py-2 font-semibold w-40">Gasto</th>
                <th className="px-4 py-2 font-semibold">Cambios</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {estado.cambios.map(c => (
                <tr key={c.codigo} className="align-top">
                  <td className="px-4 py-2 text-slate-500">{c.fila}</td>
                  <td className="px-4 py-2 font-semibold text-slate-700">{c.codigo}</td>
                  <td className="px-4 py-2 text-slate-600">
                    <ul className="space-y-0.5">
                      {c.cambios.map((cambio, i) => <li key={i}>{cambio}</li>)}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {estado.tipo === "conErrores" && (
        <div className="overflow-hidden rounded-lg border border-red-200 bg-white shadow-sm">
          <div className="flex items-start gap-3 bg-red-50 px-4 py-3 text-sm text-red-700">
            <XCircle size={18} className="shrink-0 mt-0.5" />
            <p className="font-semibold">{estado.mensaje ?? `El archivo tiene ${estado.errores.length} error(es). No se aplicó ninguna corrección.`}</p>
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
                      <td className="px-4 py-2 font-semibold text-slate-700">{e.fila || "—"}</td>
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
