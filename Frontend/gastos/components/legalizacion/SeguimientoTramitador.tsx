import Link from "next/link"

const clase = "inline-flex max-w-full rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-tight"

// Estado del soporte (factura) que subió el tramitador desde su app
export function EtiquetaSoporteTramitador({ estado }: { estado: string | null | undefined }) {
  if (!estado) return null

  if (estado === "PENDIENTE") {
    return (
      <Link href="/legalizacion/soportes" className={`${clase} border-indigo-200 bg-indigo-50 text-indigo-700 hover:underline`}>
        Con soporte del tramitador · por revisar
      </Link>
    )
  }
  return estado === "APROBADO"
    ? <span className={`${clase} border-emerald-200 bg-emerald-50 text-emerald-700`}>Soporte del tramitador aprobado</span>
    : <span className={`${clase} border-red-200 bg-red-50 text-red-700`}>Soporte del tramitador rechazado</span>
}

// Cómo va el trámite en Nodex Trámites: estado actual y si el tramitador lo reportó realizado
export function EstadoTramiteNodex({
  tramiteId,
  estado,
  reporteRealizado
}: {
  tramiteId: number | null | undefined
  estado: string | null | undefined
  reporteRealizado: string | null | undefined
}) {
  if (!tramiteId) return <span className="text-[11px] text-slate-400">Sin trámite</span>

  const finalizado = estado === "Finalizado"

  return (
    <div className="flex flex-wrap gap-1">
      <span className={`${clase} ${finalizado ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
        Trámite #{tramiteId} · {estado ?? "Sin Iniciar"}
      </span>
      {reporteRealizado && !finalizado && (
        <span className={`${clase} border-amber-200 bg-amber-50 text-amber-800`}>
          {reporteRealizado === "PENDIENTE" ? "Realizado (por revisar)" : "Realizado"}
        </span>
      )}
    </div>
  )
}
