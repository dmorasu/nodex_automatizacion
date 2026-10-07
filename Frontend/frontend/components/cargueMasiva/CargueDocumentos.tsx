"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import clsx from "clsx"
import { toast } from "react-toastify"
import { CheckCircle2, FileText, FileUp, Loader2, Trash2, UploadCloud, XCircle } from "lucide-react"
import { llamarApi } from "@/src/lib/apiCliente"
import { claseBotonPrimario, claseBotonSecundario } from "../ui/estilos"

const TIPOS = [["", "Sin tipo"], ["SOPORTE", "Soporte"], ["FACTURA", "Factura"], ["BOLETA_REINTEGRO", "Boleta de reintegro"], ["INGRESO", "Ingreso"], ["OTRO", "Otro"]] as const
const PERMITIDOS = ["application/pdf", "image/jpeg", "image/jpg", "image/png"]
const MAXIMO_MB = 32
const SIMULTANEOS = 3

type Tramite = { id: number, tramite: string | null, cliente: string | null, placa: string | null, matricula: string | null, estado: string, documentos: number }
type Estado = "pendiente" | "subiendo" | "subido" | "error"
type Archivo = { clave: string, archivo: File, numero: string, tipo: string, estado: Estado, mensaje: string | null }

// Número del trámite en el nombre del archivo: al comienzo ("1234.pdf", "1234_cedula.pdf"),
// o después de "tramite"/"#" ("Tramite 1234 poder.pdf", "#1234 - soat.pdf"); si no, el primer número
export const numeroDelNombre = (nombre: string) => {
  const base = nombre.replace(/\.[^.]+$/, "")
  const coincidencia = /^\s*(\d+)/.exec(base) ?? /(?:tr[aá]mite|#)\s*[-_#:]?\s*(\d+)/i.exec(base) ?? /(\d+)/.exec(base)
  return coincidencia?.[1] ?? ""
}

const tamano = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`)

// Cargue masivo de documentos a varios trámites: el número del trámite sale del nombre de cada
// archivo (se puede corregir), se valida en pantalla y los archivos se suben en fila
export default function CargueDocumentos({ recientes }: { recientes: number[] }) {
  const [archivos, setArchivos] = useState<Archivo[]>([])
  const [tramites, setTramites] = useState<Record<number, Tramite | null>>({})
  const [tipoTodos, setTipoTodos] = useState("")
  const [subiendo, setSubiendo] = useState(false)
  const [arrastrando, setArrastrando] = useState(false)
  const entrada = useRef<HTMLInputElement>(null)

  // Consulta los trámites que aún no se conocen (los que no vuelven: no existen o no son suyos)
  const consultar = useCallback(async (numeros: number[]) => {
    const nuevos = [...new Set(numeros)].filter(n => n > 0 && !(n in tramites))
    if (!nuevos.length) return
    const r = await llamarApi<Tramite[]>("/documentos/masivo/validar", "POST", { ids: nuevos })
    if (!r.ok) return toast.error(r.error)
    setTramites(actuales => ({ ...actuales, ...Object.fromEntries(nuevos.map(n => [n, r.datos.find(t => Number(t.id) === n) ?? null])) }))
  }, [tramites])

  useEffect(() => { void consultar(archivos.map(a => Number(a.numero))) }, [archivos, consultar])

  const agregar = (lista: FileList | File[]) => {
    const nuevos = Array.from(lista).map(archivo => ({
      clave: `${archivo.name}-${archivo.size}-${Math.random()}`,
      archivo,
      numero: numeroDelNombre(archivo.name),
      tipo: tipoTodos,
      estado: "pendiente" as Estado,
      mensaje: null
    }))
    setArchivos(actuales => [...actuales, ...nuevos])
  }

  const cambiar = (clave: string, cambios: Partial<Archivo>) =>
    setArchivos(actuales => actuales.map(a => (a.clave === clave ? { ...a, ...cambios } : a)))

  // Por qué no se puede subir un archivo (null = listo)
  const problema = (a: Archivo) => {
    if (!PERMITIDOS.includes(a.archivo.type)) return "Solo PDF, JPG o PNG"
    if (a.archivo.size > MAXIMO_MB * 1024 * 1024) return `Supera los ${MAXIMO_MB} MB`
    if (!a.numero) return "No se encontró el número del trámite en el nombre: escríbalo"
    const t = tramites[Number(a.numero)]
    if (t === undefined) return "Validando…"
    if (t === null) return `El trámite ${a.numero} no existe o no tiene acceso`
    return null
  }

  const listos = archivos.filter(a => a.estado !== "subido" && !problema(a))
  const subidos = archivos.filter(a => a.estado === "subido").length
  const conError = archivos.filter(a => a.estado === "error").length

  const subirUno = async (a: Archivo) => {
    cambiar(a.clave, { estado: "subiendo", mensaje: null })
    const formData = new FormData()
    formData.append("solicitudTramiteId", a.numero)
    if (a.tipo) formData.append("tipoDocumento", a.tipo)
    formData.append("documento", a.archivo)
    try {
      const res = await fetch("/api/backend/documentos/masivo", { method: "POST", body: formData })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) return cambiar(a.clave, { estado: "error", mensaje: json.error ?? "No se pudo subir" })
      cambiar(a.clave, { estado: "subido", mensaje: null })
    } catch {
      cambiar(a.clave, { estado: "error", mensaje: "Sin conexión con el servidor" })
    }
  }

  // Sube los listos de a tres a la vez; un error no detiene los demás
  const subir = async () => {
    setSubiendo(true)
    const cola = [...listos]
    await Promise.all(Array.from({ length: Math.min(SIMULTANEOS, cola.length) }, async () => {
      while (cola.length) await subirUno(cola.shift()!)
    }))
    setSubiendo(false)
    // Los conteos de documentos de los trámites cambiaron
    setTramites({})
  }

  return (
    <div className="space-y-5">
      {recientes.length > 0 && (
        <p className="rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-800">
          Trámites recién creados: {recientes.map(id => `#${id}`).join(", ")}. Nombre cada archivo empezando por el número del trámite (ej: <b>{recientes[0]}_cedula.pdf</b>).
        </p>
      )}

      {/* Zona para soltar archivos */}
      <div
        onDragOver={e => { e.preventDefault(); setArrastrando(true) }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={e => { e.preventDefault(); setArrastrando(false); agregar(e.dataTransfer.files) }}
        onClick={() => entrada.current?.click()}
        className={clsx("flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition",
          arrastrando ? "border-sky-400 bg-sky-50" : "border-slate-300 bg-white hover:border-sky-300 hover:bg-sky-50/40")}
      >
        <UploadCloud size={28} className="text-sky-500" />
        <p className="text-sm font-semibold text-slate-700">Arrastre aquí los documentos o haga clic para elegirlos</p>
        <p className="text-xs text-slate-400">
          El número del trámite se toma del nombre del archivo: <b>1234.pdf</b>, <b>1234_cedula.pdf</b> o <b>Tramite 1234 poder.pdf</b>. PDF, JPG o PNG, hasta {MAXIMO_MB} MB.
        </p>
        <input ref={entrada} type="file" multiple accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => { if (e.target.files) agregar(e.target.files); e.target.value = "" }} />
      </div>

      {archivos.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-600">
              Tipo para todos
              <select
                value={tipoTodos}
                onChange={e => { setTipoTodos(e.target.value); setArchivos(a => a.map(x => (x.estado === "subido" ? x : { ...x, tipo: e.target.value }))) }}
                className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs"
              >
                {TIPOS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
              </select>
            </label>
            <span className="text-xs text-slate-500">
              {archivos.length} archivo(s) · {listos.length} listo(s) para subir
              {subidos > 0 && <> · <b className="text-emerald-600">{subidos} subido(s)</b></>}
              {conError > 0 && <> · <b className="text-red-600">{conError} con error</b></>}
            </span>
            <div className="ml-auto flex gap-2">
              <button type="button" onClick={() => setArchivos(a => a.filter(x => x.estado !== "subido"))} disabled={!subidos || subiendo} className={claseBotonSecundario}>
                Quitar los subidos
              </button>
              <button type="button" onClick={subir} disabled={!listos.length || subiendo} className={claseBotonPrimario}>
                {subiendo ? <Loader2 size={15} className="animate-spin" /> : <FileUp size={15} />}
                {conError && !subiendo ? <>Reintentar y subir {listos.length}</> : <>Subir {listos.length} archivo(s)</>}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Archivo</th>
                  <th className="px-4 py-2.5">N.º de trámite</th>
                  <th className="px-4 py-2.5">Trámite</th>
                  <th className="px-4 py-2.5">Tipo</th>
                  <th className="px-4 py-2.5">Estado</th>
                  <th className="w-8 px-2 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {archivos.map(a => {
                  const p = problema(a)
                  const t = tramites[Number(a.numero)]
                  const bloqueado = a.estado === "subido" || a.estado === "subiendo"
                  return (
                    <tr key={a.clave} className={clsx(a.estado === "subido" && "bg-emerald-50/40", (a.estado === "error" || (p && p !== "Validando…")) && a.estado !== "subido" && "bg-red-50/30")}>
                      <td className="px-4 py-2.5">
                        <p className="flex items-center gap-1.5 font-medium text-slate-700"><FileText size={14} className="shrink-0 text-slate-400" /> <span className="break-all">{a.archivo.name}</span></p>
                        <p className="pl-5 text-[11px] text-slate-400">{tamano(a.archivo.size)}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          inputMode="numeric"
                          value={a.numero}
                          disabled={bloqueado}
                          onChange={e => cambiar(a.clave, { numero: e.target.value.replace(/\D/g, ""), estado: "pendiente", mensaje: null })}
                          className="h-8 w-24 rounded-md border border-slate-200 px-2 text-xs outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-50"
                          aria-label={`Número de trámite de ${a.archivo.name}`}
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        {t ? (
                          <>
                            <Link href={`/center/solicitudTramites/${t.id}`} target="_blank" className="font-semibold text-sky-700 hover:underline">#{t.id}</Link>
                            <span className="text-slate-600"> · {t.tramite ?? "—"} · {t.placa ?? t.matricula ?? "—"}</span>
                            <p className="text-[11px] text-slate-400">{t.cliente} · {t.estado} · {t.documentos} documento(s)</p>
                          </>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        <select value={a.tipo} disabled={bloqueado} onChange={e => cambiar(a.clave, { tipo: e.target.value })} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs disabled:bg-slate-50">
                          {TIPOS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-2.5">
                        {a.estado === "subido" ? <span className="inline-flex items-center gap-1 font-semibold text-emerald-600"><CheckCircle2 size={14} /> Subido</span>
                          : a.estado === "subiendo" ? <span className="inline-flex items-center gap-1 text-sky-600"><Loader2 size={14} className="animate-spin" /> Subiendo…</span>
                            : a.estado === "error" ? <span className="inline-flex items-center gap-1 text-red-600"><XCircle size={14} /> {a.mensaje}</span>
                              : p ? <span className={clsx("inline-flex items-center gap-1", p === "Validando…" ? "text-slate-400" : "text-red-600")}>{p !== "Validando…" && <XCircle size={14} />} {p}</span>
                                : <span className="inline-flex items-center gap-1 text-slate-500"><CheckCircle2 size={14} className="text-sky-500" /> Listo</span>}
                      </td>
                      <td className="px-2 py-2.5">
                        <button type="button" disabled={a.estado === "subiendo"} onClick={() => setArchivos(x => x.filter(y => y.clave !== a.clave))} className="p-1 text-slate-300 hover:text-red-500" aria-label={`Quitar ${a.archivo.name}`}>
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
