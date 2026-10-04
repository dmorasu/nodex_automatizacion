"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "react-toastify"
import { Camera, FileUp, Loader2, Paperclip, Trash2 } from "lucide-react"
import { comprimirImagen } from "@/src/lib/comprimirImagen"
import { formatoTamano } from "@/src/lib/formato"

const TIPOS_PERMITIDOS = ["application/pdf", "image/jpeg", "image/png"]
export const MAX_ARCHIVOS = 10
const MAX_BYTES = 15 * 1024 * 1024

// Vista previa de la foto (libera la memoria al quitarla)
function Miniatura({ archivo }: { archivo: File }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    const enlace = URL.createObjectURL(archivo)
    setUrl(enlace)
    return () => URL.revokeObjectURL(enlace)
  }, [archivo])

  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt="" className="h-12 w-12 shrink-0 rounded object-cover" /> : <span className="h-12 w-12 shrink-0 rounded bg-slate-100" />
}

// Botones "Tomar foto" (cámara trasera) y "Elegir archivo" (galería o PDF), con
// vista previa. Las fotos se reducen en el celular antes de subirlas.
export default function SelectorArchivos({
  archivos,
  onCambio,
  deshabilitado = false
}: {
  archivos: File[]
  onCambio: (archivos: File[]) => void
  deshabilitado?: boolean
}) {
  const [preparando, setPreparando] = useState(false)
  const camara = useRef<HTMLInputElement>(null)
  const galeria = useRef<HTMLInputElement>(null)

  const agregar = async (lista: FileList | null) => {
    if (!lista?.length) return
    setPreparando(true)
    const nuevos: File[] = []

    for (const original of Array.from(lista)) {
      if (!TIPOS_PERMITIDOS.includes(original.type)) {
        toast.error(`"${original.name}" no es válido. Use foto (JPG o PNG) o PDF`)
        continue
      }
      const archivo = await comprimirImagen(original)
      if (archivo.size > MAX_BYTES) {
        toast.error(`"${original.name}" pesa más de 15 MB`)
        continue
      }
      nuevos.push(archivo)
    }

    const todos = [...archivos, ...nuevos]
    if (todos.length > MAX_ARCHIVOS) toast.warning(`Máximo ${MAX_ARCHIVOS} archivos por envío`)
    onCambio(todos.slice(0, MAX_ARCHIVOS))
    setPreparando(false)
  }

  const bloqueado = deshabilitado || preparando

  return (
    <div>
      {/* Entradas ocultas: una abre la cámara, la otra los archivos del celular */}
      <input ref={camara} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { agregar(e.target.files); e.target.value = "" }} />
      <input ref={galeria} type="file" accept="image/jpeg,image/png,application/pdf" multiple className="hidden" onChange={e => { agregar(e.target.files); e.target.value = "" }} />

      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => camara.current?.click()} disabled={bloqueado} className="flex h-24 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50 text-sm font-semibold text-indigo-700 active:bg-indigo-100 disabled:opacity-50">
          <Camera size={26} />
          Tomar foto
        </button>
        <button type="button" onClick={() => galeria.current?.click()} disabled={bloqueado} className="flex h-24 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 text-sm font-semibold text-slate-600 active:bg-slate-100 disabled:opacity-50">
          <FileUp size={26} />
          Elegir archivo
        </button>
      </div>

      {preparando && (
        <p className="mt-3 flex items-center gap-2 text-xs text-slate-500"><Loader2 size={14} className="animate-spin" /> Preparando la foto...</p>
      )}

      {archivos.length > 0 && (
        <ul className="mt-4 space-y-2">
          {archivos.map((archivo, i) => (
            <li key={`${archivo.name}-${i}`} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2">
              {archivo.type.startsWith("image/")
                ? <Miniatura archivo={archivo} />
                : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-slate-100 text-slate-400"><Paperclip size={18} /></span>}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-slate-700">{archivo.name}</p>
                <p className="text-[11px] text-slate-400">{formatoTamano(archivo.size)}</p>
              </div>
              <button type="button" onClick={() => onCambio(archivos.filter((_, j) => j !== i))} disabled={deshabilitado} className="p-2 text-slate-400 active:text-red-600" aria-label={`Quitar ${archivo.name}`}>
                <Trash2 size={17} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
