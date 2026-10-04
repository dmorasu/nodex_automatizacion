// Indicador (stat tile): etiqueta, valor y una línea de contexto
export default function Indicador({
  etiqueta,
  valor,
  detalle,
  destacado = false
}: {
  etiqueta: string
  valor: string
  detalle?: string
  destacado?: boolean
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{etiqueta}</p>
      <p className={`mt-1 font-semibold tabular-nums text-slate-900 ${destacado ? "text-3xl" : "text-xl"}`}>{valor}</p>
      {detalle && <p className="mt-1 text-[11px] text-slate-400">{detalle}</p>}
    </div>
  )
}
