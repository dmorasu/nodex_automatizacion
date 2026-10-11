"use client"

import { eliminarSoporteAnticipo } from "@/actions/gastos/anticipos"
import { esDocumentoFactura, type AnticipoDetalle } from "@/src/schemas/gastos"
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
  const soportes = anticipo.documentos.filter(d => !esDocumentoFactura(d))
  return (
    <ListaDocumentos
      documentos={soportes}
      vacio="Sin soportes."
      puedeEliminar={documento => anticipo.permisos.editar && soportes.length > 1 && (documento.subidoPor === usuarioId || esAdmin)}
      onEliminar={documentoId => eliminarSoporteAnticipo(documentoId, anticipo.id)}
    />
  )
}
