import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"

// Anterior / siguiente (en el celular es más cómodo que una lista de números)
export default function Paginacion({
  pagina,
  total,
  tamano,
  url
}: {
  pagina: number
  total: number
  tamano: number
  url: (pagina: number) => string
}) {
  const paginas = Math.max(1, Math.ceil(total / tamano))
  if (paginas <= 1) return null

  const clase = "flex h-11 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 active:bg-slate-100"

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 pt-2">
      <div className="justify-self-start">
        {pagina > 1 && <Link href={url(pagina - 1)} className={clase} aria-label="Página anterior"><ChevronLeft size={16} /> Anterior</Link>}
      </div>
      <span className="text-center text-xs text-slate-500">{pagina} de {paginas}</span>
      <div className="justify-self-end">
        {pagina < paginas && <Link href={url(pagina + 1)} className={clase} aria-label="Página siguiente">Siguiente <ChevronRight size={16} /></Link>}
      </div>
    </div>
  )
}
