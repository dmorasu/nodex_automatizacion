import { obtenerCuentas } from "@/src/lib/datosLegalizacion"
import BandejaContabilizar from "@/components/contabilidad/BandejaContabilizar"

const MAXIMO_BANDEJA = 100

// Cuentas de cobro legalizadas pendientes de contabilizar
export default async function PorContabilizarPage() {
  const { total, registros } = await obtenerCuentas({ estado: "LEGALIZADA", tamano: MAXIMO_BANDEJA })

  return (
    <div className="space-y-4">
      {total > MAXIMO_BANDEJA && (
        <p className="text-xs text-amber-700">Se muestran {MAXIMO_BANDEJA} de {total} cuentas pendientes.</p>
      )}
      <BandejaContabilizar cuentas={registros} />
    </div>
  )
}
