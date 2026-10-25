import { TESORERIA_OPERATIVA } from "@/src/auth/permisos"
import { requiereAcceso } from "@/src/auth/dal"
import DetalleCuentaCobro from "@/components/legalizacion/DetalleCuentaCobro"

export default async function CuentaCobroPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  // Solo Tesorería general (Tesorería - Certificados solo ve su bandeja y sus pagos)
  await requiereAcceso(TESORERIA_OPERATIVA)

  return <DetalleCuentaCobro id={Number(params.id)} rutaBase="/tesoreria/cuentas" />
}
