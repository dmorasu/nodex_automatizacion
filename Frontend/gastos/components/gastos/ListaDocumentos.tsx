"use client"

import { useTransition } from "react"
import { toast } from "react-toastify"
import { ExternalLink, FileText, Trash2 } from "lucide-react"
import { formatoFechaHora, formatoTamano } from "@/src/lib/formato"
import type { GastoDetalle } from "@/src/schemas/gastos"

type Documento = GastoDetalle["documentos"][number]
type Resultado = { ok: true } | { ok: false, errores: string[] }

// Lista de documentos con enlace para abrirlos y opción de eliminar
export default function ListaDocumentos({
  documentos,
  puedeEliminar,
  onEliminar,
  vacio = "No hay documentos."
}: {
  documentos: Documento[]
  puedeEliminar?: (documento: Documento) => boolean
  onEliminar?: (documentoId: number) => Promise<Resultado>
  vacio?: string
}) {
  const [eliminando, startEliminar] = useTransition()

  const eliminar = (documento: Documento) => {
    if (!onEliminar || !confirm(`¿Eliminar el documento "${documento.nombreOriginal}"?`)) return

    startEliminar(async () => {
      const resultado = await onEliminar(documento.id)
      if (resultado.ok) toast.success("Documento eliminado")
      else resultado.errores.forEach(error => toast.error(error))
    })
  }

  if (documentos.length === 0) {
    return <p className="py-6 text-center text-xs text-slate-400">{vacio}</p>
  }

  return (
    <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
      {documentos.map(documento => (
        <li key={documento.id} className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <FileText size={18} className="shrink-0 text-slate-400" />
            <div className="min-w-0">
              <a
                href={`/documentos/${documento.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline truncate"
              >
                {documento.nombreOriginal}
                <ExternalLink size={12} />
              </a>
              <p className="text-[11px] text-slate-400">
                {documento.tipoDocumento.nombre} · {formatoTamano(documento.tamano)} · {documento.usuario?.nombreUsuario} · {formatoFechaHora(documento.createdAt)}
              </p>
            </div>
          </div>

          {onEliminar && puedeEliminar?.(documento) && (
            <button
              type="button"
              onClick={() => eliminar(documento)}
              disabled={eliminando}
              className="shrink-0 text-slate-300 hover:text-red-500 disabled:opacity-40"
              aria-label={`Eliminar ${documento.nombreOriginal}`}
            >
              <Trash2 size={16} />
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}
