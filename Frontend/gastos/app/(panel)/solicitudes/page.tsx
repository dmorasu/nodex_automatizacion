import Link from "next/link"
import { Plus, Search, ChevronLeft, ChevronRight } from "lucide-react"
import { requiereAcceso } from "@/src/auth/dal"
import { tieneRolDeGastos } from "@/src/auth/permisos"
import { fetchApi } from "@/src/lib/api"
import { obtenerCatalogos, obtenerOperaciones } from "@/src/lib/datosGastos"
import { formatoFecha, formatoMoneda } from "@/src/lib/formato"
import { ListadoGastosSchema } from "@/src/schemas/gastos"
import EstadoGasto from "@/components/gastos/EstadoGasto"
import { claseBotonPrimario, claseBotonSecundario, claseInput } from "@/components/ui/estilos"
import SelectBuscable from "@/components/ui/SelectBuscable"

type Filtros = {
  alcance?: string
  estado?: string
  operacionId?: string
  busqueda?: string
  pagina?: string
}

const TAMANO_PAGINA = 20

// Arma la URL conservando los filtros actuales
const urlCon = (filtros: Filtros, cambios: Filtros) => {
  const parametros = new URLSearchParams(
    Object.entries({ ...filtros, ...cambios }).filter(([, v]) => v) as [string, string][]
  )
  return `/solicitudes?${parametros}`
}

export default async function SolicitudesPage(props: { searchParams: Promise<Filtros> }) {
  const searchParams = await props.searchParams
  const sesion = await requiereAcceso([])
  const puedeVerTodos = tieneRolDeGastos(sesion.roles)

  const pagina = Math.max(1, Number(searchParams.pagina) || 1)
  const alcance = puedeVerTodos && searchParams.alcance === "todos" ? "todos" : "mios"

  const consulta = new URLSearchParams({ alcance, pagina: String(pagina), tamano: String(TAMANO_PAGINA) })
  if (searchParams.estado) consulta.set("estado", searchParams.estado)
  if (searchParams.operacionId) consulta.set("operacionId", searchParams.operacionId)
  if (searchParams.busqueda) consulta.set("busqueda", searchParams.busqueda)

  // Al buscar o filtrar por operación salen también los gastos de los usuarios de su área
  const buscando = Boolean(searchParams.operacionId || searchParams.busqueda)

  const [catalogos, operaciones, respuesta] = await Promise.all([
    obtenerCatalogos(),
    obtenerOperaciones(),
    fetchApi(`/gastos/solicitudes?${consulta}`)
  ])

  const { total, registros } = ListadoGastosSchema.parse(await respuesta.json())
  const totalPaginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA))

  return (
    <div className="space-y-6">

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">
            {alcance === "todos" ? "Todos los gastos" : buscando ? "Gastos encontrados" : "Mis gastos"}
          </h1>
          <p className="mt-1 text-sm text-slate-400">{total} gasto(s) encontrado(s)</p>
        </div>
        <Link href="/solicitudes/nuevo" className={claseBotonPrimario}>
          <Plus size={15} />
          Nuevo gasto
        </Link>
      </div>

      {/* FILTROS: formulario GET, los filtros quedan en la URL */}
      <form className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
          <input
            name="busqueda"
            defaultValue={searchParams.busqueda}
            placeholder="Código, concepto, placa, matrícula, factura o beneficiario"
            className={`${claseInput} pl-9`}
            aria-label="Buscar"
          />
        </div>

        <SelectBuscable name="estado" defaultValue={searchParams.estado ?? ""} className={`${claseInput} w-auto`} aria-label="Estado">
          <option value="">Todos los estados</option>
          {catalogos.estadosGasto.map(e => <option key={e.codigo} value={e.codigo}>{e.nombre}</option>)}
        </SelectBuscable>

        <SelectBuscable name="operacionId" defaultValue={searchParams.operacionId ?? ""} className={`${claseInput} w-auto`} aria-label="Operación">
          <option value="">Todas las operaciones</option>
          {operaciones.map(o => <option key={o.id} value={o.id}>{o.nombreOperacion}</option>)}
        </SelectBuscable>

        {puedeVerTodos && (
          <SelectBuscable name="alcance" defaultValue={alcance} className={`${claseInput} w-auto`} aria-label="Alcance">
            <option value="mios">Mis gastos</option>
            <option value="todos">Todos los gastos</option>
          </SelectBuscable>
        )}

        <button type="submit" className={claseBotonSecundario}>Filtrar</button>
      </form>

      {/* TABLA */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Código</th>
              <th className="px-4 py-3 font-semibold">Fecha</th>
              <th className="px-4 py-3 font-semibold">Concepto</th>
              <th className="px-4 py-3 font-semibold">Beneficiario</th>
              <th className="px-4 py-3 font-semibold">Operación</th>
              <th className="px-4 py-3 font-semibold">Bolsa</th>
              <th className="px-4 py-3 font-semibold text-right">Valor solicitado</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {registros.map(gasto => (
              <tr key={gasto.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 whitespace-nowrap">
                  <Link href={`/solicitudes/${gasto.id}`} className="font-semibold text-emerald-700 hover:underline">
                    {gasto.codigo}
                  </Link>
                  {gasto.creador && gasto.creador.id !== sesion.id && (
                    <p className="text-[11px] text-slate-400">{gasto.creador.nombreUsuario}</p>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-500">{formatoFecha(gasto.createdAt)}</td>
                <td className="px-4 py-3 text-slate-700">
                  <p>{gasto.conceptoPago}</p>
                  <p className="text-[11px] text-slate-400">
                    {gasto.tipoGasto.nombre}
                    {(gasto.placa || gasto.matriculaInmobiliaria) && ` · ${gasto.placa ?? gasto.matriculaInmobiliaria}`}
                  </p>
                </td>
                <td className="px-4 py-3 text-slate-600">{gasto.beneficiario.nombre}</td>
                <td className="px-4 py-3 text-slate-600">{gasto.operacion.nombreOperacion}</td>
                <td className="px-4 py-3 text-slate-600">{gasto.bolsa?.nombre ?? "—"}</td>
                <td className="px-4 py-3 text-right font-medium text-slate-800 whitespace-nowrap">{formatoMoneda(gasto.valorSolicitadoPago)}</td>
                <td className="px-4 py-3"><EstadoGasto codigo={gasto.estado.codigo} nombre={gasto.estado.nombre} /></td>
              </tr>
            ))}
          </tbody>
        </table>

        {registros.length === 0 && (
          <p className="py-14 text-center text-sm text-slate-400">No hay gastos con estos filtros.</p>
        )}
      </div>

      {/* PAGINACIÓN */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-end gap-2 text-xs text-slate-500">
          <span>Página {pagina} de {totalPaginas}</span>
          <Link
            href={urlCon(searchParams, { pagina: String(pagina - 1) })}
            aria-disabled={pagina <= 1}
            className={`${claseBotonSecundario} h-8 px-2 ${pagina <= 1 ? "pointer-events-none opacity-40" : ""}`}
          >
            <ChevronLeft size={15} />
          </Link>
          <Link
            href={urlCon(searchParams, { pagina: String(pagina + 1) })}
            aria-disabled={pagina >= totalPaginas}
            className={`${claseBotonSecundario} h-8 px-2 ${pagina >= totalPaginas ? "pointer-events-none opacity-40" : ""}`}
          >
            <ChevronRight size={15} />
          </Link>
        </div>
      )}

    </div>
  )
}
