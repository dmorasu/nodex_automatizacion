import { FileSpreadsheet } from "lucide-react"
import { requiereAcceso } from "@/src/auth/dal"
import { ROLES } from "@/src/auth/permisos"
import { obtenerBolsasActivas, obtenerCatalogos } from "@/src/lib/datosGastos"
import Seccion from "@/components/ui/Seccion"
import { claseBotonPrimario, claseInput, claseLabel } from "@/components/ui/estilos"

export default async function ReportesPage() {
  await requiereAcceso([ROLES.TESORERIA, ROLES.LEGALIZACION, ROLES.CONTABILIDAD])

  const [catalogos, bolsas] = await Promise.all([obtenerCatalogos(), obtenerBolsasActivas()])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Reportes</h1>
        <p className="mt-1 text-sm text-slate-400">Descargue la información de los gastos en Excel para analizarla o compartirla.</p>
      </div>

      <Seccion
        titulo="Reporte de gastos"
        descripcion="Una fila por gasto con todo su recorrido: solicitud, pago, egreso, factura, retención, 4x1000, reintegro, cuenta de cobro y contabilización."
      >
        {/* Formulario GET a la ruta de descarga: el navegador baja el archivo */}
        <form action="/descargas/gastos" method="GET" className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block">
              <span className={claseLabel}>Estado</span>
              <select name="estado" defaultValue="" className={claseInput}>
                <option value="">Todos los estados</option>
                {catalogos.estadosGasto.map(e => <option key={e.codigo} value={e.codigo}>{e.nombre}</option>)}
              </select>
            </label>
            <label className="block">
              <span className={claseLabel}>Bolsa</span>
              <select name="bolsaId" defaultValue="" className={claseInput}>
                <option value="">Todas las bolsas</option>
                {bolsas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
              </select>
            </label>
            <label className="block">
              <span className={claseLabel}>Creados desde</span>
              <input type="date" name="desde" className={claseInput} />
            </label>
            <label className="block">
              <span className={claseLabel}>Hasta</span>
              <input type="date" name="hasta" className={claseInput} />
            </label>
          </div>

          <div className="flex items-center justify-between gap-4">
            <p className="text-[11px] text-slate-400">Máximo 20.000 gastos por archivo. Use los filtros para reportes más grandes.</p>
            <button type="submit" className={claseBotonPrimario}>
              <FileSpreadsheet size={15} />
              Descargar Excel
            </button>
          </div>
        </form>
      </Seccion>
    </div>
  )
}
