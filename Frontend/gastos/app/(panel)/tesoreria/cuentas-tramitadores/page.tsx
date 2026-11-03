import Link from "next/link"
import clsx from "clsx"
import { TESORERIA_OPERATIVA } from "@/src/auth/permisos"
import { requiereAcceso } from "@/src/auth/dal"
import { fetchApi } from "@/src/lib/api"
import { formatoFecha, formatoMoneda } from "@/src/lib/formato"
import type { ListadoCuentasTramitador } from "@/src/lib/cuentasTramitadores"
import Buscador from "@/components/ui/Buscador"
import Paginacion from "@/components/ui/Paginacion"

// Cuentas de cobro de los tramitadores con el visto bueno de Torre de control: pendientes de pago y pagadas
export default async function CuentasTramitadoresPage(props: { searchParams: Promise<{ estado?: string, busqueda?: string, pagina?: string }> }) {
  const searchParams = await props.searchParams
  await requiereAcceso(TESORERIA_OPERATIVA)

  const pagadas = searchParams.estado === "PAGADA"
  const pagina = Math.max(1, Number(searchParams.pagina) || 1)
  const consulta = new URLSearchParams({ estado: pagadas ? "PAGADA" : "EN_TESORERIA", pagina: String(pagina) })
  if (searchParams.busqueda) consulta.set("q", searchParams.busqueda)
  const req = await fetchApi(`/gastos/cuentas-tramitadores?${consulta}`)
  const listado: ListadoCuentasTramitador | null = req.ok ? await req.json() : null
  const pendientes = !pagadas && listado ? listado.cuentas.reduce((s, c) => s + c.total, 0) : 0

  const url = (p: number) => `/tesoreria/cuentas-tramitadores?${new URLSearchParams({
    ...(pagadas ? { estado: "PAGADA" } : {}), ...(searchParams.busqueda ? { busqueda: searchParams.busqueda } : {}), pagina: String(p)
  })}`

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {[{ nombre: "Pendientes de pago", activo: !pagadas, href: "/tesoreria/cuentas-tramitadores" },
          { nombre: "Pagadas", activo: pagadas, href: "/tesoreria/cuentas-tramitadores?estado=PAGADA" }].map(f => (
          <Link key={f.nombre} href={f.href} className={clsx("rounded-full border px-3 py-1.5 text-xs font-semibold transition",
            f.activo ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50")}>
            {f.nombre}
          </Link>
        ))}
        {!pagadas && listado && listado.cuentas.length > 0 && (
          <span className="ml-auto text-xs text-slate-500">Total pendiente: <span className="font-semibold tabular-nums text-slate-800">{formatoMoneda(pendientes / 100)}</span></span>
        )}
      </div>

      <Buscador valor={searchParams.busqueda} ocultos={{ estado: pagadas ? "PAGADA" : undefined }} placeholder="Número (CCT-0001) o tramitador" />

      {!listado ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">No se pudieron cargar las cuentas.</p>
      ) : listado.cuentas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-xs text-slate-500">
          {pagadas ? "No hay cuentas pagadas." : "No hay cuentas de tramitadores pendientes de pago."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Número</th>
                <th className="px-4 py-3 font-semibold">Tramitador</th>
                <th className="px-4 py-3 text-right font-semibold">Trámites</th>
                <th className="px-4 py-3 text-right font-semibold">Total</th>
                <th className="px-4 py-3 font-semibold">Radicada</th>
                {pagadas && <th className="px-4 py-3 font-semibold">Pagada</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {listado.cuentas.map(c => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3"><Link href={`/tesoreria/cuentas-tramitadores/${c.id}`} className="font-semibold text-emerald-700 hover:underline">{c.numero}</Link></td>
                  <td className="px-4 py-3 text-slate-700">{c.tramitador.nombre}<p className="text-[11px] text-slate-400">{c.tramitador.identificacion}</p></td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">{c.tramites}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-700">{formatoMoneda(c.total / 100)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatoFecha(c.fechaRadicacion)}</td>
                  {pagadas && <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatoFecha(c.fechaPago)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {listado && <Paginacion pagina={pagina} total={listado.total} tamano={listado.porPagina} url={url} />}
    </div>
  )
}
