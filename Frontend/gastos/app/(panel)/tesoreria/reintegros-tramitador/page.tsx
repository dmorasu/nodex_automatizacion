import { TESORERIA_OPERATIVA } from "@/src/auth/permisos"
import { requiereAcceso } from "@/src/auth/dal"
import PaginaPagadoTramitador, { type FiltrosPagadoTramitador } from "@/components/tablero/PaginaPagadoTramitador"

export default async function PagadoTramitadorPage(props: { searchParams: Promise<FiltrosPagadoTramitador> }) {
  const searchParams = await props.searchParams
  // Tesorería y Analista de Tesorería (Tesorería - Certificados solo ve su bandeja y sus pagos)
  await requiereAcceso(TESORERIA_OPERATIVA)

  return <PaginaPagadoTramitador ruta="/tesoreria/reintegros-tramitador" filtros={searchParams} />
}
