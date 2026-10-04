// Par etiqueta / valor para las vistas de detalle
export default function Dato({ etiqueta, valor }: { etiqueta: string, valor: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{etiqueta}</dt>
      <dd className="mt-1 text-xs text-slate-700 break-words">
        {valor === null || valor === undefined || valor === "" ? "—" : valor}
      </dd>
    </div>
  )
}
