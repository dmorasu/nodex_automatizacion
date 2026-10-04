"use client"

import { anularCuenta, eliminarDocumentoLegalizacion, subirDocumentosCuenta } from "@/actions/gastos/legalizacion"
import type { CuentaDetalle } from "@/src/schemas/gastos"
import BotonConMotivo from "../ui/BotonConMotivo"
import DocumentosConCarga from "../gastos/DocumentosConCarga"
import LegalizarCuenta from "./LegalizarCuenta"

// Botones de la cuenta en borrador: anular (Legalización) y legalizar (Legalización o Tesorería)
export function BotonesCuenta({ cuenta }: { cuenta: CuentaDetalle }) {
  if (!cuenta.permisos.editar && !cuenta.permisos.legalizar) return null

  return (
    <div className="flex gap-3">
      {cuenta.permisos.editar && <BotonConMotivo
        etiqueta="Anular"
        titulo={`Anular ${cuenta.numeroCuentaCobro}`}
        descripcion="Los gastos de la cuenta vuelven a Gastos con factura y quedan disponibles para otra cuenta de cobro."
        mensajeExito={`Cuenta ${cuenta.numeroCuentaCobro} anulada`}
        onConfirmar={motivo => anularCuenta(cuenta.id, motivo)}
      />}
      {cuenta.permisos.legalizar && <LegalizarCuenta cuenta={cuenta} />}
    </div>
  )
}

export function DocumentosCuenta({ cuenta, usuarioId, esAdmin }: { cuenta: CuentaDetalle, usuarioId: number, esAdmin: boolean }) {
  return (
    <DocumentosConCarga
      documentos={cuenta.documentos}
      onSubir={archivos => subirDocumentosCuenta(cuenta.id, archivos)}
      onEliminar={eliminarDocumentoLegalizacion}
      puedeSubir={cuenta.permisos.subirDocumentos}
      usuarioId={usuarioId}
      esAdmin={esAdmin}
      vacio="Aún no se ha cargado la cuenta de cobro."
    />
  )
}
