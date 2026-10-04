"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Wallet } from "lucide-react"
import { formatoMoneda } from "@/src/lib/formato"
import type { Bolsa, GastoListado } from "@/src/schemas/gastos"
import SeleccionGastos from "../gastos/SeleccionGastos"
import { claseBotonPrimario } from "../ui/estilos"
import ModalPago from "./ModalPago"

// Gastos en estado Solicitado con selección para pagarlos de una sola vez
export default function BandejaPagos({ gastos, bolsas }: { gastos: GastoListado[], bolsas: Bolsa[] }) {
  const router = useRouter()
  const [aPagar, setAPagar] = useState<{ gastos: GastoListado[], limpiar: () => void } | null>(null)

  return (
    <>
      <SeleccionGastos
        gastos={gastos}
        vacio="No hay gastos pendientes de pago."
        valorTotal={g => Number(g.valorSolicitadoPago)}
        columnas={[
          {
            titulo: "Beneficiario",
            valor: g => <><p>{g.beneficiario.nombre}</p><p className="text-[11px] text-slate-400">{g.beneficiario.identificacion}</p></>
          },
          { titulo: "Bolsa", valor: g => g.bolsa?.nombre ?? "—" },
          { titulo: "Solicitante", valor: g => g.creador?.nombreUsuario },
          { titulo: "Valor solicitado", alinearDerecha: true, valor: g => <b className="text-slate-800">{formatoMoneda(g.valorSolicitadoPago)}</b> }
        ]}
        accion={(seleccionados, limpiar) => (
          <button
            type="button"
            onClick={() => setAPagar({ gastos: seleccionados, limpiar })}
            disabled={seleccionados.length === 0}
            className={claseBotonPrimario}
          >
            <Wallet size={15} />
            Pagar seleccionados
          </button>
        )}
      />

      {aPagar && (
        <ModalPago
          gastos={aPagar.gastos}
          bolsas={bolsas.filter(b => b.activo)}
          onCerrar={() => setAPagar(null)}
          onPagado={() => {
            aPagar.limpiar()
            setAPagar(null)
            router.refresh()
          }}
        />
      )}
    </>
  )
}
