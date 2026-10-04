import { Search } from "lucide-react"
import { claseBotonSecundario, claseInput } from "./estilos"

// Formulario de búsqueda (GET). `ocultos` conserva otros parámetros de la URL al buscar.
export default function Buscador({
  valor,
  ocultos = {},
  placeholder = "Código, concepto, placa, matrícula, factura, beneficiario o N° de trámite"
}: {
  valor?: string
  ocultos?: Record<string, string | undefined>
  placeholder?: string
}) {
  return (
    <form className="flex flex-wrap gap-3">
      {Object.entries(ocultos).filter(([, v]) => v).map(([nombre, v]) => (
        <input key={nombre} type="hidden" name={nombre} value={v} />
      ))}
      <div className="relative flex-1 min-w-[220px]">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
        <input name="busqueda" defaultValue={valor} placeholder={placeholder} className={`${claseInput} pl-9`} aria-label="Buscar" />
      </div>
      <button type="submit" className={claseBotonSecundario}>Buscar</button>
    </form>
  )
}
