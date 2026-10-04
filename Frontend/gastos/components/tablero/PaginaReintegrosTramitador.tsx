import Link from "next/link"
import { Search } from "lucide-react"
import { fetchApi } from "@/src/lib/api"
import { obtenerBolsasActivas } from "@/src/lib/datosGastos"
import { formatoMoneda } from "@/src/lib/formato"
import { ReintegrosTramitadorSchema } from "@/src/schemas/gastos"
import ReintegrosPorTramitador from "./ReintegrosPorTramitador"
import { claseBotonSecundario, claseInput } from "../ui/estilos"

export type FiltrosReintegrosTramitador = {
  busqueda?: string
  bolsaId?: string
  desde?: string
  hasta?: string
  estado?: string
  diasMinimos?: string
}

const ANTIGUEDADES = [
  { valor: "", nombre: "Cualquier antigüedad" },
  { valor: "30", nombre: "Más de 30 días" },
  { valor: "60", nombre: "Más de 60 días" },
  { valor: "90", nombre: "Más de 90 días" }
]

// Reintegros por tramitador con filtros. Se usa igual en Tesorería, Legalización y Contabilidad;
// `ruta` es la dirección de la pestaña para el enlace de limpiar filtros.
export default async function PaginaReintegrosTramitador({ ruta, filtros }: { ruta: string, filtros: FiltrosReintegrosTramitador }) {
  const consulta = new URLSearchParams(
    Object.entries(filtros).filter(([, v]) => typeof v === "string" && v) as [string, string][]
  )

  const [respuesta, bolsas] = await Promise.all([
    fetchApi(`/gastos/reintegros-tramitador?${consulta}`),
    obtenerBolsasActivas()
  ])
  const { totales, tramitadores } = ReintegrosTramitadorSchema.parse(await respuesta.json())
  const hayFiltros = consulta.toString() !== ""

  return (
    <div className="space-y-4">

      {/* FILTROS */}
      <form className="flex flex-wrap items-end gap-3">
        <label className="block flex-1 min-w-[220px]">
          <span className="block mb-1 text-[11px] font-medium text-slate-500">Tramitador</span>
          <span className="relative block">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
            <input name="busqueda" defaultValue={filtros.busqueda} placeholder="Nombre o identificación" className={`${claseInput} pl-9`} />
          </span>
        </label>
        <label className="block">
          <span className="block mb-1 text-[11px] font-medium text-slate-500">Bolsa</span>
          <select name="bolsaId" defaultValue={filtros.bolsaId ?? ""} className={`${claseInput} w-44`}>
            <option value="">Todas las bolsas</option>
            {bolsas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="block mb-1 text-[11px] font-medium text-slate-500">Gastos pagados desde</span>
          <input type="date" name="desde" defaultValue={filtros.desde} className={claseInput} />
        </label>
        <label className="block">
          <span className="block mb-1 text-[11px] font-medium text-slate-500">Hasta</span>
          <input type="date" name="hasta" defaultValue={filtros.hasta} className={claseInput} />
        </label>
        <label className="block">
          <span className="block mb-1 text-[11px] font-medium text-slate-500">Mostrar</span>
          <select name="estado" defaultValue={filtros.estado ?? "pendientes"} className={`${claseInput} w-44`}>
            <option value="pendientes">Solo con pendiente</option>
            <option value="todos">También ya reintegrados</option>
          </select>
        </label>
        <label className="block">
          <span className="block mb-1 text-[11px] font-medium text-slate-500">Antigüedad del pendiente</span>
          <select name="diasMinimos" defaultValue={filtros.diasMinimos ?? ""} className={`${claseInput} w-44`}>
            {ANTIGUEDADES.map(a => <option key={a.valor} value={a.valor}>{a.nombre}</option>)}
          </select>
        </label>
        <button type="submit" className={claseBotonSecundario}>Filtrar</button>
        {hayFiltros && <Link href={ruta} className="pb-2 text-xs text-slate-500 hover:underline">Limpiar</Link>}
      </form>

      {/* TOTALES DEL RESULTADO */}
      <p className="text-xs text-slate-500">
        <b className="text-slate-700">{totales.tramitadores}</b> tramitador(es) ·{" "}
        <b className="text-slate-700">{totales.gastosConReintegro}</b> gasto(s) con reintegro pendiente ·{" "}
        por reintegrar <b className="text-slate-800">{formatoMoneda(totales.pendiente)}</b> ·{" "}
        ya reintegrado <b className="text-slate-700">{formatoMoneda(totales.reintegrado)}</b>
      </p>

      <ReintegrosPorTramitador filas={tramitadores} />
      <p className="text-[11px] text-slate-400">Abra una fila para ver los gastos que componen el saldo pendiente.</p>
    </div>
  )
}
