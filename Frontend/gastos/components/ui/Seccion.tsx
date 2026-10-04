// Tarjeta con título para agrupar campos o datos
export default function Seccion({
  titulo,
  descripcion,
  acciones,
  children
}: {
  titulo: string
  descripcion?: string
  acciones?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">{titulo}</h2>
          {descripcion && <p className="mt-0.5 text-xs text-slate-400">{descripcion}</p>}
        </div>
        {acciones}
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}
