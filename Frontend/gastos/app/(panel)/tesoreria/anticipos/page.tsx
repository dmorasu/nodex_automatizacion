import { requiereAcceso } from "@/src/auth/dal"
import { ROLES } from "@/src/auth/permisos"
import BandejaPorPagar from "@/components/tesoreria/BandejaPorPagar"

// Gastos que nacen de anticipos de clientes: el cliente ya pagó, así que no pasan por Dirección
// de Negocio. Tesorería los paga directo con el soporte del banco (bolsa de anticipos) y al
// creador le llega el aviso de pagado.
export default async function GastosAnticiposPage({ searchParams }: { searchParams: { bolsaId?: string, busqueda?: string } }) {
  await requiereAcceso([ROLES.TESORERIA])

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Gastos de anticipos de clientes por pagar. Se pagan directo (sin aprobación de Dirección de Negocio) desde la bolsa de
        anticipos; se descuentan del saldo del cliente y se le avisa a quien creó el gasto.
      </p>
      <BandejaPorPagar tipo="anticipos" searchParams={searchParams} />
    </div>
  )
}
