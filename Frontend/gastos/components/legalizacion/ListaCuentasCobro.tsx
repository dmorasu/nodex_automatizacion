import Link from "next/link"
import { Search } from "lucide-react"
import { obtenerCuentas } from "@/src/lib/datosLegalizacion"
import { formatoFecha, formatoMoneda } from "@/src/lib/formato"
import EstadoGasto from "../gastos/EstadoGasto"
import Paginacion from "../ui/Paginacion"
import { claseBotonSecundario, claseInput } from "../ui/estilos"
import SelectBuscable from "@/components/ui/SelectBuscable"

type Filtros = { estado?: string, busqueda?: string, pagina?: string }

const ESTADOS = [
  { codigo: "BORRADOR", nombre: "Borrador" },
  { codigo: "LEGALIZADA", nombre: "Legalizada" },
  { codigo: "CONTABILIZADA", nombre: "Contabilizada" },
  { codigo: "ANULADA", nombre: "Anulada" }
]

// Lista de cuentas de cobro. Se usa en Legalización y en Tesorería (cambia la ruta base).
export default async function ListaCuentasCobro({ searchParams, rutaBase }: { searchParams: Filtros, rutaBase: string }) {
  const pagina = Math.max(1, Number(searchParams.pagina) || 1)
  const { total, tamano, registros } = await obtenerCuentas({ ...searchParams, pagina })

  const url = (p: number) => {
    const parametros = new URLSearchParams({ ...searchParams, pagina: String(p) } as Record<string, string>)
    return `${rutaBase}?${parametros}`
  }

  return (
    <div className="space-y-4">
      <form className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
          <input name="busqueda" defaultValue={searchParams.busqueda} placeholder="Número de cuenta de cobro" className={`${claseInput} pl-9`} aria-label="Buscar" />
        </div>
        <SelectBuscable name="estado" defaultValue={searchParams.estado ?? ""} className={`${claseInput} w-auto`} aria-label="Estado">
          <option value="">Todos los estados</option>
          {ESTADOS.map(e => <option key={e.codigo} value={e.codigo}>{e.nombre}</option>)}
        </SelectBuscable>
        <button type="submit" className={claseBotonSecundario}>Filtrar</button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Cuenta de cobro</th>
              <th className="px-4 py-3 font-semibold">Creada</th>
              <th className="px-4 py-3 font-semibold">Radicación</th>
              <th className="px-4 py-3 font-semibold text-center">Gastos</th>
              <th className="px-4 py-3 font-semibold text-right">Facturas</th>
              <th className="px-4 py-3 font-semibold text-right">Legalizado</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {registros.map(cuenta => (
              <tr key={cuenta.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`${rutaBase}/${cuenta.id}`} className="font-semibold text-emerald-700 hover:underline">
                    {cuenta.numeroCuentaCobro}
                  </Link>
                  <p className="text-[11px] text-slate-400">{cuenta.creador?.nombreUsuario}</p>
                </td>
                <td className="px-4 py-3 text-slate-500">{formatoFecha(cuenta.createdAt)}</td>
                <td className="px-4 py-3 text-slate-500">{formatoFecha(cuenta.fechaRadicacion)}</td>
                <td className="px-4 py-3 text-center text-slate-600">{cuenta.cantidadGastos}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatoMoneda(cuenta.totalFacturas)}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatoMoneda(cuenta.totalLegalizado)}</td>
                <td className="px-4 py-3"><EstadoGasto codigo={cuenta.estado.codigo} nombre={cuenta.estado.nombre} /></td>
              </tr>
            ))}
          </tbody>
        </table>

        {registros.length === 0 && (
          <p className="py-14 text-center text-sm text-slate-400">
            No hay cuentas de cobro. Se crean en Legalización, pestaña Gastos con factura.
          </p>
        )}
      </div>

      <Paginacion pagina={pagina} total={total} tamano={tamano} url={url} />
    </div>
  )
}
