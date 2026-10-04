// Bloque con título para las páginas de detalle
export default function Seccion({ titulo, accion, children }: { titulo: string, accion?: React.ReactNode, children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-800">{titulo}</h2>
        {accion}
      </div>
      {children}
    </section>
  )
}

// Fila etiqueta / valor; no se muestra si no hay valor
export function Dato({ etiqueta, children }: { etiqueta: string, children: React.ReactNode }) {
  if (children === null || children === undefined || children === "") return null
  return (
    <div className="py-2 first:pt-0 last:pb-0">
      <dt className="text-[11px] font-medium text-slate-400">{etiqueta}</dt>
      <dd className="mt-0.5 whitespace-pre-line text-sm text-slate-700">{children}</dd>
    </div>
  )
}
