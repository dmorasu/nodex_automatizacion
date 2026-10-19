import Link from "next/link"
import { fetchApi } from "@/src/lib/api"
import { obtenerCatalogos, obtenerTasas } from "@/src/lib/datosGastos"
import { formatoFecha, formatoMoneda } from "@/src/lib/formato"
import { ListadoGastosSchema } from "@/src/schemas/gastos"
import BotonFactura from "./BotonFactura"
import ExportarCsv from "./ExportarCsv"
import { EstadoTramiteNodex, EtiquetaSoporteTramitador } from "./SeguimientoTramitador"

const MAXIMO_BANDEJA = 100

// Gastos pagados a los que les falta registrar los valores de la factura, con el estado
// de su trámite en Nodex Trámites y el soporte del tramitador. Desde aquí se registra la factura.
// La usan Legalización (reembolsables) y Contabilidad (no reembolsables).
export default async function TablaGastosPorFacturar({
  filtros,
  busqueda,
  vacio,
  avisoSoporte = false
}: {
  filtros: Record<string, string>
  busqueda?: string
  vacio: string
  // Muestra el aviso de que hay un soporte del tramitador para revisar
  avisoSoporte?: boolean
}) {
  const consulta = new URLSearchParams({ alcance: "todos", estado: "PAGADO", tamano: String(MAXIMO_BANDEJA), ...filtros })
  if (busqueda) consulta.set("busqueda", busqueda)

  const [respuesta, tasas, catalogos] = await Promise.all([
    fetchApi(`/gastos/solicitudes?${consulta}`),
    obtenerTasas(),
    obtenerCatalogos()
  ])

  const { total, registros } = ListadoGastosSchema.parse(await respuesta.json())
  const tipoDocumentoFacturaId = catalogos.tiposDocumento.find(t => t.codigo === "FACTURA")?.id ?? null

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-amber-700">
          {total > MAXIMO_BANDEJA && `Se muestran ${MAXIMO_BANDEJA} de ${total} gastos. Use los filtros o exporte el listado completo.`}
        </p>
        {total > 0 && <ExportarCsv consulta={consulta} />}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Gasto</th>
              <th className="px-4 py-3 font-semibold">Beneficiario</th>
              <th className="px-4 py-3 font-semibold">Bolsa</th>
              <th className="px-4 py-3 font-semibold">Trámite en Nodex</th>
              <th className="px-4 py-3 font-semibold">Fecha de pago</th>
              <th className="px-4 py-3 font-semibold text-right">Valor pagado</th>
              <th className="px-4 py-3 font-semibold text-right">4x1000</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {registros.map(gasto => (
              <tr key={gasto.id} className="align-top">
                <td className="px-4 py-3">
                  <Link href={`/solicitudes/${gasto.id}`} className="font-semibold text-emerald-700 hover:underline">{gasto.codigo}</Link>
                  <p className="text-[11px] text-slate-400">{gasto.conceptoPago}</p>
                  {gasto.tramitador && <p className="text-[11px] text-slate-400">Tramitador: {gasto.tramitador.nombreTramitador}</p>}
                </td>
                <td className="px-4 py-3 text-slate-600">{gasto.beneficiario.nombre}</td>
                <td className="px-4 py-3 text-slate-600">{gasto.bolsa?.nombre ?? "—"}</td>
                <td className="px-4 py-3">
                  <div className="space-y-1">
                    <EstadoTramiteNodex tramiteId={gasto.solicitudTramiteId} estado={gasto.estadoTramite} reporteRealizado={gasto.reporteRealizado} />
                    {avisoSoporte && <EtiquetaSoporteTramitador estado={gasto.soporteTramitador} />}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-500">{formatoFecha(gasto.fechaPago)}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatoMoneda(gasto.valorRealmentePagado)}</td>
                <td className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">
                  {gasto.factura
                    ? formatoMoneda(gasto.factura.cuatroXMil)
                    // Sin factura registrada: estimado sobre lo pagado (el definitivo es sobre la factura)
                    : (
                      <span title="Estimado sobre el valor pagado: al registrar la factura se calcula sobre su valor">
                        {formatoMoneda(Math.round(Number(gasto.valorRealmentePagado ?? 0) * 100 * tasas.gmf) / 100)}
                        <span className="block text-[10px] text-slate-400">estimado</span>
                      </span>
                    )}
                </td>
                <td className="px-4 py-3 text-right">
                  <BotonFactura gasto={gasto} tasas={tasas} tipoDocumentoFacturaId={tipoDocumentoFacturaId} compacto />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {registros.length === 0 && <p className="py-14 text-center text-sm text-slate-400">{vacio}</p>}
      </div>
    </div>
  )
}
