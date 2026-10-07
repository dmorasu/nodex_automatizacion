"use client"

import { eliminarSoporteAnticipo } from "@/actions/gastos/anticipos"
import type { AnticipoDetalle } from "@/src/schemas/gastos"
import ListaDocumentos from "../gastos/ListaDocumentos"

// Soportes de la consignación. Se pueden quitar (quien los subió o un administrador) mientras
// el anticipo se puede corregir; para agregar se usa Editar / Corregir.
export default function SoportesAnticipo({
  anticipo,
  usuarioId,
  esAdmin
}: {
  anticipo: AnticipoDetalle
  usuarioId: number
  esAdmin: boolean
}) {
  return (
    <ListaDocumentos
      documentos={anticipo.documentos}
      vacio="Sin soportes."
      puedeEliminar={documento => anticipo.permisos.editar && anticipo.documentos.length > 1 && (documento.subidoPor === usuarioId || esAdmin)}
      onEliminar={documentoId => eliminarSoporteAnticipo(documentoId, anticipo.id)}
    />
  )
}
