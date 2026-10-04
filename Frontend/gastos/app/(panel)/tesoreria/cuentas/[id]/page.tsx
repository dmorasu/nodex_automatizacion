import { ROLES } from "@/src/auth/permisos"
import { requiereAcceso } from "@/src/auth/dal"
import DetalleCuentaCobro from "@/components/legalizacion/DetalleCuentaCobro"

export default async function CuentaCobroPage({ params }: { params: { id: string } }) {
  // Solo Tesorería general (Tesorería - Certificados solo ve su bandeja y sus pagos)
  await requiereAcceso([ROLES.TESORERIA])

  return <DetalleCuentaCobro id={Number(params.id)} rutaBase="/tesoreria/cuentas" />
}
