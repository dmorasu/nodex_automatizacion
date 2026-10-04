import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { claseBotonSecundario } from "./estilos"

// Paginación por URL. `url(p)` arma el enlace de la página p conservando los filtros.
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
  const totalPaginas = Math.max(1, Math.ceil(total / tamano))
  if (totalPaginas <= 1) return null

  const boton = (destino: number, deshabilitado: boolean, icono: React.ReactNode, etiqueta: string) => (
    <Link
      href={url(destino)}
      aria-label={etiqueta}
      aria-disabled={deshabilitado}
      className={`${claseBotonSecundario} h-8 px-2 ${deshabilitado ? "pointer-events-none opacity-40" : ""}`}
    >
      {icono}
    </Link>
  )

  return (
    <div className="flex items-center justify-end gap-2 text-xs text-slate-500">
      <span>Página {pagina} de {totalPaginas}</span>
      {boton(pagina - 1, pagina <= 1, <ChevronLeft size={15} />, "Página anterior")}
      {boton(pagina + 1, pagina >= totalPaginas, <ChevronRight size={15} />, "Página siguiente")}
    </div>
  )
}
