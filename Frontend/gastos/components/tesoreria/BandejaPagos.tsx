"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CalendarClock, Wallet } from "lucide-react"
import { formatoMoneda } from "@/src/lib/formato"
import type { Bolsa, GastoListado } from "@/src/schemas/gastos"
import SeleccionGastos from "../gastos/SeleccionGastos"
import { claseBotonPrimario } from "../ui/estilos"
import ModalPago from "./ModalPago"

// Gastos en estado Solicitado con selección. Los generales se programan para aprobación de
// Dirección de Negocio; las compras de certificados (`directo`) se pagan de una vez.
export default function BandejaPagos({ gastos, bolsas, directo = false }: { gastos: GastoListado[], bolsas: Bolsa[], directo?: boolean }) {
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
            {directo ? <Wallet size={15} /> : <CalendarClock size={15} />}
            {directo ? "Pagar seleccionados" : "Programar pago"}
          </button>
        )}
      />

      {aPagar && (
        <ModalPago
          gastos={aPagar.gastos}
          bolsas={bolsas.filter(b => b.activo)}
          directo={directo}
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
