import DetalleCuentaCobro from "@/components/legalizacion/DetalleCuentaCobro"

export default async function CuentaCobroPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  return <DetalleCuentaCobro id={Number(params.id)} rutaBase="/contabilidad/cuentas" />
}
