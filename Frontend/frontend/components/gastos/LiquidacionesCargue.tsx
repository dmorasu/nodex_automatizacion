"use client"

import { useState } from "react"
import { toast } from "react-toastify"
import { CheckCircle2, FileText, Loader2, Upload, X, XCircle } from "lucide-react"
import { claseInput } from "../ui/estilos"

export type GastoCargado = {
  id: number
  codigo: string
  fila: number
  solicitudTramiteId: number | null
  placa: string | null
  matriculaInmobiliaria: string | null
}

type Archivo = {
  clave: string
  archivo: File
  gastoId: number | null
  // Varios gastos con la misma placa, matrícula o trámite: se escoge a mano
  ambiguo: boolean
  estado: "pendiente" | "subiendo" | "ok" | "error"
  error?: string
}

const MAX_MB = 15
const TIPOS = ["application/pdf", "image/jpeg", "image/png"]
const EN_PARALELO = 3

const normalizar = (texto: string) => texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "")

// El gasto del archivo sale de su nombre: primero el código (GAS-2026-000123), luego la placa o la
// matrícula y por último el número del trámite (como palabra suelta: "1234 liquidacion.pdf").
// Si en un nivel coinciden varios gastos, queda para escoger
const reconocer = (nombre: string, gastos: GastoCargado[]): { gastoId: number | null, ambiguo: boolean } => {
  const base = nombre.replace(/\.[^.]+$/, "")
  const plano = normalizar(base)
  const palabras = base.split(/[^0-9A-Za-z]+/).filter(Boolean)
  const niveles: ((g: GastoCargado) => boolean)[] = [
    g => plano.includes(normalizar(g.codigo)),
    g => [g.placa, g.matriculaInmobiliaria].some(v => v && normalizar(v).length >= 4 && plano.includes(normalizar(v))),
    g => g.solicitudTramiteId !== null && palabras.includes(String(g.solicitudTramiteId))
  ]
  for (const coincide of niveles) {
    const encontrados = [...new Set(gastos.filter(coincide).map(g => g.id))]
    if (encontrados.length === 1) return { gastoId: encontrados[0], ambiguo: false }
    if (encontrados.length > 1) return { gastoId: null, ambiguo: true }
  }
  return { gastoId: null, ambiguo: false }
}

const etiquetaGasto = (g: GastoCargado) =>
  [g.codigo, g.placa ?? g.matriculaInmobiliaria, g.solicitudTramiteId ? `trámite ${g.solicitudTramiteId}` : null].filter(Boolean).join(" · ")

// Documentos de liquidación de los gastos recién cargados, de una vez: se sueltan los archivos,
// cada uno se asigna a su gasto por el nombre y se suben como "Liquidación de pago"
export default function LiquidacionesCargue({ gastos, tipoLiquidacionId }: { gastos: GastoCargado[], tipoLiquidacionId: number }) {
  const [archivos, setArchivos] = useState<Archivo[]>([])
  const [arrastrando, setArrastrando] = useState(false)
  const [subiendo, setSubiendo] = useState(false)

  const agregar = (lista: FileList | null) => {
    if (!lista) return
    const nuevos: Archivo[] = []
    for (const archivo of Array.from(lista)) {
      if (!TIPOS.includes(archivo.type)) { toast.error(`"${archivo.name}" no es PDF, JPG o PNG`); continue }
      if (archivo.size > MAX_MB * 1024 * 1024) { toast.error(`"${archivo.name}" pesa más de ${MAX_MB} MB`); continue }
      nuevos.push({ clave: `${archivo.name}-${archivo.size}-${archivo.lastModified}`, archivo, ...reconocer(archivo.name, gastos), estado: "pendiente" })
    }
    setArchivos(actuales => [...actuales, ...nuevos.filter(n => !actuales.some(a => a.clave === n.clave))])
  }

  const cambiar = (clave: string, cambios: Partial<Archivo>) =>
    setArchivos(actuales => actuales.map(a => a.clave === clave ? { ...a, ...cambios } : a))

  const porSubir = archivos.filter(a => a.estado !== "ok")
  const sinGasto = porSubir.filter(a => !a.gastoId).length

  const subir = async () => {
    if (sinGasto) return toast.error(`Escoja el gasto de ${sinGasto} archivo(s)`)
    setSubiendo(true)
    const cola = [...porSubir]
    let fallidos = 0
    const trabajar = async () => {
      for (let a = cola.shift(); a; a = cola.shift()) {
        cambiar(a.clave, { estado: "subiendo", error: undefined })
        const datos = new FormData()
        datos.append("tipoDocumentoId", String(tipoLiquidacionId))
        datos.append("archivos", a.archivo)
        const respuesta = await fetch(`/api/backend/gastos/solicitudes/${a.gastoId}/documentos`, { method: "POST", body: datos }).catch(() => null)
        if (respuesta?.ok) cambiar(a.clave, { estado: "ok" })
        else {
          fallidos++
          const json = await respuesta?.json().catch(() => null)
          cambiar(a.clave, { estado: "error", error: json?.error ?? "No se pudo conectar con el servidor" })
        }
      }
    }
    await Promise.all(Array.from({ length: EN_PARALELO }, trabajar))
    setSubiendo(false)
    if (fallidos) toast.warning(`${fallidos} archivo(s) no se cargaron: vuelva a intentarlo`)
    else toast.success("Documentos cargados")
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3">
        <p className="text-sm font-semibold text-slate-800">Documentos</p>
      </div>

      <div className="space-y-3 p-4">
        <label
          onDragOver={e => { e.preventDefault(); setArrastrando(true) }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={e => { e.preventDefault(); setArrastrando(false); agregar(e.dataTransfer.files) }}
          className={`flex cursor-pointer flex-col items-center gap-1 rounded-md border border-dashed px-3 py-6 text-xs text-slate-600 hover:bg-slate-50 ${arrastrando ? "border-sky-400 bg-sky-50" : "border-slate-300"}`}
        >
          <Upload size={18} className="text-sky-600" />
          <span>Arrastre los archivos o haga clic para elegirlos</span>
          <span className="text-[11px] text-slate-400">PDF, JPG o PNG · máx. {MAX_MB} MB c/u</span>
          <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => { agregar(e.target.files); e.target.value = "" }} />
        </label>

        {archivos.length > 0 && (
          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">Archivo</th>
                  <th className="px-3 py-2 font-semibold">Gasto</th>
                  <th className="px-3 py-2 font-semibold">Estado</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {archivos.map(a => (
                  <tr key={a.clave}>
                    <td className="px-3 py-2 text-slate-700">
                      <span className="inline-flex items-center gap-1.5"><FileText size={14} className="shrink-0 text-slate-400" />{a.archivo.name}</span>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={a.gastoId ?? ""}
                        onChange={e => cambiar(a.clave, { gastoId: e.target.value ? Number(e.target.value) : null, ambiguo: false })}
                        disabled={a.estado === "ok" || a.estado === "subiendo"}
                        className={`${claseInput} h-8 py-0 ${a.gastoId ? "" : "border-amber-300"}`}
                      >
                        <option value="">{a.ambiguo ? "Varios gastos coinciden: escoja" : "Escoja el gasto"}</option>
                        {gastos.map(g => <option key={g.id} value={g.id}>{etiquetaGasto(g)}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      {a.estado === "pendiente" && <span className="text-slate-400">Pendiente</span>}
                      {a.estado === "subiendo" && <span className="inline-flex items-center gap-1 text-slate-500"><Loader2 size={13} className="animate-spin" />Subiendo</span>}
                      {a.estado === "ok" && <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 size={13} />Cargado</span>}
                      {a.estado === "error" && <span className="inline-flex items-center gap-1 text-red-600"><XCircle size={13} />{a.error}</span>}
                    </td>
                    <td className="px-2 py-2">
                      {a.estado !== "ok" && a.estado !== "subiendo" && (
                        <button type="button" onClick={() => setArchivos(actuales => actuales.filter(x => x.clave !== a.clave))} className="text-slate-400 hover:text-slate-600" aria-label="Quitar">
                          <X size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {porSubir.length > 0 && (
          <button type="button" onClick={subir} disabled={subiendo} className="inline-flex items-center gap-2 h-9 px-3 rounded-md bg-sky-500 text-white text-xs font-semibold hover:bg-sky-600 disabled:opacity-40">
            {subiendo ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            Subir {porSubir.length} archivo(s)
          </button>
        )}
      </div>
    </div>
  )
}
