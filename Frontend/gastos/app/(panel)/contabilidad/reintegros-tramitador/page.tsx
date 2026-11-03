import PaginaPagadoTramitador, { type FiltrosPagadoTramitador } from "@/components/tablero/PaginaPagadoTramitador"

export default async function PagadoTramitadorPage(props: { searchParams: Promise<FiltrosPagadoTramitador> }) {
  const searchParams = await props.searchParams
  return <PaginaPagadoTramitador ruta="/contabilidad/reintegros-tramitador" filtros={searchParams} />
}
