import { redirect } from "next/navigation"
import { obtenerSesion } from "@/src/auth/dal"
import { soloCertificados } from "@/src/auth/permisos"
import BandejaPorPagar from "@/components/tesoreria/BandejaPorPagar"

// Por pagar (general): todo menos las compras de certificados y los gastos de anticipos
export default async function PorPagarPage({ searchParams }: { searchParams: { bolsaId?: string, busqueda?: string } }) {
  const sesion = await obtenerSesion()
  // Quien solo paga certificados va directo a su bandeja
  if (soloCertificados(sesion.roles)) redirect("/tesoreria/certificados")

  return <BandejaPorPagar tipo="general" searchParams={searchParams} />
}
