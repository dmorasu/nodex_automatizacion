import PaginaReintegrosTramitador, { type FiltrosReintegrosTramitador } from "@/components/tablero/PaginaReintegrosTramitador"

export default function ReintegrosTramitadorPage({ searchParams }: { searchParams: FiltrosReintegrosTramitador }) {
  return <PaginaReintegrosTramitador ruta="/legalizacion/reintegros-tramitador" filtros={searchParams} />
}
