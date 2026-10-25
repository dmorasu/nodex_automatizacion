import PaginaReintegrosTramitador, { type FiltrosReintegrosTramitador } from "@/components/tablero/PaginaReintegrosTramitador"

export default async function ReintegrosTramitadorPage(props: { searchParams: Promise<FiltrosReintegrosTramitador> }) {
  const searchParams = await props.searchParams
  return <PaginaReintegrosTramitador ruta="/legalizacion/reintegros-tramitador" filtros={searchParams} />
}
