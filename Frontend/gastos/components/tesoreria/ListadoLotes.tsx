import Link from "next/link"
import { Search, X } from "lucide-react"
import { obtenerLotes } from "@/src/lib/datosTesoreria"
import { obtenerBolsasActivas } from "@/src/lib/datosGastos"
import { formatoFecha, formatoMoneda } from "@/src/lib/formato"
import { ESTADOS_LOTE } from "@/src/schemas/gastos"
import Paginacion from "@/components/ui/Paginacion"
import EstadoGasto from "@/components/gastos/EstadoGasto"
import { claseBotonSecundario, claseInput } from "@/components/ui/estilos"

export type FiltrosListadoLotes = { busqueda?: string, bolsaId?: string, desde?: string, hasta?: string, pagina?: string }

// Cuántos códigos de gasto se muestran por lote antes de resumir con "+N"
const GASTOS_VISIBLES = 3

// Lotes de pago filtrados por estado. Lo usan Tesorería (programados y pagos realizados) y
// Dirección de Negocio (por aprobar e historial); el detalle se abre en `rutaDetalle/:id`.
export default async function ListadoLotes({
  searchParams,
  estado,
  rutaBase,
  rutaDetalle,
  vacio
}: {
  searchParams: FiltrosListadoLotes
  estado: string
  rutaBase: string
  rutaDetalle: string
  vacio: string
}) {
  const pagina = Math.max(1, Number(searchParams.pagina) || 1)
  const variosEstados = estado.includes(",")

  const [{ total, tamano, registros }, bolsas] = await Promise.all([
    obtenerLotes({ ...searchParams, estado, pagina }),
    obtenerBolsasActivas()
  ])

  const hayFiltros = Boolean(searchParams.busqueda || searchParams.bolsaId || searchParams.desde || searchParams.hasta)

  // Enlace de paginación conservando los filtros
  const url = (p: number) => {
    const parametros = new URLSearchParams(
      Object.entries({ ...searchParams, pagina: String(p) }).filter(([, v]) => v) as [string, string][]
    )
    return `${rutaBase}?${parametros}`
  }

  return (
    <div className="space-y-4">

      {/* FILTROS */}
      <form className="flex flex-wrap items-end gap-3">
        <label className="block flex-1 min-w-[240px]">
          <span className="block mb-1 text-[11px] font-medium text-slate-500">Buscar</span>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
            <input
              name="busqueda"
              defaultValue={searchParams.busqueda}
              placeholder="#lote, código de gasto, concepto, beneficiario o egreso"
              className={`${claseInput} pl-9`}
            />
          </div>
        </label>
        <label className="block">
          <span className="block mb-1 text-[11px] font-medium text-slate-500">Bolsa</span>
          <select name="bolsaId" defaultValue={searchParams.bolsaId ?? ""} className={`${claseInput} w-44`}>
            <option value="">Todas</option>
            {bolsas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="block mb-1 text-[11px] font-medium text-slate-500">Fecha desde</span>
          <input type="date" name="desde" defaultValue={searchParams.desde} className={claseInput} />
        </label>
        <label className="block">
          <span className="block mb-1 text-[11px] font-medium text-slate-500">Hasta</span>
          <input type="date" name="hasta" defaultValue={searchParams.hasta} className={claseInput} />
        </label>
        <button type="submit" className={claseBotonSecundario}>Filtrar</button>
        {hayFiltros && (
          <Link href={rutaBase} className="inline-flex items-center gap-1 h-10 px-2 text-xs text-slate-500 hover:text-slate-700">
            <X size={14} />
            Limpiar
          </Link>
        )}
      </form>

      <p className="text-xs text-slate-500">{total} lote(s) encontrado(s)</p>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Lote</th>
              {variosEstados && <th className="px-4 py-3 font-semibold">Estado</th>}
              <th className="px-4 py-3 font-semibold">Gastos</th>
              <th className="px-4 py-3 font-semibold">{estado === "PAGADO" ? "Fecha de pago" : "Fecha"}</th>
              <th className="px-4 py-3 font-semibold">Bolsa</th>
              <th className="px-4 py-3 font-semibold">Programado por</th>
              <th className="px-4 py-3 font-semibold text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {registros.map(lote => (
              <tr key={lote.id} className="align-top hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`${rutaDetalle}/${lote.id}`} className="font-semibold text-emerald-700 hover:underline">
                    #{lote.id}
                  </Link>
                </td>
                {variosEstados && (
                  <td className="px-4 py-3"><EstadoGasto codigo={lote.estado} nombre={ESTADOS_LOTE[lote.estado] ?? lote.estado} /></td>
                )}
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-x-2 gap-y-1">
                    {lote.gastos.slice(0, GASTOS_VISIBLES).map(gasto => (
                      <Link key={gasto.id} href={`/solicitudes/${gasto.id}`} className="text-emerald-700 hover:underline whitespace-nowrap">
                        {gasto.codigo}
                      </Link>
                    ))}
                    {lote.gastos.length > GASTOS_VISIBLES && (
                      <Link href={`${rutaDetalle}/${lote.id}`} className="text-slate-400 hover:text-slate-600 whitespace-nowrap">
                        +{lote.gastos.length - GASTOS_VISIBLES} más
                      </Link>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatoFecha(lote.fechaPago)}</td>
                <td className="px-4 py-3 text-slate-600">{lote.bolsa.nombre}</td>
                <td className="px-4 py-3 text-slate-600">{lote.creador?.nombreUsuario}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-800 whitespace-nowrap">{formatoMoneda(lote.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {registros.length === 0 && (
          <p className="py-14 text-center text-sm text-slate-400">
            {hayFiltros ? "No hay lotes con estos filtros." : vacio}
          </p>
        )}
      </div>

      <Paginacion pagina={pagina} total={total} tamano={tamano} url={url} />
    </div>
  )
}
