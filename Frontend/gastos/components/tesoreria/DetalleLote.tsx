import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { obtenerSesion } from "@/src/auth/dal"
import { ROLES } from "@/src/auth/permisos"
import { obtenerLote } from "@/src/lib/datosTesoreria"
import { formatoFecha, formatoFechaHora, formatoMoneda } from "@/src/lib/formato"
import SoportesLote from "./SoportesLote"
import BotonEgreso from "../contabilidad/BotonEgreso"
import ListaDocumentos from "../gastos/ListaDocumentos"
import Seccion from "../ui/Seccion"
import Dato from "../ui/Dato"

// Detalle de un pago (lote). Lo usan Tesorería (sube soportes) y Contabilidad (registra el egreso).
export default async function DetalleLote({
  id,
  rutaVolver,
  etiquetaVolver,
  modo
}: {
  id: number
  rutaVolver: string
  etiquetaVolver: string
  modo: "tesoreria" | "contabilidad"
}) {
  const [sesion, lote] = await Promise.all([obtenerSesion(), obtenerLote(id)])

  return (
    <div className="space-y-6">
      <Link href={rutaVolver} className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
        <ArrowLeft size={14} />
        {etiquetaVolver}
      </Link>

      <Seccion titulo={`Lote de pago #${lote.id}`} descripcion={`Registrado por ${lote.creador?.nombreUsuario} el ${formatoFechaHora(lote.createdAt)}`}>
        <dl className="grid gap-5 sm:grid-cols-3">
          <Dato etiqueta="Fecha de pago" valor={formatoFecha(lote.fechaPago)} />
          <Dato etiqueta="Bolsa" valor={lote.bolsa.nombre} />
          <Dato etiqueta="Total" valor={<span className="text-base font-semibold text-slate-800">{formatoMoneda(lote.total)}</span>} />
          <Dato
            etiqueta="Número de egreso (Contabilidad)"
            valor={
              <span className="inline-flex items-center gap-2">
                {lote.numeroEgreso ?? <span className="text-amber-600">Pendiente</span>}
                {modo === "contabilidad" && (
                  <BotonEgreso loteId={lote.id} total={lote.total} cantidadGastos={lote.gastos.length} numeroActual={lote.numeroEgreso} />
                )}
              </span>
            }
          />
          {lote.observacion && <div className="sm:col-span-3"><Dato etiqueta="Observación" valor={lote.observacion} /></div>}
        </dl>
      </Seccion>

      <Seccion titulo={`Gastos pagados (${lote.gastos.length})`}>
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Gasto</th>
                <th className="px-4 py-3 font-semibold">Beneficiario</th>
                <th className="px-4 py-3 font-semibold">Solicitante</th>
                <th className="px-4 py-3 font-semibold text-right">Valor solicitado</th>
                <th className="px-4 py-3 font-semibold text-right">Valor pagado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lote.gastos.map(gasto => (
                <tr key={gasto.id}>
                  <td className="px-4 py-3">
                    <Link href={`/solicitudes/${gasto.id}`} className="font-semibold text-emerald-700 hover:underline">{gasto.codigo}</Link>
                    <p className="text-[11px] text-slate-400">{gasto.conceptoPago}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{gasto.beneficiario.nombre}</td>
                  <td className="px-4 py-3 text-slate-600">{gasto.creador?.nombreUsuario}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{formatoMoneda(gasto.valorSolicitadoPago)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatoMoneda(gasto.valorRealmentePagado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Seccion>

      <Seccion titulo="Soporte de pago" descripcion="Lo ven también quienes crearon los gastos de este lote.">
        {modo === "tesoreria" ? <SoportesLote
          loteId={lote.id}
          documentos={lote.documentos}
          usuarioId={sesion.id}
          esAdmin={sesion.roles.includes(ROLES.ADMIN)}
        /> : <ListaDocumentos documentos={lote.documentos} vacio="Este lote no tiene soporte de pago." />}
      </Seccion>
    </div>
  )
}
