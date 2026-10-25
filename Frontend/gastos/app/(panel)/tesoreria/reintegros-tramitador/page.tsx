import { ROLES } from "@/src/auth/permisos"
import { requiereAcceso } from "@/src/auth/dal"
import PaginaReintegrosTramitador, { type FiltrosReintegrosTramitador } from "@/components/tablero/PaginaReintegrosTramitador"

export default async function ReintegrosTramitadorPage(props: { searchParams: Promise<FiltrosReintegrosTramitador> }) {
  const searchParams = await props.searchParams
  // Solo Tesorería general (Tesorería - Certificados solo ve su bandeja y sus pagos)
  await requiereAcceso([ROLES.TESORERIA])

  return <PaginaReintegrosTramitador ruta="/tesoreria/reintegros-tramitador" filtros={searchParams} />
}
