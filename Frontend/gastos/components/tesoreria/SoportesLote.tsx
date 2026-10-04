"use client"

import { eliminarSoporteLote, subirSoporteLote } from "@/actions/gastos/tesoreria"
import type { LoteDetalle } from "@/src/schemas/gastos"
import DocumentosConCarga from "../gastos/DocumentosConCarga"

export default function SoportesLote({
  loteId,
  documentos,
  usuarioId,
  esAdmin
}: {
  loteId: number
  documentos: LoteDetalle["documentos"]
  usuarioId: number
  esAdmin: boolean
}) {
  return (
    <DocumentosConCarga
      documentos={documentos}
      onSubir={archivos => subirSoporteLote(loteId, archivos)}
      onEliminar={eliminarSoporteLote}
      usuarioId={usuarioId}
      esAdmin={esAdmin}
      etiquetaBoton="Subir soporte"
      vacio="Este lote no tiene soporte de pago."
    />
  )
}
