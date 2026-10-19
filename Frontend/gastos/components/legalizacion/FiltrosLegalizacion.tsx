import Link from "next/link"
import { Search } from "lucide-react"
import { obtenerBolsasActivas } from "@/src/lib/datosGastos"
import SelectBuscable from "@/components/ui/SelectBuscable"
import { claseBotonSecundario, claseInput } from "../ui/estilos"

// Filtros de las bandejas de Legalización (van en la URL, formulario GET)
export const FILTROS_LEGALIZACION = ["busqueda", "bolsaId", "codigoBpr", "placa", "matricula"] as const
export type FiltrosLegalizacion = Partial<Record<typeof FILTROS_LEGALIZACION[number], string>>

// Solo los filtros con valor, para sumarlos a la consulta del listado de gastos
export const filtrosActivos = (parametros: FiltrosLegalizacion) =>
  Object.fromEntries(FILTROS_LEGALIZACION.map(f => [f, parametros[f]?.trim()]).filter(([, v]) => v)) as Record<string, string>

const claseCampo = `${claseInput} h-9`

// `ocultos` conserva otros parámetros de la URL (ej: el grupo de Descargar documentos);
// `limpiar` es la ruta sin filtros
export default async function FiltrosLegalizacion({ valores, ocultos = {}, limpiar }: {
  valores: FiltrosLegalizacion
  ocultos?: Record<string, string | undefined>
  limpiar: string
}) {
  const bolsas = await obtenerBolsasActivas()
  const hayFiltros = Object.keys(filtrosActivos(valores)).length > 0

  return (
    <form className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-6">
      {Object.entries(ocultos).filter(([, v]) => v).map(([nombre, v]) => (
        <input key={nombre} type="hidden" name={nombre} value={v} />
      ))}
      <div className="relative sm:col-span-2 lg:col-span-6">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
        <input name="busqueda" defaultValue={valores.busqueda} placeholder="Código, concepto, factura, beneficiario o N° de trámite" className={`${claseCampo} pl-9`} aria-label="Buscar" />
      </div>
      <SelectBuscable name="bolsaId" defaultValue={valores.bolsaId ?? ""} className={claseCampo} aria-label="Bolsa">
        <option value="">Todas las bolsas</option>
        {bolsas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
      </SelectBuscable>
      <input name="codigoBpr" defaultValue={valores.codigoBpr} placeholder="Código BPR/FTF" className={claseCampo} aria-label="Código BPR/FTF" />
      <input name="placa" defaultValue={valores.placa} placeholder="Placa" className={claseCampo} aria-label="Placa" />
      <input name="matricula" defaultValue={valores.matricula} placeholder="Matrícula inmobiliaria" className={claseCampo} aria-label="Matrícula inmobiliaria" />
      <div className="flex gap-2 sm:col-span-2 lg:col-span-2">
        <button type="submit" className={`${claseBotonSecundario} h-9 flex-1`}>Filtrar</button>
        {hayFiltros && <Link href={limpiar} className={`${claseBotonSecundario} h-9`}>Limpiar</Link>}
      </div>
    </form>
  )
}
