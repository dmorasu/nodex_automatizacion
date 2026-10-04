import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { formatoFecha, formatoMoneda } from "@/src/lib/formato"
import type { Gasto } from "@/src/schemas"
import Etiqueta from "../ui/Etiqueta"

// Qué le pide el gasto al tramitador hoy (una sola etiqueta, la más importante)
export const pendienteDelGasto = (gasto: Gasto) => {
  const porReintegrar = gasto.reintegros.filter(r => r.estado.codigo === "PENDIENTE")
  const enRevision = gasto.soportes.some(s => s.estado === "PENDIENTE")
  // Solo pesan los rechazos de factura o reintegro (un "Otro" rechazado no bloquea nada)
  const rechazado = gasto.soportes.find(s => s.estado === "RECHAZADO" && s.tipo !== "OTRO")
  // Un rechazo solo cuenta si después no se envió otro del mismo tipo
  const rechazoVigente = rechazado && !gasto.soportes.some(s =>
    s.tipo === rechazado.tipo && s.reintegroId === rechazado.reintegroId && s.createdAt > rechazado.createdAt)

  if (rechazoVigente && (gasto.puedeSubirFactura || gasto.reintegrosPorSoportar.length > 0)) {
    return { tono: "rojo" as const, texto: "Soporte rechazado" }
  }
  if (gasto.reintegrosPorSoportar.length > 0) {
    const total = porReintegrar.filter(r => gasto.reintegrosPorSoportar.includes(r.id)).reduce((s, r) => s + Number(r.valorReintegro), 0)
    return { tono: "ambar" as const, texto: `Debe reintegrar ${formatoMoneda(total)}` }
  }
  if (gasto.puedeSubirFactura) return { tono: "ambar" as const, texto: "Falta la factura" }
  if (enRevision) return { tono: "indigo" as const, texto: "En revisión" }
  return { tono: "verde" as const, texto: "Al día" }
}

export default function TarjetaGasto({ gasto }: { gasto: Gasto }) {
  const pendiente = pendienteDelGasto(gasto)

  return (
    <Link href={`/gastos/${gasto.id}`} className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm active:bg-slate-50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-indigo-600">{gasto.codigo}</p>
          <p className="mt-0.5 font-semibold text-slate-800">{gasto.conceptoPago}</p>
          <p className="text-xs text-slate-500">
            {[gasto.placa ?? gasto.matriculaInmobiliaria, gasto.solicitudTramiteId && `Trámite N° ${gasto.solicitudTramiteId}`].filter(Boolean).join(" · ")}
          </p>
        </div>
        <ChevronRight size={18} className="mt-1 shrink-0 text-slate-300" />
      </div>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <p className="text-[11px] text-slate-400">Pagado el {formatoFecha(gasto.fechaPago)}</p>
          <p className="text-lg font-semibold tabular-nums text-slate-800">{formatoMoneda(gasto.valorRealmentePagado)}</p>
        </div>
        <Etiqueta tono={pendiente.tono}>{pendiente.texto}</Etiqueta>
      </div>
    </Link>
  )
}
