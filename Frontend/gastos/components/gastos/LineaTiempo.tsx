import { formatoFechaHora } from "@/src/lib/formato"
import type { GastoDetalle } from "@/src/schemas/gastos"
import EstadoGasto from "./EstadoGasto"

// Historial de cambios de estado del gasto, del más antiguo al más reciente
export default function LineaTiempo({ eventos }: { eventos: GastoDetalle["trazabilidad"] }) {
  return (
    <ol className="relative ml-2 border-l border-slate-200">
      {eventos.map(evento => (
        <li key={evento.id} className="mb-6 ml-5 last:mb-0">
          <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />

          <div className="flex flex-wrap items-center gap-2">
            <EstadoGasto codigo={evento.estadoNuevo.codigo} nombre={evento.estadoNuevo.nombre} />
            <span className="text-[11px] text-slate-400">
              {formatoFechaHora(evento.createdAt)} · {evento.usuario?.nombreUsuario}
            </span>
          </div>

          {evento.observacion && <p className="mt-1.5 text-xs text-slate-600">{evento.observacion}</p>}
        </li>
      ))}
    </ol>
  )
}
