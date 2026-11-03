import Link from "next/link"
import { CalendarClock, ChevronRight, MapPin } from "lucide-react"
import { formatoFecha, formatoHoraCita } from "@/src/lib/formato"
import type { TramiteListado } from "@/src/schemas"
import Etiqueta, { tonoEstadoTramite } from "../ui/Etiqueta"

// Tarjeta de un trámite en la lista: qué es, dónde y cuándo
export default function TarjetaTramite({ tramite }: { tramite: TramiteListado }) {
  const estado = tramite.estadoActual?.nombreEstado ?? "Sin Iniciar"
  const diligencia = tramite.programacion?.fechaRealizacionDiligencia
  const cita = tramite.programacion?.requiereCita && tramite.programacion.fechaCita
  const referencia = tramite.placa ?? tramite.matriculaInmobiliaria

  return (
    <Link href={`/tramites/${tramite.id}`} className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm active:bg-slate-50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-indigo-600">Trámite N° {tramite.id}</p>
          <p className="mt-0.5 font-semibold text-slate-800">{tramite.tramite?.nombreTramite ?? "Trámite"}</p>
          {referencia && <p className="text-sm text-slate-600">{referencia}</p>}
        </div>
        <ChevronRight size={18} className="mt-1 shrink-0 text-slate-300" />
      </div>

      {tramite.detalleSolicitud && (
        <p className="mt-2 line-clamp-2 text-xs text-slate-500">{tramite.detalleSolicitud}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Etiqueta tono={tonoEstadoTramite(estado)}>{estado}</Etiqueta>
        {tramite.reportePendiente && <Etiqueta tono="ambar">Reportado realizado</Etiqueta>}
        {(tramite.gastosSinFactura ?? 0) > 0 && <Etiqueta tono="rojo">Falta factura</Etiqueta>}
      </div>

      <div className="mt-3 space-y-1 text-xs text-slate-500">
        {(diligencia || cita) && (
          <p className="flex items-center gap-1.5">
            <CalendarClock size={14} className="text-slate-400" />
            {cita
              ? <>Cita {formatoFecha(tramite.programacion!.fechaCita)}{tramite.programacion?.horaCita && ` · ${formatoHoraCita(tramite.programacion.horaCita, tramite.programacion.horaFinCita)}`}</>
              : <>Diligencia {formatoFecha(diligencia)}</>}
          </p>
        )}
        {tramite.municipios && (
          <p className="flex items-center gap-1.5">
            <MapPin size={14} className="text-slate-400" />
            {tramite.municipios.nombreMunicipio}{tramite.direccionTramite && ` · ${tramite.direccionTramite}`}
          </p>
        )}
      </div>
    </Link>
  )
}
