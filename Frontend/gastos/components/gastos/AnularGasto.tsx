"use client"

import { anularGasto } from "@/actions/gastos/gastos"
import BotonConMotivo from "../ui/BotonConMotivo"

export default function AnularGasto({ gastoId, codigo }: { gastoId: number, codigo: string }) {
  return (
    <BotonConMotivo
      etiqueta="Anular"
      titulo={`Anular gasto ${codigo}`}
      descripcion="El gasto queda anulado y no podrá pagarse. Esta acción no se puede deshacer."
      mensajeExito={`Gasto ${codigo} anulado`}
      onConfirmar={motivo => anularGasto(gastoId, motivo)}
    />
  )
}
