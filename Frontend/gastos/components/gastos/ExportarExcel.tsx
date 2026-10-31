import { FileSpreadsheet } from "lucide-react"
import { claseBotonSecundario } from "../ui/estilos"

// Descarga en Excel todo lo que muestra la bandeja con sus filtros (no solo lo visible en
// pantalla), con el detalle completo de cada gasto. `consulta` = los mismos parámetros del
// listado; `archivo` = nombre del archivo (ej. tesoreria-por-pagar)
export default function ExportarExcel({ consulta, archivo, className = "h-8 text-[11px]" }: { consulta: URLSearchParams, archivo: string, className?: string }) {
  const parametros = new URLSearchParams(consulta)
  for (const clave of ["tamano", "pagina", "totales"]) parametros.delete(clave)
  parametros.set("archivo", archivo)
  return (
    <a href={`/descargas/gastos-excel?${parametros}`} className={`${claseBotonSecundario} ${className}`}>
      <FileSpreadsheet size={14} /> Descargar Excel
    </a>
  )
}
