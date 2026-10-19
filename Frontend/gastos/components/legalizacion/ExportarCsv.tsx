import { FileSpreadsheet } from "lucide-react"
import { claseBotonSecundario } from "../ui/estilos"

// Descarga en CSV (abre en Excel) todo lo que muestra la tabla con sus filtros, no solo lo
// visible en pantalla. `consulta` = los mismos parámetros del listado
export default function ExportarCsv({ consulta }: { consulta: URLSearchParams }) {
  const parametros = new URLSearchParams(consulta)
  parametros.delete("tamano")
  parametros.delete("pagina")
  return (
    <a href={`/descargas/gastos-csv?${parametros}`} className={`${claseBotonSecundario} h-8 text-[11px]`}>
      <FileSpreadsheet size={14} /> Exportar a Excel (CSV)
    </a>
  )
}
