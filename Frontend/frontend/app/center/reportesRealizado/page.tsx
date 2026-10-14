import { Metadata } from "next"
import Link from "next/link"
import { CircleCheckBig } from "lucide-react"
import { obtenerReportes } from "@/src/seguimientoTramitador"
import RevisarReporte from "@/components/tramitador/RevisarReporte"
import DevolverReporte from "@/components/tramitador/DevolverReporte"

export const metadata: Metadata = {
  title: "Nodex - Reportados como realizados",
}

const formatoFechaHora = (fecha: string) =>
  new Date(fecha).toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" })

// Trámites que los tramitadores reportaron como realizados desde la app.
// El reporte no cambia el estado: aquí se revisan y se actualiza el estado en el trámite.
export default async function ReportesRealizadoPage({ searchParams }: { searchParams: { estado?: string } }) {
  const estado = searchParams.estado === "REVISADO" || searchParams.estado === "DEVUELTO" ? searchParams.estado : "PENDIENTE"
  const reportes = await obtenerReportes(estado)

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-sky-50">
          <CircleCheckBig className="text-sky-500" size={22} />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Reportados como realizados</h1>
          <p className="text-xs text-slate-500">
            Trámites que el tramitador marcó como realizados en la app. Revíselos y actualice el estado del trámite si corresponde.
          </p>
        </div>
      </div>

      <div className="flex gap-2 text-xs">
        {([["PENDIENTE", "Pendientes de revisión"], ["REVISADO", "Revisados"], ["DEVUELTO", "Devueltos"]] as const).map(([codigo, nombre]) => (
          <Link
            key={codigo}
            href={`/center/reportesRealizado?estado=${codigo}`}
            className={`rounded-full border px-3 py-1 font-semibold ${estado === codigo ? "border-sky-300 bg-sky-50 text-sky-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}
          >
            {nombre}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Trámite</th>
              <th className="px-4 py-3 font-semibold">Tramitador</th>
              <th className="px-4 py-3 font-semibold">Reportado</th>
              <th className="px-4 py-3 font-semibold">Observación</th>
              <th className="px-4 py-3 font-semibold">Estado del trámite</th>
              <th className="px-4 py-3 font-semibold">{estado === "PENDIENTE" ? "" : estado === "DEVUELTO" ? "Devolución" : "Revisión"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {reportes.map(r => (
              <tr key={r.id} className="align-top">
                <td className="px-4 py-3">
                  <Link href={`/center/solicitudTramites/${r.tramite.id}`} className="font-semibold text-sky-600 hover:underline">
                    N° {r.tramite.id}
                  </Link>
                  <p className="text-[11px] text-slate-500">{[r.tramite.tipo, r.tramite.placa ?? r.tramite.matriculaInmobiliaria].filter(Boolean).join(" · ")}</p>
                  <p className="text-[11px] text-slate-400">{r.tramite.cliente}</p>
                </td>
                <td className="px-4 py-3 text-slate-700">{r.tramitador ?? "—"}</td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-500">{formatoFechaHora(r.fecha)}</td>
                <td className="px-4 py-3 max-w-xs whitespace-pre-line text-slate-700">{r.observacion}</td>
                <td className="px-4 py-3 text-slate-600">{r.tramite.estado}</td>
                <td className="px-4 py-3 text-slate-500">
                  {r.estado === "PENDIENTE" ? (
                    <div className="flex flex-col items-start gap-2">
                      <RevisarReporte reporteId={r.id} solicitudTramiteId={r.tramite.id} />
                      <DevolverReporte reporteId={r.id} solicitudTramiteId={r.tramite.id} />
                    </div>
                  ) : (
                    <>
                      <p>{r.revisor ?? "—"}{r.fechaRevision && ` · ${formatoFechaHora(r.fechaRevision)}`}</p>
                      {r.notaRevision && <p className="mt-1 text-slate-700">{r.notaRevision}</p>}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {reportes.length === 0 && (
          <p className="py-12 text-center text-sm text-slate-400">
            {estado === "PENDIENTE" ? "No hay trámites pendientes de revisión." : estado === "DEVUELTO" ? "No hay trámites devueltos." : "No hay reportes revisados."}
          </p>
        )}
      </div>
    </div>
  )
}
