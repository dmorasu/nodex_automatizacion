"use client"

import { useRef, useState, useTransition } from "react"
import { toast } from "react-toastify"
import { Loader2, Upload } from "lucide-react"
import type { GastoDetalle } from "@/src/schemas/gastos"
import ListaDocumentos from "./ListaDocumentos"
import { claseBotonPrimario } from "../ui/estilos"

type Documento = GastoDetalle["documentos"][number]
type Resultado = { ok: true } | { ok: false, errores: string[] }

// Formulario para subir archivos (campo "archivos") + lista de los ya cargados
export default function DocumentosConCarga({
  documentos,
  onSubir,
  onEliminar,
  puedeSubir = true,
  usuarioId,
  esAdmin,
  etiquetaBoton = "Subir",
  vacio
}: {
  documentos: Documento[]
  onSubir: (archivos: FormData) => Promise<Resultado>
  onEliminar: (documentoId: number) => Promise<Resultado>
  puedeSubir?: boolean
  usuarioId: number
  esAdmin: boolean
  etiquetaBoton?: string
  vacio?: string
}) {
  const formulario = useRef<HTMLFormElement>(null)
  const [archivos, setArchivos] = useState<File[]>([])
  const [subiendo, startSubir] = useTransition()

  const subir = (e: React.FormEvent) => {
    e.preventDefault()
    if (archivos.length === 0) return toast.error("Seleccione al menos un archivo")

    const datos = new FormData()
    archivos.forEach(archivo => datos.append("archivos", archivo))

    startSubir(async () => {
      const resultado = await onSubir(datos)

      if (!resultado.ok) {
        resultado.errores.forEach(error => toast.error(error))
        return
      }

      toast.success("Documentos cargados")
      formulario.current?.reset()
      setArchivos([])
    })
  }

  return (
    <div className="space-y-4">
      {puedeSubir && (
        <form ref={formulario} onSubmit={subir} className="flex flex-wrap items-end gap-3 rounded-md border border-dashed border-slate-300 p-4">
          <input
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={e => setArchivos(Array.from(e.target.files ?? []))}
            className="block flex-1 min-w-[220px] text-xs text-slate-500 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-medium file:text-slate-600 hover:file:bg-slate-200"
            aria-label="Archivos"
          />
          <button type="submit" disabled={subiendo} className={claseBotonPrimario}>
            {subiendo ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            {etiquetaBoton}
          </button>
        </form>
      )}

      <ListaDocumentos
        documentos={documentos}
        puedeEliminar={documento => puedeSubir && (documento.subidoPor === usuarioId || esAdmin)}
        onEliminar={onEliminar}
        vacio={vacio}
      />
    </div>
  )
}
