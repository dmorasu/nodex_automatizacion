"use client"

import { formatoMoneda } from "@/src/lib/formato"
import type { GastoListado } from "@/src/schemas/gastos"
import EstadoGasto from "../gastos/EstadoGasto"
import SeleccionGastos from "../gastos/SeleccionGastos"
import BotonDescargarDocumentos, { MAXIMO_DESCARGA } from "./BotonDescargarDocumentos"

// Selección de gastos para descargar todos sus documentos en un ZIP
export default function BandejaDescargaDocumentos({ gastos }: { gastos: GastoListado[] }) {
  return (
    <SeleccionGastos
      gastos={gastos}
      vacio="No hay gastos con estos filtros."
      valorTotal={g => Number(g.valorRealmentePagado ?? 0)}
      columnas={[
        { titulo: "Estado", valor: g => <EstadoGasto codigo={g.estado.codigo} nombre={g.estado.nombre} /> },
        { titulo: "Beneficiario", valor: g => g.beneficiario.nombre },
        { titulo: "Trámite", valor: g => (g.solicitudTramiteId ? `#${g.solicitudTramiteId}` : "—") },
        { titulo: "Factura", valor: g => g.factura?.numeroFactura ?? (g.factura ? "Sin número" : "—") },
        { titulo: "Pagado", alinearDerecha: true, valor: g => formatoMoneda(g.valorRealmentePagado) }
      ]}
      accion={(seleccionados, limpiar) => (
        <div className="flex items-center gap-3">
          {seleccionados.length > MAXIMO_DESCARGA && (
            <span className="text-[11px] text-red-600">Máximo {MAXIMO_DESCARGA} a la vez</span>
          )}
          <BotonDescargarDocumentos
            gastoIds={seleccionados.map(g => g.id)}
            texto={seleccionados.length ? `Descargar documentos (${seleccionados.length})` : "Descargar documentos"}
            alTerminar={limpiar}
          />
        </div>
      )}
    />
  )
}
