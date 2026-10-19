import Link from "next/link"
import { Download, Search } from "lucide-react"
import { formatoFecha, formatoMoneda } from "@/src/lib/formato"
import { ESTADOS_REEMBOLSO } from "@/src/schemas/gastos"
import type { FiltrosHistorialCaja, obtenerHistorialCaja } from "@/src/lib/datosCajaMenor"
import EstadoGasto from "../gastos/EstadoGasto"
import Paginacion from "../ui/Paginacion"
import { claseBotonPrimario, claseBotonSecundario, claseInput, claseLabel } from "../ui/estilos"
import SelectBuscable from "@/components/ui/SelectBuscable"

const ESTADOS = [
  ["", "Todos"],
  ["PAGADO_CAJA", "Entregado sin legalizar"],
  ["PENDIENTE_REEMBOLSO", "Pendiente por reembolso"],
  ["EN_REEMBOLSO", "En reembolso"],
  ["LEGALIZADO_CAJA", "Legalizado"]
] as const

function Total({ etiqueta, valor, detalle }: { etiqueta: string, valor: string, detalle?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{etiqueta}</p>
      <p className="mt-1 text-base font-semibold text-slate-800">{valor}</p>
      {detalle && <p className="mt-0.5 text-[11px] text-slate-400">{detalle}</p>}
    </div>
  )
}

// Historial de una caja: todo lo entregado, lo legalizado y en qué reembolso quedó, con filtros
// por fecha de entrega, estado, quién legaliza y búsqueda; totales de lo filtrado y Excel.
export default function HistorialCaja({ bolsaId, filtros, historial }: {
  bolsaId: number
  filtros: FiltrosHistorialCaja
  historial: Awaited<ReturnType<typeof obtenerHistorialCaja>>
}) {
  const { totales, registros, total, pagina, tamano } = historial
  const activos = Object.fromEntries(Object.entries(filtros).filter(([clave, v]) => v && clave !== "pagina")) as Record<string, string>
  const url = (p: number) => `/tesoreria/caja-menor?${new URLSearchParams({ caja: String(bolsaId), vista: "historial", ...activos, pagina: String(p) })}`
  const excel = `/descargas/caja-menor?${new URLSearchParams({ bolsaId: String(bolsaId), ...activos })}`

  return (
    <div className="space-y-4">
      <form className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
        <input type="hidden" name="caja" value={bolsaId} />
        <input type="hidden" name="vista" value="historial" />
        <label className="block">
          <span className={claseLabel}>Entregado desde</span>
          <input type="date" name="desde" defaultValue={filtros.desde} className={claseInput} />
        </label>
        <label className="block">
          <span className={claseLabel}>Hasta</span>
          <input type="date" name="hasta" defaultValue={filtros.hasta} className={claseInput} />
        </label>
        <label className="block">
          <span className={claseLabel}>Estado</span>
          <SelectBuscable name="estado" defaultValue={filtros.estado ?? ""} className={claseInput}>
            {ESTADOS.map(([codigo, nombre]) => <option key={codigo} value={codigo}>{nombre}</option>)}
          </SelectBuscable>
        </label>
        <label className="block">
          <span className={claseLabel}>Quién legaliza</span>
          <input name="quienLegaliza" defaultValue={filtros.quienLegaliza} className={claseInput} />
        </label>
        <label className="relative block">
          <span className={claseLabel}>Buscar</span>
          <Search size={14} className="pointer-events-none absolute bottom-3 left-3 text-slate-300" />
          <input name="busqueda" defaultValue={filtros.busqueda} placeholder="Gasto, factura, beneficiario, RCM…" className={`${claseInput} pl-8`} />
        </label>
        <div className="flex gap-2">
          <button type="submit" className={claseBotonPrimario}>Filtrar</button>
          <Link href={`/tesoreria/caja-menor?caja=${bolsaId}&vista=historial`} className={claseBotonSecundario}>Limpiar</Link>
        </div>
      </form>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid flex-1 gap-3 sm:grid-cols-3">
          <Total etiqueta="Entregado" valor={formatoMoneda(totales.entregado)} detalle={`${totales.cantidad} gasto(s)`} />
          <Total etiqueta="Soportes legalizados" valor={formatoMoneda(totales.soporte)} detalle={`${totales.cantidad - totales.sinLegalizar} legalizado(s)`} />
          <Total etiqueta="Sin legalizar" valor={String(totales.sinLegalizar)} detalle="gasto(s)" />
        </div>
        <a href={excel} className={claseBotonSecundario}>
          <Download size={15} /> Descargar Excel
        </a>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Gasto</th>
              <th className="px-4 py-3 font-semibold">Entregado</th>
              <th className="px-4 py-3 font-semibold">Factura</th>
              <th className="px-4 py-3 font-semibold">Legalizó</th>
              <th className="px-4 py-3 text-right font-semibold">Soporte</th>
              <th className="px-4 py-3 font-semibold">Reembolso</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 align-top">
            {registros.map(g => {
              const l = g.legalizacionCaja
              return (
                <tr key={g.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/solicitudes/${g.id}`} className="font-semibold text-emerald-700 hover:underline">{g.codigo}</Link>
                    <p className="text-[11px] text-slate-400">{g.conceptoPago}</p>
                    <p className="text-[11px] text-slate-400">{g.creador?.nombreUsuario}</p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <p className="font-medium text-slate-700">{formatoMoneda(g.valorRealmentePagado)}</p>
                    <p className="text-[11px] text-slate-400">{formatoFecha(g.fechaPago)}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {l ? (
                      <>
                        <p className="font-medium">{l.numeroFactura} · {formatoFecha(l.fechaFactura)}</p>
                        <p className="text-[11px] text-slate-400">{l.beneficiario} · {l.tipoIdentificacion} {l.identificacion}</p>
                      </>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{l?.quienLegaliza ?? <span className="text-slate-300">—</span>}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {l ? (
                      <>
                        <p className="font-semibold text-slate-800">{formatoMoneda(l.valorSoporte)}</p>
                        {Number(l.diferencia) !== 0 && <p className="text-[11px] text-slate-400">dif. {formatoMoneda(l.diferencia)}</p>}
                      </>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {l?.reembolso ? (
                      <>
                        <Link href={`/tesoreria/caja-menor/reembolsos/${l.reembolso.id}`} className="font-medium text-emerald-700 hover:underline">{l.reembolso.codigo}</Link>
                        <p className="text-[11px] text-slate-400">
                          {ESTADOS_REEMBOLSO[l.reembolso.estado] ?? l.reembolso.estado}
                          {l.reembolso.fechaLegalizacion && ` · ${formatoFecha(l.reembolso.fechaLegalizacion)}`}
                        </p>
                      </>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3"><EstadoGasto codigo={g.estado.codigo} nombre={g.estado.nombre} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {registros.length === 0 && <p className="py-14 text-center text-sm text-slate-400">No hay gastos con estos filtros.</p>}
      </div>

      <Paginacion pagina={pagina} total={total} tamano={tamano} url={url} />
    </div>
  )
}
