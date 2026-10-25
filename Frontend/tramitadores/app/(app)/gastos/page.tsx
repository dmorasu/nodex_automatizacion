import { obtenerDatos } from "@/src/lib/api"
import { formatoMoneda } from "@/src/lib/formato"
import { ListadoGastosSchema } from "@/src/schemas"
import TarjetaGasto from "@/components/gastos/TarjetaGasto"
import Paginacion from "@/components/ui/Paginacion"

// Solo los gastos en los que debe devolver un sobrante. Las facturas se suben
// desde el trámite (llegan solas al gasto).
export default async function GastosPage(props: { searchParams: Promise<{ pagina?: string }> }) {
  const searchParams = await props.searchParams
  const pagina = Math.max(1, Number(searchParams.pagina) || 1)
  const listado = (await obtenerDatos(`/gastos?pagina=${pagina}`, ListadoGastosSchema))!
  const { resumen } = listado

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Reintegros pendientes</h1>
        <p className="text-sm text-slate-500">
          Gastos en los que la factura fue menor a lo pagado: consigne la diferencia y suba la boleta.
        </p>
      </div>

      {resumen.porReintegrar > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-medium text-amber-800">Total por reintegrar</p>
          <p className="text-2xl font-semibold tabular-nums text-amber-900">{formatoMoneda(resumen.porReintegrar)}</p>
          <p className="text-xs text-amber-800">{resumen.reintegrosPendientes} reintegro(s) pendiente(s)</p>
        </div>
      )}

      <div className="space-y-3">
        {listado.registros.map(gasto => <TarjetaGasto key={gasto.id} gasto={gasto} />)}
      </div>

      {listado.registros.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white py-12 text-center text-sm text-slate-400">
          No tiene reintegros pendientes. ¡Está al día!
        </p>
      )}

      <Paginacion pagina={pagina} total={listado.total} tamano={listado.tamano} url={p => `/gastos?pagina=${p}`} />
    </div>
  )
}
