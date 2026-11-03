import Link from "next/link"
import { FileSpreadsheet, Search } from "lucide-react"
import { fetchApi } from "@/src/lib/api"
import { obtenerBolsasActivas } from "@/src/lib/datosGastos"
import { formatoMoneda } from "@/src/lib/formato"
import { PagadoTramitadorSchema } from "@/src/schemas/gastos"
import TablaPagadoTramitador from "./TablaPagadoTramitador"
import { claseBotonSecundario, claseInput } from "../ui/estilos"
import SelectBuscable from "@/components/ui/SelectBuscable"

export type FiltrosPagadoTramitador = {
  busqueda?: string
  bolsaId?: string
  desde?: string
  hasta?: string
  estadoTramite?: string
  mostrar?: string
}

const OPCIONES_MOSTRAR = [
  { valor: "todos", nombre: "Todos" },
  { valor: "porJustificar", nombre: "Con saldo por justificar" },
  { valor: "reintegroPendiente", nombre: "Con reintegro pendiente" }
]

// Pagado por tramitador con filtros (reemplaza Reintegros por tramitador). Se usa igual en
// Tesorería, Legalización y Contabilidad; `ruta` es la dirección de la pestaña para limpiar filtros.
export default async function PaginaPagadoTramitador({ ruta, filtros }: { ruta: string, filtros: FiltrosPagadoTramitador }) {
  const consulta = new URLSearchParams(
    Object.entries(filtros).filter(([, v]) => typeof v === "string" && v) as [string, string][]
  )

  const [respuesta, bolsas] = await Promise.all([
    fetchApi(`/gastos/pagado-tramitador?${consulta}`),
    obtenerBolsasActivas()
  ])
  const { totales, tramitadores, estadosTramite } = PagadoTramitadorSchema.parse(await respuesta.json())
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
          <SelectBuscable name="bolsaId" defaultValue={filtros.bolsaId ?? ""} className={`${claseInput} w-44`}>
            <option value="">Todas las bolsas</option>
            {bolsas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
          </SelectBuscable>
        </label>
        <label className="block">
          <span className="block mb-1 text-[11px] font-medium text-slate-500">Pagados desde</span>
          <input type="date" name="desde" defaultValue={filtros.desde} className={claseInput} />
        </label>
        <label className="block">
          <span className="block mb-1 text-[11px] font-medium text-slate-500">Hasta</span>
          <input type="date" name="hasta" defaultValue={filtros.hasta} className={claseInput} />
        </label>
        <label className="block">
          <span className="block mb-1 text-[11px] font-medium text-slate-500">Estado del trámite</span>
          <SelectBuscable name="estadoTramite" defaultValue={filtros.estadoTramite ?? ""} className={`${claseInput} w-52`}>
            <option value="">Todos los estados</option>
            {estadosTramite.map(e => <option key={e} value={e}>{e}</option>)}
          </SelectBuscable>
        </label>
        <label className="block">
          <span className="block mb-1 text-[11px] font-medium text-slate-500">Mostrar</span>
          <SelectBuscable name="mostrar" defaultValue={filtros.mostrar ?? "todos"} className={`${claseInput} w-52`}>
            {OPCIONES_MOSTRAR.map(o => <option key={o.valor} value={o.valor}>{o.nombre}</option>)}
          </SelectBuscable>
        </label>
        <button type="submit" className={claseBotonSecundario}>Filtrar</button>
        {hayFiltros && <Link href={ruta} className="pb-2 text-xs text-slate-500 hover:underline">Limpiar</Link>}
        {totales.gastos > 0 && (
          <a href={`/descargas/pagado-tramitador?${consulta}`} className={`${claseBotonSecundario} ml-auto`}>
            <FileSpreadsheet size={14} /> Descargar Excel
          </a>
        )}
      </form>

      {/* TOTALES DEL RESULTADO */}
      <p className="text-xs text-slate-500">
        <b className="text-slate-700">{totales.tramitadores}</b> tramitador(es) · <b className="text-slate-700">{totales.gastos}</b> gasto(s) ·{" "}
        pagado <b className="text-slate-800">{formatoMoneda(totales.pagado)}</b> · facturado <b className="text-slate-700">{formatoMoneda(totales.facturado)}</b> ·{" "}
        reintegrado <b className="text-slate-700">{formatoMoneda(totales.reintegrado)}</b> · reintegro pendiente <b className="text-slate-700">{formatoMoneda(totales.reintegroPendiente)}</b> ·{" "}
        por justificar <b className="text-slate-800">{formatoMoneda(totales.porJustificar)}</b>
      </p>

      <TablaPagadoTramitador filas={tramitadores} />
    </div>
  )
}
