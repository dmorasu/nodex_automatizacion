import { fetchApi } from "@/src/lib/api"
import { ParametrosSchema } from "@/src/schemas/gastos"
import ParametroIva from "@/components/catalogos/ParametroIva"

// IVA de las solicitudes de factura (solo Administrador, lo revisa el layout de Catálogos)
export default async function IvaPage() {
  const parametros = ParametrosSchema.parse(await (await fetchApi("/gastos/parametros")).json())
  const iva = Number(parametros.find(p => p.clave === "IVA")?.valor ?? 0.19)

  return <ParametroIva tarifa={Math.round(iva * 10000) / 100} />
}
