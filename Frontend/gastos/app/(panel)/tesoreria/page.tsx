import { redirect } from "next/navigation"
import { obtenerSesion } from "@/src/auth/dal"
import { ROLES, soloCertificados, tieneAcceso } from "@/src/auth/permisos"
import BandejaPorPagar from "@/components/tesoreria/BandejaPorPagar"

// Por pagar (general): todo menos las compras de certificados y los gastos de anticipos
export default async function PorPagarPage({ searchParams }: { searchParams: { bolsaId?: string, busqueda?: string } }) {
  const sesion = await obtenerSesion()
  // Quien solo paga certificados va directo a su bandeja
  if (soloCertificados(sesion.roles)) redirect("/tesoreria/certificados")
  // La auxiliar de caja menor solo maneja su caja
  if (!tieneAcceso(sesion.roles, [ROLES.TESORERIA, ROLES.TESORERIA_CERTIFICADOS])) redirect("/tesoreria/caja-menor")

  return <BandejaPorPagar tipo="general" searchParams={searchParams} />
}
