import Link from "next/link"
import { FileText } from "lucide-react"
import { z } from "zod"
import { fetchApi } from "@/src/lib/api"
import { formatoFecha, formatoMoneda } from "@/src/lib/formato"
import { SoporteRevisionSchema } from "@/src/schemas/gastos"
import EstadoGasto from "@/components/gastos/EstadoGasto"
import RevisionSoporte from "@/components/legalizacion/RevisionSoporte"
import { EstadoTramiteNodex } from "@/components/legalizacion/SeguimientoTramitador"

const ESTADOS = [
  ["PENDIENTE", "Por revisar"],
  ["APROBADO", "Aprobados"],
  ["RECHAZADO", "Rechazados"]
] as const

const ETIQUETA_TIPO = {
  FACTURA: { nombre: "Factura", clase: "border-sky-200 bg-sky-50 text-sky-700" },
  REINTEGRO: { nombre: "Comprobante de reintegro", clase: "border-amber-200 bg-amber-50 text-amber-700" },
  OTRO: { nombre: "Otro documento", clase: "border-slate-200 bg-slate-50 text-slate-600" }
}

// Facturas, comprobantes de reintegro y otros documentos que suben los tramitadores desde su app.
// Legalización revisa los de gastos reembolsables y Contabilidad los de no reembolsables.
export default async function BandejaSoportes({
  estado: estadoPedido,
  reembolsable,
  urlEstado
}: {
  estado?: string
  reembolsable: "si" | "no"
  urlEstado: (estado: string) => string
}) {
  const estado = ESTADOS.some(([codigo]) => codigo === estadoPedido) ? estadoPedido! : "PENDIENTE"
  const respuesta = await fetchApi(`/gastos/soportes-tramitador?estado=${estado}&reembolsable=${reembolsable}`)
  const soportes = z.array(SoporteRevisionSchema).parse(await respuesta.json())

  return (
    <div className="space-y-4">
      <div className="flex gap-2 text-xs">
        {ESTADOS.map(([codigo, nombre]) => (
          <Link
            key={codigo}
            href={urlEstado(codigo)}
            className={`rounded-full border px-3 py-1 font-semibold ${estado === codigo ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}
          >
            {nombre}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Gasto</th>
              <th className="px-4 py-3 font-semibold">Tramitador</th>
              <th className="px-4 py-3 font-semibold">Soporte</th>
              <th className="px-4 py-3 font-semibold">Archivos</th>
              <th className="px-4 py-3 font-semibold text-right">Valor</th>
              <th className="px-4 py-3 font-semibold text-right">{estado === "PENDIENTE" ? "" : "Revisión"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {soportes.map(s => {
              const gasto = s.solicitudGasto
              const esReintegro = s.tipo === "REINTEGRO"
              return (
                <tr key={s.id} className="align-top">
                  <td className="px-4 py-3">
                    <Link href={`/solicitudes/${gasto.id}`} className="font-semibold text-emerald-700 hover:underline">{gasto.codigo}</Link>
                    <p className="text-[11px] text-slate-400">{gasto.conceptoPago}</p>
                    <p className="text-[11px] text-slate-400">
                      {[gasto.bolsa?.nombre, gasto.placa ?? gasto.matriculaInmobiliaria, gasto.solicitudTramiteId && `Trámite #${gasto.solicitudTramiteId}`].filter(Boolean).join(" · ")}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <EstadoGasto codigo={gasto.estado.codigo} nombre={gasto.estado.nombre} />
                    </div>
                    <div className="mt-1">
                      <EstadoTramiteNodex tramiteId={s.tramite?.id} estado={s.tramite?.estado} reporteRealizado={s.tramite?.reporteRealizado} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {s.tramitador?.nombreTramitador ?? "—"}
                    <p className="text-[11px] text-slate-400">{formatoFecha(s.createdAt)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${ETIQUETA_TIPO[s.tipo].clase}`}>
                      {ETIQUETA_TIPO[s.tipo].nombre}
                    </span>
                    {s.observacion && <p className="mt-1 max-w-xs whitespace-pre-line text-slate-600">{s.observacion}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <ul className="space-y-1">
                      {s.archivos.map(a => (
                        <li key={a.id}>
                          <a href={`/soportes-tramitador/archivos/${a.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald-700 hover:underline">
                            <FileText size={13} />
                            <span className="max-w-[180px] truncate">{a.nombreOriginal}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {esReintegro ? (
                      <>
                        <b className="text-slate-800">{formatoMoneda(s.reintegro?.valorReintegro)}</b>
                        <p className="text-[11px] text-slate-400">a reintegrar</p>
                      </>
                    ) : (
                      <>
                        <b className="text-slate-800">{formatoMoneda(gasto.valorRealmentePagado)}</b>
                        <p className="text-[11px] text-slate-400">pagado</p>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {s.estado === "PENDIENTE" ? (
                      <RevisionSoporte soporteId={s.id} esReintegro={esReintegro} esFactura={s.tipo === "FACTURA"} valorReintegro={s.reintegro?.valorReintegro ?? null} />
                    ) : (
                      <div className="text-[11px] text-slate-500">
                        <p>{s.revisor?.nombreUsuario ?? "—"} · {formatoFecha(s.fechaRevision)}</p>
                        {s.motivoRechazo && <p className="mt-1 text-red-600">{s.motivoRechazo}</p>}
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {soportes.length === 0 && (
          <p className="py-14 text-center text-sm text-slate-400">
            {estado === "PENDIENTE"
              ? "No hay soportes por revisar. Aquí llegan las facturas y comprobantes que suben los tramitadores desde su app."
              : "No hay soportes en este estado."}
          </p>
        )}
      </div>
    </div>
  )
}
