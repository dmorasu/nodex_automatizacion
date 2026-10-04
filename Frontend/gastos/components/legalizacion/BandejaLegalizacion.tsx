"use client"

import { useState } from "react"
import { FilePlus2 } from "lucide-react"
import { formatoMoneda } from "@/src/lib/formato"
import type { CuentaListado, GastoListado } from "@/src/schemas/gastos"
import SeleccionGastos from "../gastos/SeleccionGastos"
import { claseBotonPrimario } from "../ui/estilos"
import ModalAgregarACuenta from "./ModalAgregarACuenta"

// Gastos con factura registrada que aún no están en una cuenta de cobro
export default function BandejaLegalizacion({ gastos, borradores }: { gastos: GastoListado[], borradores: CuentaListado[] }) {
  const [aAgregar, setAAgregar] = useState<GastoListado[] | null>(null)

  return (
    <>
      <SeleccionGastos
        gastos={gastos}
        vacio="No hay gastos facturados pendientes de legalizar. Registre las facturas en la pestaña Gastos sin factura."
        valorTotal={g => Number(g.factura?.valorLegalizado ?? 0)}
        columnas={[
          { titulo: "Beneficiario", valor: g => g.beneficiario.nombre },
          { titulo: "Bolsa", valor: g => g.bolsa?.nombre ?? "—" },
          { titulo: "Factura", valor: g => g.factura?.numeroFactura ?? "—" },
          { titulo: "Pagado", alinearDerecha: true, valor: g => formatoMoneda(g.valorRealmentePagado) },
          { titulo: "Valor factura", alinearDerecha: true, valor: g => formatoMoneda(g.factura?.valorFactura) },
          { titulo: "A legalizar", alinearDerecha: true, valor: g => <b className="text-slate-800">{formatoMoneda(g.factura?.valorLegalizado)}</b> }
        ]}
        accion={seleccionados => (
          <button
            type="button"
            onClick={() => setAAgregar(seleccionados)}
            disabled={seleccionados.length === 0}
            className={claseBotonPrimario}
          >
            <FilePlus2 size={15} />
            Agregar a cuenta de cobro
          </button>
        )}
      />

      {aAgregar && <ModalAgregarACuenta gastos={aAgregar} borradores={borradores} onCerrar={() => setAAgregar(null)} />}
    </>
  )
}
