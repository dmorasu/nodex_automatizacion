import Link from "next/link"
import { z } from "zod"
import { fetchApi } from "@/src/lib/api"
import { obtenerBolsasActivas, obtenerCatalogos, obtenerOperaciones, obtenerTramitadores } from "@/src/lib/datosGastos"
import { formatoFecha, formatoMoneda } from "@/src/lib/formato"
import { ListadoGastosSchema } from "@/src/schemas/gastos"
import { UsuarioConRolesSchema } from "@/src/schemas/admin"
import EstadoGasto from "@/components/gastos/EstadoGasto"
import { EstadoTramiteNodex, EtiquetaSoporteTramitador } from "@/components/legalizacion/SeguimientoTramitador"
import Paginacion from "@/components/ui/Paginacion"
import { claseBotonPrimario, claseBotonSecundario, claseInput } from "@/components/ui/estilos"
import SelectBuscable from "@/components/ui/SelectBuscable"

// Filtros que viajan en la URL (formulario GET): se pueden compartir y volver atrás
const FILTROS = [
  "busqueda", "estado", "pagados", "bolsaId", "tipoGastoId", "operacionId", "tramitadorId", "creadoPor",
  "reembolsable", "conTramite", "soporteTramitador", "reintegroPendiente",
  "desde", "hasta", "pagoDesde", "pagoHasta", "orden", "tamano"
] as const

type Filtros = Partial<Record<typeof FILTROS[number] | "pagina", string>>

const ORDENES = [
  ["recientes", "Más recientes"],
  ["antiguos", "Más antiguos"],
  ["pagoReciente", "Pago más reciente"],
  ["valorMayor", "Mayor valor"],
  ["valorMenor", "Menor valor"]
] as const

const claseFiltro = `${claseInput} h-9`
const claseEtiqueta = "block mb-1 text-[11px] font-medium text-slate-500"

// Panel de administración: todos los gastos, con filtros, totales y paginación (solo administradores)
export default async function TodosLosGastosPage(props: { searchParams: Promise<Filtros> }) {
  const searchParams = await props.searchParams
  const pagina = Math.max(1, Number(searchParams.pagina) || 1)
  const tamano = ["20", "50", "100"].includes(searchParams.tamano ?? "") ? searchParams.tamano! : "20"

  const activos = Object.fromEntries(
    FILTROS.map(f => [f, searchParams[f]]).filter(([, v]) => v)
  ) as Record<string, string>

  const consulta = new URLSearchParams({ ...activos, alcance: "todos", totales: "si", tamano, pagina: String(pagina) })

  const [respuesta, catalogos, bolsas, operaciones, tramitadores, reqUsuarios] = await Promise.all([
    fetchApi(`/gastos/solicitudes?${consulta}`),
    obtenerCatalogos(),
    obtenerBolsasActivas(),
    obtenerOperaciones(),
    obtenerTramitadores(),
    fetchApi("/gastos/admin/usuarios")
  ])

  if (!respuesta.ok) {
    const error = await respuesta.json().catch(() => null)
    return (
      <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
        No se pudo consultar: {error?.errors?.[0]?.msg ?? error?.error ?? "revise los filtros"}.{" "}
        <Link href="/admin" className="font-semibold underline">Limpiar filtros</Link>
      </p>
    )
  }

  const { total, registros, totales } = ListadoGastosSchema.parse(await respuesta.json())
  const usuarios = z.array(UsuarioConRolesSchema).parse(await reqUsuarios.json())
  const cantidadFiltros = Object.keys(activos).filter(f => f !== "orden" && f !== "tamano").length

  const url = (p: number) => `/admin?${new URLSearchParams({ ...activos, pagina: String(p) })}`

  return (
    <div className="space-y-5">

      {/* FILTROS */}
      <form className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block sm:col-span-2">
            <span className={claseEtiqueta}>Buscar</span>
            <input name="busqueda" defaultValue={searchParams.busqueda} placeholder="Código, concepto, placa, matrícula, factura, beneficiario o N° de trámite" className={claseFiltro} />
          </label>
          <label className="block">
            <span className={claseEtiqueta}>Estado</span>
            <SelectBuscable name="estado" defaultValue={searchParams.estado ?? ""} className={claseFiltro}>
              <option value="">Todos</option>
              {catalogos.estadosGasto.map(e => <option key={e.id} value={e.codigo}>{e.nombre}</option>)}
            </SelectBuscable>
          </label>
          <label className="block">
            <span className={claseEtiqueta}>Solo ya pagados</span>
            <SelectBuscable name="pagados" defaultValue={searchParams.pagados ?? ""} className={claseFiltro}>
              <option value="">No</option>
              <option value="si">Sí (sin solicitados ni anulados)</option>
            </SelectBuscable>
          </label>

          <label className="block">
            <span className={claseEtiqueta}>Bolsa</span>
            <SelectBuscable name="bolsaId" defaultValue={searchParams.bolsaId ?? ""} className={claseFiltro}>
              <option value="">Todas</option>
              {bolsas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
            </SelectBuscable>
          </label>
          <label className="block">
            <span className={claseEtiqueta}>Tipo de gasto</span>
            <SelectBuscable name="tipoGastoId" defaultValue={searchParams.tipoGastoId ?? ""} className={claseFiltro}>
              <option value="">Todos</option>
              {catalogos.tiposGasto.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </SelectBuscable>
          </label>
          <label className="block">
            <span className={claseEtiqueta}>Operación</span>
            <SelectBuscable name="operacionId" defaultValue={searchParams.operacionId ?? ""} className={claseFiltro}>
              <option value="">Todas</option>
              {operaciones.map(o => <option key={o.id} value={o.id}>{o.nombreOperacion}</option>)}
            </SelectBuscable>
          </label>
          <label className="block">
            <span className={claseEtiqueta}>Tramitador</span>
            <SelectBuscable name="tramitadorId" defaultValue={searchParams.tramitadorId ?? ""} className={claseFiltro}>
              <option value="">Todos</option>
              {tramitadores.map(t => <option key={t.id} value={t.id}>{t.nombreTramitador}</option>)}
            </SelectBuscable>
          </label>

          <label className="block">
            <span className={claseEtiqueta}>Creado por</span>
            <SelectBuscable name="creadoPor" defaultValue={searchParams.creadoPor ?? ""} className={claseFiltro}>
              <option value="">Cualquiera</option>
              {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombreUsuario}</option>)}
            </SelectBuscable>
          </label>
          <label className="block">
            <span className={claseEtiqueta}>Reembolsable</span>
            <SelectBuscable name="reembolsable" defaultValue={searchParams.reembolsable ?? ""} className={claseFiltro}>
              <option value="">Todos</option>
              <option value="si">Sí (Legalización)</option>
              <option value="no">No (lo asume la bolsa)</option>
            </SelectBuscable>
          </label>
          <label className="block">
            <span className={claseEtiqueta}>Trámite</span>
            <SelectBuscable name="conTramite" defaultValue={searchParams.conTramite ?? ""} className={claseFiltro}>
              <option value="">Con o sin trámite</option>
              <option value="si">Con trámite</option>
              <option value="no">Sin trámite</option>
            </SelectBuscable>
          </label>
          <label className="block">
            <span className={claseEtiqueta}>Factura del tramitador</span>
            <SelectBuscable name="soporteTramitador" defaultValue={searchParams.soporteTramitador ?? ""} className={claseFiltro}>
              <option value="">Indiferente</option>
              <option value="si">La subió</option>
              <option value="no">No la ha subido</option>
            </SelectBuscable>
          </label>

          <label className="block">
            <span className={claseEtiqueta}>Creado desde</span>
            <input type="date" name="desde" defaultValue={searchParams.desde} className={claseFiltro} />
          </label>
          <label className="block">
            <span className={claseEtiqueta}>Creado hasta</span>
            <input type="date" name="hasta" defaultValue={searchParams.hasta} className={claseFiltro} />
          </label>
          <label className="block">
            <span className={claseEtiqueta}>Pagado desde</span>
            <input type="date" name="pagoDesde" defaultValue={searchParams.pagoDesde} className={claseFiltro} />
          </label>
          <label className="block">
            <span className={claseEtiqueta}>Pagado hasta</span>
            <input type="date" name="pagoHasta" defaultValue={searchParams.pagoHasta} className={claseFiltro} />
          </label>

          <label className="block">
            <span className={claseEtiqueta}>Reintegro</span>
            <SelectBuscable name="reintegroPendiente" defaultValue={searchParams.reintegroPendiente ?? ""} className={claseFiltro}>
              <option value="">Indiferente</option>
              <option value="si">Con reintegro pendiente</option>
            </SelectBuscable>
          </label>
          <label className="block">
            <span className={claseEtiqueta}>Ordenar por</span>
            <SelectBuscable name="orden" defaultValue={searchParams.orden ?? "recientes"} className={claseFiltro}>
              {ORDENES.map(([valor, nombre]) => <option key={valor} value={valor}>{nombre}</option>)}
            </SelectBuscable>
          </label>
          <label className="block">
            <span className={claseEtiqueta}>Por página</span>
            <SelectBuscable name="tamano" defaultValue={tamano} className={claseFiltro}>
              {["20", "50", "100"].map(t => <option key={t} value={t}>{t}</option>)}
            </SelectBuscable>
          </label>
          <div className="flex items-end gap-2">
            <button type="submit" className={`${claseBotonPrimario} h-9 flex-1`}>Filtrar</button>
            <Link href="/admin" className={`${claseBotonSecundario} h-9`}>Limpiar</Link>
          </div>
        </div>
      </form>

      {/* RESUMEN DEL RESULTADO */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-[11px] font-medium text-slate-500">Gastos{cantidadFiltros > 0 ? ` (${cantidadFiltros} filtro(s))` : ""}</p>
          <p className="text-xl font-semibold tabular-nums text-slate-900">{total}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-[11px] font-medium text-slate-500">Valor solicitado</p>
          <p className="text-xl font-semibold tabular-nums text-slate-900">{formatoMoneda(totales?.solicitado ?? 0)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-[11px] font-medium text-slate-500">Valor pagado</p>
          <p className="text-xl font-semibold tabular-nums text-slate-900">{formatoMoneda(totales?.pagado ?? 0)}</p>
        </div>
      </div>

      {/* TABLA */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-3 font-semibold">Gasto</th>
              <th className="px-3 py-3 font-semibold">Estado</th>
              <th className="px-3 py-3 font-semibold">Beneficiario</th>
              <th className="px-3 py-3 font-semibold">Bolsa / operación</th>
              <th className="px-3 py-3 font-semibold">Trámite y tramitador</th>
              <th className="px-3 py-3 font-semibold">Fechas</th>
              <th className="px-3 py-3 font-semibold text-right">Solicitado</th>
              <th className="px-3 py-3 font-semibold text-right">Pagado</th>
              <th className="px-3 py-3 font-semibold text-right">Factura</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {registros.map(g => (
              <tr key={g.id} className="align-top">
                <td className="px-3 py-3">
                  <Link href={`/solicitudes/${g.id}`} className="font-semibold text-emerald-700 hover:underline">{g.codigo}</Link>
                  <p className="max-w-[220px] text-[11px] text-slate-500">{g.conceptoPago}</p>
                  <p className="text-[11px] text-slate-400">{g.tipoGasto.nombre} · {g.reembolsable ? "Reembolsable" : "No reembolsable"}</p>
                  <p className="text-[11px] text-slate-400">Creó: {g.creador?.nombreUsuario ?? "—"}</p>
                </td>
                <td className="px-3 py-3"><EstadoGasto codigo={g.estado.codigo} nombre={g.estado.nombre} /></td>
                <td className="px-3 py-3 text-slate-600">{g.beneficiario.nombre}</td>
                <td className="px-3 py-3 text-slate-600">
                  {g.bolsa?.nombre ?? "—"}
                  <p className="text-[11px] text-slate-400">{g.operacion.nombreOperacion}</p>
                </td>
                <td className="px-3 py-3">
                  <div className="space-y-1">
                    <EstadoTramiteNodex tramiteId={g.solicitudTramiteId} estado={g.estadoTramite} reporteRealizado={g.reporteRealizado} />
                    <EtiquetaSoporteTramitador estado={g.soporteTramitador} />
                    {g.tramitador && <p className="text-[11px] text-slate-400">{g.tramitador.nombreTramitador}</p>}
                  </div>
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-[11px] text-slate-500">
                  <p>Creado {formatoFecha(g.createdAt)}</p>
                  <p>Pagado {formatoFecha(g.fechaPago)}</p>
                </td>
                <td className="px-3 py-3 text-right text-slate-600">{formatoMoneda(g.valorSolicitadoPago)}</td>
                <td className="px-3 py-3 text-right font-semibold text-slate-800">{formatoMoneda(g.valorRealmentePagado)}</td>
                <td className="px-3 py-3 text-right text-slate-600">
                  {g.factura ? <>{formatoMoneda(g.factura.valorFactura)}<p className="text-[11px] text-slate-400">{g.factura.numeroFactura ?? "Sin número"}</p></> : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {registros.length === 0 && <p className="py-14 text-center text-sm text-slate-400">Ningún gasto coincide con los filtros.</p>}
      </div>

      <Paginacion pagina={pagina} total={total} tamano={Number(tamano)} url={url} />
    </div>
  )
}
