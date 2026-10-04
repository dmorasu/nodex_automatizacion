"use client"

import { useRef, useState, useTransition } from "react"
import { toast } from "react-toastify"
import { Upload, Loader2 } from "lucide-react"
import { eliminarDocumento, subirDocumentos } from "@/actions/gastos/gastos"
import type { GastoDetalle, ItemCatalogo } from "@/src/schemas/gastos"
import { claseBotonPrimario, claseInput } from "../ui/estilos"
import ListaDocumentos from "./ListaDocumentos"

export default function DocumentosGasto({
  gastoId,
  documentos,
  tiposDocumento,
  puedeSubir,
  usuarioId,
  esAdmin
}: {
  gastoId: number
  documentos: GastoDetalle["documentos"]
  tiposDocumento: ItemCatalogo[]
  puedeSubir: boolean
  usuarioId: number
  esAdmin: boolean
}) {
  const formulario = useRef<HTMLFormElement>(null)
  const [tipoDocumentoId, setTipoDocumentoId] = useState("")
  const [archivos, setArchivos] = useState<File[]>([])
  const [subiendo, startSubir] = useTransition()

  const subir = (e: React.FormEvent) => {
    e.preventDefault()

    if (!tipoDocumentoId) return toast.error("Seleccione el tipo de documento")
    if (archivos.length === 0) return toast.error("Seleccione al menos un archivo")

    const datos = new FormData()
    datos.append("tipoDocumentoId", tipoDocumentoId)
    archivos.forEach(archivo => datos.append("archivos", archivo))

    startSubir(async () => {
      const resultado = await subirDocumentos(gastoId, datos)

      if (!resultado.ok) {
        resultado.errores.forEach(error => toast.error(error))
        return
      }

      toast.success("Documentos cargados")
      formulario.current?.reset()
      setArchivos([])
      setTipoDocumentoId("")
    })
  }

  return (
    <div className="space-y-4">

      {puedeSubir && (
        <form ref={formulario} onSubmit={subir} className="flex flex-wrap items-end gap-3 rounded-md border border-dashed border-slate-300 p-4">
          <label className="block min-w-[180px]">
            <span className="block mb-1.5 text-xs font-medium text-slate-600">Tipo de documento</span>
            <select value={tipoDocumentoId} onChange={e => setTipoDocumentoId(e.target.value)} className={claseInput}>
              <option value="">Seleccione</option>
              {tiposDocumento.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </label>

          <label className="block flex-1 min-w-[220px]">
            <span className="block mb-1.5 text-xs font-medium text-slate-600">Archivos (PDF, JPG o PNG · máx. 15 MB c/u)</span>
            <input
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={e => setArchivos(Array.from(e.target.files ?? []))}
              className="block w-full text-xs text-slate-500 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-medium file:text-slate-600 hover:file:bg-slate-200"
            />
          </label>

          <button type="submit" disabled={subiendo} className={claseBotonPrimario}>
            {subiendo ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            Subir
          </button>
        </form>
      )}

      <ListaDocumentos
        documentos={documentos}
        puedeEliminar={documento => puedeSubir && (documento.subidoPor === usuarioId || esAdmin)}
        onEliminar={documentoId => eliminarDocumento(documentoId, gastoId)}
        vacio="Este gasto no tiene documentos."
      />
    </div>
  )
}
