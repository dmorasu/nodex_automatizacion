import { FileText } from "lucide-react"
import { formatoFechaHora, formatoMoneda } from "@/src/lib/formato"
import type { GastoDetalle } from "@/src/schemas/gastos"
import RevisionSoporte from "./RevisionSoporte"

const NOMBRE_TIPO = {
  FACTURA: "Factura",
  REINTEGRO: "Comprobante de reintegro",
  OTRO: "Otro documento"
}

// Aviso en el detalle del gasto: lo que subió el tramitador no aparece en los documentos ni marca
// el reintegro hasta que se aprueba, y sin este aviso parecía que no había llegado (trámite 6262).
// Quien lleva la legalización del gasto lo ve y lo revisa aquí mismo, igual que en la bandeja
export default function SoportesPorRevisar({ gasto }: { gasto: GastoDetalle }) {
  if (gasto.soportesPendientes.length === 0) return null
  const puedeRevisar = gasto.permisos.revisarSoportes === true

  return (
    <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
      <p className="font-semibold">
        {gasto.soportesPendientes.length === 1
          ? "El tramitador subió un soporte que está por revisar"
          : `El tramitador subió ${gasto.soportesPendientes.length} soportes que están por revisar`}
      </p>
      <ul className="mt-2 divide-y divide-amber-200">
        {gasto.soportesPendientes.map(s => (
          <li key={s.id} className="flex flex-wrap items-start justify-between gap-3 py-2">
            <div className="space-y-1">
              <p>
                <b>{NOMBRE_TIPO[s.tipo]}</b>
                {s.reintegro && <> de <b>{formatoMoneda(s.reintegro.valorReintegro)}</b></>}
                {" · "}{s.tramitador?.nombreTramitador ?? "Tramitador"} · {formatoFechaHora(s.createdAt)}
              </p>
              {s.observacion && <p className="whitespace-pre-line text-amber-700">{s.observacion}</p>}
              {s.archivos && s.archivos.length > 0 && (
                <ul className="flex flex-wrap gap-x-4 gap-y-1">
                  {s.archivos.map(a => (
                    <li key={a.id}>
                      <a href={`/soportes-tramitador/archivos/${a.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald-700 hover:underline">
                        <FileText size={13} />
                        <span className="max-w-[220px] truncate">{a.nombreOriginal}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {puedeRevisar && (
              <RevisionSoporte
                soporteId={s.id}
                esReintegro={s.tipo === "REINTEGRO"}
                esFactura={s.tipo === "FACTURA"}
                valorReintegro={s.reintegro?.valorReintegro ?? null}
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
