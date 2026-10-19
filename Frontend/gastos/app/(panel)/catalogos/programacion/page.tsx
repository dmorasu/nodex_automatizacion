import { fetchApi } from "@/src/lib/api"
import { ParametrosSchema } from "@/src/schemas/gastos"
import HoraCorteProgramacion from "@/components/catalogos/HoraCorteProgramacion"

// Programación de pagos: hora hasta la que un gasto nuevo se programa el mismo día
// (solo Administrador, lo revisa el layout de Catálogos)
export default async function ProgramacionPage() {
  const parametros = ParametrosSchema.parse(await (await fetchApi("/gastos/parametros")).json())
  const horas = Number(parametros.find(p => p.clave === "HORA_CORTE_PROGRAMACION")?.valor ?? 9)
  const minutos = Math.round(horas * 60)
  const hora = `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`

  return <HoraCorteProgramacion hora={hora} />
}
