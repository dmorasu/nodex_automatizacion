import { requiereAcceso } from "@/src/auth/dal"
import { TESORERIA_OPERATIVA } from "@/src/auth/permisos"
import BandejaPorPagar from "@/components/tesoreria/BandejaPorPagar"

// Gastos que nacen de anticipos de clientes: el cliente ya pagó, así que no pasan por Dirección
// de Negocio. Tesorería los paga directo con el soporte del banco (bolsa de anticipos) y al
// creador le llega el aviso de pagado.
export default async function GastosAnticiposPage({ searchParams }: { searchParams: { bolsaId?: string, busqueda?: string } }) {
  await requiereAcceso(TESORERIA_OPERATIVA)

  return (
    <div className="space-y-4">
      <BandejaPorPagar tipo="anticipos" searchParams={searchParams} />
    </div>
  )
}
