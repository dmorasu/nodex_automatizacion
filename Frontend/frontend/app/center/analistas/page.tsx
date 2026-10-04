import Link from "next/link"
import { Metadata } from "next"
import { UserCog } from "lucide-react"
import { requiereAsignarAnalistas } from "@/src/auth/dal"
import { encabezadosSesion } from "@/src/lib/sesionApi"
import ReasignarTramites from "@/components/analistas/ReasignarTramites"
import MunicipiosAnalista, { type MunicipioAnalista } from "@/components/analistas/MunicipiosAnalista"
import type { Analista } from "@/hooks/useAnalistas"

export const metadata: Metadata = {
  title: "Nodex - Asignación de analistas",
}

type Resumen = { analistaId: number | null, nombreUsuario: string | null, abiertos: string, total: string }
type PaginaMunicipios = { registros: MunicipioAnalista[], total: number, paginas: number, pagina: number }

const leer = async <T,>(ruta: string, vacio: T): Promise<T> => {
  try {
    const req = await fetch(`${process.env.API_URL}/solicitudTramites${ruta}`, { headers: encabezadosSesion(), cache: "no-store" })
    return req.ok ? await req.json() : vacio
  } catch {
    return vacio
  }
}

// Administrador de Torre de control: cuántos trámites tiene cada analista, reasignación
// masiva y analista por defecto de cada municipio (lo toman los trámites nuevos)
export default async function AnalistasPage({ searchParams }: {
  searchParams: { busqueda?: string, analistaId?: string, pagina?: string }
}) {
  await requiereAsignarAnalistas()

  const consulta = new URLSearchParams()
  if (searchParams.busqueda) consulta.set("busqueda", searchParams.busqueda)
  if (searchParams.analistaId) consulta.set("analistaId", searchParams.analistaId)
  if (searchParams.pagina) consulta.set("pagina", searchParams.pagina)

  const [analistas, resumen, municipios] = await Promise.all([
    leer<Analista[]>("/analistas", []),
    leer<Resumen[]>("/analistas/resumen", []),
    leer<PaginaMunicipios>(`/analistas/municipios?${consulta}`, { registros: [], total: 0, paginas: 1, pagina: 1 })
  ])

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-sky-100 bg-sky-50">
            <UserCog size={19} className="text-sky-500" />
          </span>
          <h1 className="text-xl font-semibold text-slate-800">Asignación de analistas</h1>
        </div>
        <p className="mt-1 ml-11 text-xs text-slate-400">
          Cada trámite tiene su analista. Cámbielo en el detalle del trámite, o aquí en bloque.
        </p>
      </div>

      {analistas.length === 0 && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          Ningún usuario tiene el rol <b>Analista de trámites</b>. Asígnelo en{" "}
          <Link href="/center/admin" className="font-semibold underline">Administración</Link>{" "}
          para poder elegirlo en las asignaciones.
        </p>
      )}

      {/* RESUMEN POR ANALISTA */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Trámites por analista</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {resumen.map(fila => (
            <div key={fila.analistaId ?? "sin"} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="truncate text-xs font-medium text-slate-500">{fila.nombreUsuario ?? "Sin analista"}</p>
              <p className="mt-1 text-xl font-semibold text-slate-800">{Number(fila.abiertos).toLocaleString("es-CO")}</p>
              <p className="text-[11px] text-slate-400">abiertos · {Number(fila.total).toLocaleString("es-CO")} en total</p>
            </div>
          ))}
        </div>
      </section>

      {/* REASIGNACIÓN MASIVA */}
      <section>
        <h2 className="mb-1 text-sm font-semibold text-slate-700">Pasar trámites de un analista a otro</h2>
        <p className="mb-3 text-xs text-slate-400">
          Mueve los trámites abiertos (no mueve los Finalizados ni los Desistidos). Útil por vacaciones o retiro.
        </p>
        <ReasignarTramites
          analistas={analistas}
          conTramites={resumen.map(r => ({ id: r.analistaId, nombre: r.nombreUsuario ?? "Sin analista", abiertos: Number(r.abiertos) }))}
        />
      </section>

      {/* MUNICIPIOS */}
      <section>
        <h2 className="mb-1 text-sm font-semibold text-slate-700">Analista por defecto de cada municipio</h2>
        <p className="mb-3 text-xs text-slate-400">
          Los trámites nuevos toman el analista de su municipio. Cambiarlo aquí no modifica los trámites que ya existen.
        </p>
        <MunicipiosAnalista
          analistas={analistas}
          municipios={municipios.registros}
          total={municipios.total}
          pagina={municipios.pagina}
          paginas={municipios.paginas}
          filtros={{ busqueda: searchParams.busqueda ?? "", analistaId: searchParams.analistaId ?? "" }}
        />
      </section>
    </div>
  )
}
