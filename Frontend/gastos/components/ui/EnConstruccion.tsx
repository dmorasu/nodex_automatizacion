import { Construction } from "lucide-react"

// Marcador para los módulos que se construyen en las siguientes fases
export default function EnConstruccion({
  titulo,
  descripcion,
  fase
}: {
  titulo: string
  descripcion: string
  fase: number
}) {
  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-800">{titulo}</h1>
      <p className="mt-1 text-sm text-slate-400">{descripcion}</p>

      <div className="mt-8 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white py-16">
        <Construction size={32} className="text-slate-300" />
        <p className="text-sm text-slate-500">Este módulo se construye en la fase {fase}.</p>
      </div>
    </div>
  )
}
