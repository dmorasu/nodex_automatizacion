import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { formatoMoneda } from "@/src/lib/formato"
import type { GastoDelTramite } from "@/src/schemas"
import Etiqueta, { type Tono } from "../ui/Etiqueta"
import SubirDocumentos from "./SubirDocumentos"

// Qué necesita cada gasto del trámite
const estadoDelGasto = (g: GastoDelTramite): { tono: Tono, texto: string } => {
  if (g.reintegrosPorSoportar.length > 0) {
    const total = g.reintegrosPendientes.filter(r => g.reintegrosPorSoportar.includes(r.id)).reduce((s, r) => s + Number(r.valor), 0)
    return { tono: "ambar", texto: `Debe reintegrar ${formatoMoneda(total)}` }
  }
  if (g.puedeSubirFactura) {
    return g.soporteFactura?.estado === "RECHAZADO"
      ? { tono: "rojo", texto: "Factura rechazada" }
      : { tono: "ambar", texto: "Falta la factura" }
  }
  if (g.soporteFactura?.estado === "PENDIENTE" || g.reintegrosPendientes.length > 0) return { tono: "indigo", texto: "En revisión" }
  return { tono: "verde", texto: "Al día" }
}

// Gastos pagados del trámite. La factura y la boleta de reintegro se suben aquí
// y llegan solas al gasto (para Legalización).
export default function GastosDelTramite({ tramiteId, gastos }: { tramiteId: number, gastos: GastoDelTramite[] }) {
  if (gastos.length === 0) return null

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-slate-800">Gastos de este trámite</h2>
      <ul className="space-y-3">
        {gastos.map(g => {
          const estado = estadoDelGasto(g)
          return (
            <li key={g.id} className="rounded-lg border border-slate-200 p-3">
              <Link href={`/gastos/${g.id}`} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-indigo-600">{g.codigo}</p>
                  <p className="text-sm font-medium text-slate-700">{g.conceptoPago}</p>
                  <p className="text-xs text-slate-500">Pagado {formatoMoneda(g.valorRealmentePagado)}</p>
                </div>
                <ChevronRight size={17} className="mt-1 shrink-0 text-slate-300" />
              </Link>

              <div className="mt-2"><Etiqueta tono={estado.tono}>{estado.texto}</Etiqueta></div>
              {g.puedeSubirFactura && g.soporteFactura?.estado === "RECHAZADO" && g.soporteFactura.motivoRechazo && (
                <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700"><b>Motivo:</b> {g.soporteFactura.motivoRechazo}</p>
              )}

              {g.puedeSubirFactura && (
                <div className="mt-3">
                  <SubirDocumentos tramiteId={tramiteId} gastos={gastos} tipoInicial="FACTURA" gastoInicialId={g.id} texto="Subir factura" principal />
                </div>
              )}
              {g.reintegrosPorSoportar.length > 0 && (
                <div className="mt-3">
                  <SubirDocumentos tramiteId={tramiteId} gastos={gastos} tipoInicial="BOLETA_REINTEGRO" gastoInicialId={g.id} texto="Subir boleta de reintegro" principal />
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
