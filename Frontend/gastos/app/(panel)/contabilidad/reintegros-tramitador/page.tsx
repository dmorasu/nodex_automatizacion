import PaginaReintegrosTramitador, { type FiltrosReintegrosTramitador } from "@/components/tablero/PaginaReintegrosTramitador"

export default function ReintegrosTramitadorPage({ searchParams }: { searchParams: FiltrosReintegrosTramitador }) {
  return <PaginaReintegrosTramitador ruta="/contabilidad/reintegros-tramitador" filtros={searchParams} />
}
