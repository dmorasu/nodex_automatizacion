"use client"

import { useState } from "react"
import { toast } from "react-toastify"
import { FileText, Plus, X } from "lucide-react"
import type { ItemCatalogo } from "@/src/schemas/gastos"
import { claseBotonSecundario, claseInput } from "../ui/estilos"

export type DocumentoPendiente = { tipoDocumentoId: number, archivo: File }

const TIPOS_ARCHIVO = ["application/pdf", "image/jpeg", "image/png"]
const MAX_MB = 15

// Documentos que se suben junto con el gasto nuevo (opcional). Solo los tipos de pago
// (Catálogos → Tipos de documento): se cargan después de crear el gasto
export default function DocumentosNuevoGasto({ tipos, documentos, onCambiar }: {
  tipos: ItemCatalogo[]
  documentos: DocumentoPendiente[]
  onCambiar: (documentos: DocumentoPendiente[]) => void
}) {
  const [tipoDocumentoId, setTipoDocumentoId] = useState(tipos.length === 1 ? String(tipos[0].id) : "")
  const [entrada, setEntrada] = useState(0) // reinicia el campo de archivos al agregarlos

  const agregar = (archivos: File[]) => {
    if (!tipoDocumentoId) return toast.error("Seleccione el tipo de documento")
    const validos = archivos.filter(archivo => {
      const error = !TIPOS_ARCHIVO.includes(archivo.type) ? `"${archivo.name}" no es PDF, JPG ni PNG`
        : archivo.size > MAX_MB * 1024 * 1024 ? `"${archivo.name}" pesa más de ${MAX_MB} MB`
          : null
      if (error) toast.error(error)
      return !error
    })
    onCambiar([...documentos, ...validos.map(archivo => ({ tipoDocumentoId: Number(tipoDocumentoId), archivo }))])
    setEntrada(n => n + 1)
  }

  const nombreTipo = (id: number) => tipos.find(t => t.id === id)?.nombre ?? ""

  if (tipos.length === 0) return <p className="text-xs text-slate-400">No hay tipos de documento para el pago.</p>

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block min-w-[200px]">
          <span className="mb-1.5 block text-xs font-medium text-slate-600">Tipo de documento</span>
          <select value={tipoDocumentoId} onChange={e => setTipoDocumentoId(e.target.value)} className={claseInput}>
            <option value="">Seleccione</option>
            {tipos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </label>
        <label className={`${claseBotonSecundario} cursor-pointer`}>
          <Plus size={15} /> Agregar archivos
          <input
            key={entrada}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={e => agregar(Array.from(e.target.files ?? []))}
            className="sr-only"
          />
        </label>
        <span className="pb-2.5 text-[11px] text-slate-400">PDF, JPG o PNG · máx. {MAX_MB} MB c/u</span>
      </div>

      {documentos.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
          {documentos.map((d, i) => (
            <li key={`${d.archivo.name}-${i}`} className="flex items-center gap-3 px-3 py-2 text-xs">
              <FileText size={15} className="shrink-0 text-slate-400" />
              <span className="min-w-0 flex-1 truncate text-slate-700">{d.archivo.name}</span>
              <span className="shrink-0 text-slate-400">{nombreTipo(d.tipoDocumentoId)}</span>
              <button type="button" onClick={() => onCambiar(documentos.filter((_, j) => j !== i))} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Quitar ${d.archivo.name}`}>
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
