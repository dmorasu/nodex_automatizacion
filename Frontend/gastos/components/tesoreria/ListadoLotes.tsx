import Link from "next/link"
import { Search, X } from "lucide-react"
import { obtenerLotes } from "@/src/lib/datosTesoreria"
import { obtenerBolsasActivas } from "@/src/lib/datosGastos"
import Paginacion from "@/components/ui/Paginacion"
import TablaLotes from "@/components/tesoreria/TablaLotes"
import { claseBotonSecundario, claseInput } from "@/components/ui/estilos"

export type FiltrosListadoLotes = { busqueda?: string, bolsaId?: string, desde?: string, hasta?: string, pagina?: string }

// Lotes de pago filtrados por estado. Lo usan Tesorería (programados y pagos realizados) y
// Dirección de Negocio (por aprobar e historial); el detalle se abre en `rutaDetalle/:id`.
// `confirmables`: los lotes aprobados se marcan y se confirman juntos (Tesorería → Programados).
export default async function ListadoLotes({
  searchParams,
  estado,
  rutaBase,
  rutaDetalle,
  vacio,
  confirmables = false
}: {
  searchParams: FiltrosListadoLotes
  estado: string
  rutaBase: string
  rutaDetalle: string
  vacio: string
  confirmables?: boolean
}) {
  const pagina = Math.max(1, Number(searchParams.pagina) || 1)

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

      <TablaLotes
        registros={registros}
        estado={estado}
        rutaDetalle={rutaDetalle}
        vacio={hayFiltros ? "No hay lotes con estos filtros." : vacio}
        confirmables={confirmables}
      />

      <Paginacion pagina={pagina} total={total} tamano={tamano} url={url} />
    </div>
  )
}
