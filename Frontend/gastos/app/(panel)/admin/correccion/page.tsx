import Link from "next/link"
import CorreccionMasivaGastos from "@/components/gastos/CorreccionMasivaGastos"

// Corrección masiva de gastos (el layout de /admin ya exige el administrador). Llega desde el
// Tablero de Control con sus filtros: el Excel sale con esos gastos
export default async function CorreccionMasivaPage(props: { searchParams: Promise<Record<string, string>> }) {
  const searchParams = await props.searchParams
  const filtros = new URLSearchParams({ ...searchParams, alcance: "todos" })
  filtros.delete("pagina")
  filtros.delete("tamano")
  const volver = new URLSearchParams(searchParams)
  volver.delete("alcance")

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-800">Corrección masiva</h2>
        <Link href={`/admin?${volver}`} className="text-xs font-semibold text-emerald-700 hover:underline">Volver al Tablero</Link>
      </div>

      <CorreccionMasivaGastos filtros={filtros.toString()} />
    </div>
  )
}
