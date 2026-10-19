import Link from "next/link"
import { requiereAcceso } from "@/src/auth/dal"
import { ROLES, tieneAcceso } from "@/src/auth/permisos"
import { fetchApi } from "@/src/lib/api"
import { obtenerBolsasActivas } from "@/src/lib/datosGastos"
import { formatoMoneda } from "@/src/lib/formato"
import { TableroSchema } from "@/src/schemas/gastos"
import Indicador from "@/components/tablero/Indicador"
import GraficoDineroPagado from "@/components/tablero/GraficoDineroPagado"
import ResumenReintegros from "@/components/tablero/ResumenReintegros"
import Seccion from "@/components/ui/Seccion"
import { claseBotonSecundario, claseInput } from "@/components/ui/estilos"
import SelectBuscable from "@/components/ui/SelectBuscable"

type Filtros = { bolsaId?: string, desde?: string, hasta?: string }

const hoy = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })

// Rangos rápidos de fecha de pago
const rangos = () => {
  const fin = hoy()
  const [anio, mes] = fin.split("-")
  return [
    { nombre: "Este mes", desde: `${anio}-${mes}-01`, hasta: fin },
    { nombre: "Este año", desde: `${anio}-01-01`, hasta: fin },
    { nombre: "Todo", desde: "", hasta: "" }
  ]
}

export default async function TableroPage({ searchParams }: { searchParams: Filtros }) {
  const sesion = await requiereAcceso([ROLES.TESORERIA, ROLES.LEGALIZACION, ROLES.CONTABILIDAD])

  const consulta = new URLSearchParams(
    Object.entries(searchParams).filter(([, v]) => v) as [string, string][]
  )
  const [respuesta, opcionesBolsa] = await Promise.all([
    fetchApi(`/gastos/tablero?${consulta}`),
    obtenerBolsasActivas()
  ])
  const tablero = TableroSchema.parse(await respuesta.json())
  const { totales, bolsas, cuentasPorLegalizar, reintegros } = tablero

  // El detalle por tramitador vive en cada módulo: se enlaza al primero que el usuario pueda abrir
  const rutaDetalleReintegros = ([
    [ROLES.LEGALIZACION, "/legalizacion/reintegros-tramitador"],
    [ROLES.TESORERIA, "/tesoreria/reintegros-tramitador"],
    [ROLES.CONTABILIDAD, "/contabilidad/reintegros-tramitador"]
  ] as const).find(([rol]) => tieneAcceso(sesion.roles, [rol]))?.[1] ?? null

  const porLegalizar = totales.facturadoSinCuenta + totales.enCuentaCobro
  const conservar = (cambios: Filtros) => {
    const parametros = new URLSearchParams(
      Object.entries({ ...searchParams, ...cambios }).filter(([, v]) => v) as [string, string][]
    )
    return `/tablero?${parametros}`
  }

  return (
    <div className="space-y-6">

      <div>
        <h1 className="text-xl font-semibold text-slate-800">Indicadores</h1>
      </div>

      {/* FILTROS: una fila, arriba de todo lo que afectan */}
      <form className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="block mb-1 text-[11px] font-medium text-slate-500">Bolsa</span>
          <SelectBuscable name="bolsaId" defaultValue={searchParams.bolsaId ?? ""} className={`${claseInput} w-48`}>
            <option value="">Todas las bolsas</option>
            {opcionesBolsa.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
          </SelectBuscable>
        </label>
        <label className="block">
          <span className="block mb-1 text-[11px] font-medium text-slate-500">Pagados desde</span>
          <input type="date" name="desde" defaultValue={searchParams.desde} className={claseInput} />
        </label>
        <label className="block">
          <span className="block mb-1 text-[11px] font-medium text-slate-500">Hasta</span>
          <input type="date" name="hasta" defaultValue={searchParams.hasta} className={claseInput} />
        </label>
        <button type="submit" className={claseBotonSecundario}>Aplicar</button>

        <div className="flex gap-2 pb-2 text-xs">
          {rangos().map(r => (
            <Link key={r.nombre} href={conservar({ desde: r.desde, hasta: r.hasta })} className="rounded-full border border-slate-200 px-3 py-1 text-slate-500 hover:bg-slate-50">
              {r.nombre}
            </Link>
          ))}
        </div>
      </form>

      {/* INDICADORES */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Indicador etiqueta="Saldo de las bolsas" valor={formatoMoneda(totales.saldo)} destacado />
        <Indicador etiqueta="Pagado" valor={formatoMoneda(totales.pagado)} detalle={`${totales.gastosPagados} gasto(s)`} />
        <Indicador etiqueta="Por legalizar" valor={formatoMoneda(porLegalizar)} />
        <Indicador etiqueta="Reintegros pendientes" valor={formatoMoneda(totales.reintegroPendiente)} />
        <Indicador etiqueta="Por pagar" valor={formatoMoneda(totales.porPagar)} detalle={`${totales.gastosPorPagar} gasto(s) solicitados`} />
      </div>

      {/* GRÁFICO */}
      <Seccion
        titulo="¿Dónde está el dinero pagado?"
      >
        <GraficoDineroPagado bolsas={bolsas} />
      </Seccion>

      {/* TABLA POR BOLSA (todos los valores exactos) */}
      <Seccion titulo="Detalle por bolsa">
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="w-full text-left text-xs tabular-nums">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3 font-semibold">Bolsa</th>
                <th className="px-3 py-3 font-semibold text-right">Saldo actual</th>
                <th className="px-3 py-3 font-semibold text-right">Pagado</th>
                <th className="px-3 py-3 font-semibold text-right">Sin factura</th>
                <th className="px-3 py-3 font-semibold text-right">Facturado sin cuenta</th>
                <th className="px-3 py-3 font-semibold text-right">En cuenta de cobro</th>
                <th className="px-3 py-3 font-semibold text-right">Reintegro pendiente</th>
                <th className="px-3 py-3 font-semibold text-right">Legalizado</th>
                <th className="px-3 py-3 font-semibold text-right">Reintegrado</th>
                <th className="px-3 py-3 font-semibold text-right" title="No reembolsables legalizados: la bolsa asume el valor de la factura">Gasto asumido</th>
                <th className="px-3 py-3 font-semibold text-right">Por pagar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bolsas.map(b => (
                <tr key={b.id} className={b.activo ? "" : "text-slate-400"}>
                  <td className="px-3 py-3">
                    <p className="font-medium text-slate-700">{b.nombre}</p>
                    {b.lineaNegocio && <p className="text-[11px] text-slate-400">{b.lineaNegocio}</p>}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-slate-800">{formatoMoneda(b.saldo)}</td>
                  <td className="px-3 py-3 text-right">{formatoMoneda(b.pagado)}</td>
                  <td className="px-3 py-3 text-right">{formatoMoneda(b.sinFactura)}</td>
                  <td className="px-3 py-3 text-right">{formatoMoneda(b.facturadoSinCuenta)}</td>
                  <td className="px-3 py-3 text-right">{formatoMoneda(b.enCuentaCobro)}</td>
                  <td className="px-3 py-3 text-right">{formatoMoneda(b.reintegroPendiente)}</td>
                  <td className="px-3 py-3 text-right">{formatoMoneda(b.legalizado)}</td>
                  <td className="px-3 py-3 text-right">{formatoMoneda(b.reintegrado)}</td>
                  <td className="px-3 py-3 text-right">{formatoMoneda(b.gastoAsumido)}</td>
                  <td className="px-3 py-3 text-right">{formatoMoneda(b.porPagar)}</td>
                </tr>
              ))}
            </tbody>
            {bolsas.length > 1 && (
              <tfoot className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-800">
                <tr>
                  <td className="px-3 py-3">Total</td>
                  <td className="px-3 py-3 text-right">{formatoMoneda(totales.saldo)}</td>
                  <td className="px-3 py-3 text-right">{formatoMoneda(totales.pagado)}</td>
                  <td className="px-3 py-3 text-right">{formatoMoneda(totales.sinFactura)}</td>
                  <td className="px-3 py-3 text-right">{formatoMoneda(totales.facturadoSinCuenta)}</td>
                  <td className="px-3 py-3 text-right">{formatoMoneda(totales.enCuentaCobro)}</td>
                  <td className="px-3 py-3 text-right">{formatoMoneda(totales.reintegroPendiente)}</td>
                  <td className="px-3 py-3 text-right">{formatoMoneda(totales.legalizado)}</td>
                  <td className="px-3 py-3 text-right">{formatoMoneda(totales.reintegrado)}</td>
                  <td className="px-3 py-3 text-right">{formatoMoneda(totales.gastoAsumido)}</td>
                  <td className="px-3 py-3 text-right">{formatoMoneda(totales.porPagar)}</td>
                </tr>
              </tfoot>
            )}
          </table>
          {bolsas.length === 0 && <p className="py-10 text-center text-xs text-slate-400">No hay bolsas.</p>}
        </div>
      </Seccion>

      {/* REINTEGROS: VISTA GERENCIAL */}
      <Seccion
        titulo="Reintegros de los tramitadores"
      >
        <ResumenReintegros resumen={reintegros} rutaDetalle={rutaDetalleReintegros} />
      </Seccion>

      {/* CUENTAS DE COBRO POR LEGALIZAR */}
      <Seccion
        titulo="Cuentas de cobro por legalizar"
      >
        {cuentasPorLegalizar.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400">No hay cuentas de cobro en borrador.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="w-full text-left text-xs tabular-nums">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-3 font-semibold">Cuenta de cobro</th>
                  <th className="px-3 py-3 font-semibold">Bolsa</th>
                  <th className="px-3 py-3 font-semibold text-center">Gastos</th>
                  <th className="px-3 py-3 font-semibold text-right">Valor a legalizar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cuentasPorLegalizar.map(c => (
                  <tr key={`${c.id}-${c.bolsaId}`}>
                    <td className="px-3 py-3 font-semibold text-slate-700">{c.numeroCuentaCobro}</td>
                    <td className="px-3 py-3 text-slate-600">{c.bolsa ?? "—"}</td>
                    <td className="px-3 py-3 text-center text-slate-600">{c.gastos}</td>
                    <td className="px-3 py-3 text-right font-semibold text-slate-800">{formatoMoneda(c.valorLegalizado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totales.facturadoSinCuenta > 0 && (
          <p className="mt-3 text-xs text-slate-500">
            Además hay <b className="text-slate-700">{formatoMoneda(totales.facturadoSinCuenta)}</b> facturados que aún no están en ninguna cuenta de cobro.
          </p>
        )}
      </Seccion>
    </div>
  )
}
