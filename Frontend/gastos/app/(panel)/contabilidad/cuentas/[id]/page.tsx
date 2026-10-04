import DetalleCuentaCobro from "@/components/legalizacion/DetalleCuentaCobro"

export default function CuentaCobroPage({ params }: { params: { id: string } }) {
  return <DetalleCuentaCobro id={Number(params.id)} rutaBase="/contabilidad/cuentas" />
}
