import { fetchApi } from "@/src/lib/api"
import { ParametrosSchema } from "@/src/schemas/gastos"
import ParametrosRetencion from "@/components/catalogos/ParametrosRetencion"

// Retención de las cuentas de cobro de los tramitadores: UVT del año y tarifa fija
// (solo Administrador, lo revisa el layout de Catálogos)
export default async function RetencionPage() {
  const parametros = ParametrosSchema.parse(await (await fetchApi("/gastos/parametros")).json())
  const valor = (clave: string) => Number(parametros.find(p => p.clave === clave)?.valor ?? 0)

  return <ParametrosRetencion uvt={valor("UVT")} tarifa={Math.round(valor("RETENCION_TRAMITADORES") * 10000) / 100} />
}
