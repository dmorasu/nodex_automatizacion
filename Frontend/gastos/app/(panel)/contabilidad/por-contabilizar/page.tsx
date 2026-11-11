import { obtenerCuentas } from "@/src/lib/datosLegalizacion"
import BandejaContabilizar from "@/components/contabilidad/BandejaContabilizar"

const MAXIMO_BANDEJA = 100

// Cuentas de cobro por contabilizar: las legalizadas y también los borradores, para que Contabilidad
// las vea y contabilice desde que Legalización las arma (decisión del usuario, 2026-11-11; reemplaza la
// pestaña Cuentas de cobro). Un borrador ya contabilizado sale de la bandeja hasta que lo legalicen.
export default async function PorContabilizarPage() {
  const { total, registros } = await obtenerCuentas({ estado: "BORRADOR,LEGALIZADA", porContabilizar: "si", tamano: MAXIMO_BANDEJA })

  return (
    <div className="space-y-4">
      {total > MAXIMO_BANDEJA && (
        <p className="text-xs text-amber-700">Se muestran {MAXIMO_BANDEJA} de {total} cuentas pendientes.</p>
      )}
      <BandejaContabilizar cuentas={registros} />
    </div>
  )
}
