import Link from "next/link"
import { Search } from "lucide-react"
import { obtenerDatos } from "@/src/lib/api"
import { ListadoTramitesSchema } from "@/src/schemas"
import TarjetaTramite from "@/components/tramites/TarjetaTramite"
import Paginacion from "@/components/ui/Paginacion"
import { claseInput } from "@/components/ui/estilos"

const FILTROS = [
  ["activos", "Activos"],
  ["sinFactura", "Sin factura"],
  ["cerrados", "Cerrados"],
  ["todos", "Todos"]
] as const

type Filtros = { filtro?: string, busqueda?: string, pagina?: string }

export default async function TramitesPage(props: { searchParams: Promise<Filtros> }) {
  const searchParams = await props.searchParams
  const filtro = FILTROS.some(([codigo]) => codigo === searchParams.filtro) ? searchParams.filtro! : "activos"
  const pagina = Math.max(1, Number(searchParams.pagina) || 1)
  const consulta = new URLSearchParams({ filtro, pagina: String(pagina) })
  if (searchParams.busqueda) consulta.set("busqueda", searchParams.busqueda)

  const listado = (await obtenerDatos(`/tramites?${consulta}`, ListadoTramitesSchema))!

  const url = (cambios: Filtros) => {
    const parametros = new URLSearchParams(
      Object.entries({ filtro, busqueda: searchParams.busqueda, ...cambios }).filter(([, v]) => v) as [string, string][]
    )
    return `/tramites?${parametros}`
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-800">Mis trámites</h1>

      <form className="relative">
        <input type="hidden" name="filtro" value={filtro} />
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
        <input
          name="busqueda"
          defaultValue={searchParams.busqueda}
          placeholder="N° de trámite, placa, matrícula o cliente"
          className={`${claseInput} pl-9`}
          aria-label="Buscar trámite"
          enterKeyHint="search"
        />
      </form>

      <div className="grid grid-cols-4 gap-1.5">
        {FILTROS.map(([codigo, nombre]) => (
          <Link
            key={codigo}
            href={url({ filtro: codigo, pagina: undefined })}
            className={`rounded-lg border px-1 py-2 text-center text-xs font-semibold leading-tight ${filtro === codigo ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-500"}`}
          >
            {nombre}
          </Link>
        ))}
      </div>

      <p className="text-xs text-slate-500">{listado.total} trámite(s)</p>

      <div className="space-y-3">
        {listado.registros.map(tramite => <TarjetaTramite key={tramite.id} tramite={tramite} />)}
      </div>

      {listado.registros.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white py-12 text-center text-sm text-slate-400">
          {searchParams.busqueda ? "Ningún trámite coincide con la búsqueda."
            : filtro === "sinFactura" ? "No tiene facturas pendientes por subir." : "No tiene trámites en esta lista."}
        </p>
      )}

      <Paginacion pagina={pagina} total={listado.total} tamano={listado.tamano} url={p => url({ pagina: String(p) })} />
    </div>
  )
}
