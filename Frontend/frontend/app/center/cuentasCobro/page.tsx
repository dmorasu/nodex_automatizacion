import { Metadata } from "next"
import Link from "next/link"
import clsx from "clsx"
import { Download } from "lucide-react"
import { encabezadosSesion } from "@/src/lib/sesionApi"
import { PESTANAS, type ClavePestana, type ListadoCuentas, type PorGenerar } from "@/src/cuentasCobro"
import PanelCuentasCobro from "@/components/cuentasCobro/PanelCuentasCobro"

export const metadata: Metadata = {
  title: "Nodex - Cuentas de cobro",
}

// Cuentas de cobro de los tramitadores: precuenta de los trámites finalizados, revisión del
// analista, envío a la app, visto bueno por semana y paso a Tesorería
export default async function CuentasCobroPage(props: { searchParams: Promise<{ pestana?: string, q?: string, pagina?: string, cuenta?: string }> }) {
  const searchParams = await props.searchParams
  const pestana = PESTANAS.find(p => p.clave === searchParams.pestana) ?? PESTANAS[0]
  const encabezados = await encabezadosSesion()

  const leer = async <T,>(ruta: string, vacio: T): Promise<T> => {
    try {
      const req = await fetch(`${process.env.API_URL}${ruta}`, { headers: encabezados, cache: "no-store" })
      return req.ok ? await req.json() : vacio
    } catch {
      return vacio
    }
  }

  const consulta = new URLSearchParams({ estados: (pestana.estados.length ? pestana.estados : ["BORRADOR"]).join(",") })
  if (searchParams.q) consulta.set("q", searchParams.q)
  if (searchParams.pagina) consulta.set("pagina", searchParams.pagina)

  const [porGenerar, listado] = await Promise.all([
    leer<PorGenerar[] | null>("/cuentas-cobro-tramitadores/por-generar", null),
    leer<ListadoCuentas | null>(`/cuentas-cobro-tramitadores?${consulta}`, null)
  ])

  // Cuántas hay en cada pestaña
  const conteo = (clave: ClavePestana) => {
    if (clave === "porGenerar") return porGenerar?.reduce((suma, s) => suma + s.tramitadores.length, 0) ?? 0
    const estados = PESTANAS.find(p => p.clave === clave)!.estados
    return estados.reduce((suma, estado) => suma + (listado?.conteos[estado] ?? 0), 0)
  }
  const exportar = new URLSearchParams({ estados: pestana.estados.join(",") })
  if (searchParams.q && pestana.clave !== "porGenerar") exportar.set("q", searchParams.q)

  const resaltar =(clave: ClavePestana) => clave === "borradores" && (listado?.conteos.POR_CORREGIR ?? 0) > 0

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-800">Cuentas de cobro</h1>
        {/* Lo de la pestaña con su búsqueda, sin paginar; en Por generar, todas las cuentas */}
        <a
          href={`/api/backend/cuentas-cobro-tramitadores/exportar?${exportar}`}
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
        >
          <Download size={15} />
          Descargar Excel
        </a>
      </div>

      <nav className="flex flex-wrap border-b border-slate-200 sm:flex-nowrap" aria-label="Cuentas de cobro">
        {PESTANAS.map(p => {
          const cantidad = conteo(p.clave)
          return (
            <Link
              key={p.clave}
              href={`/center/cuentasCobro?pestana=${p.clave}`}
              aria-current={pestana.clave === p.clave ? "page" : undefined}
              className={clsx(
                "-mb-px flex min-h-[3rem] min-w-0 basis-1/3 items-center justify-center gap-1.5 border-b-2 px-2 py-2 text-center text-xs font-semibold leading-tight transition sm:flex-1 sm:basis-0",
                pestana.clave === p.clave ? "border-sky-600 bg-sky-50/60 text-sky-700" : "border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              )}
            >
              <span className="text-balance">{p.nombre}</span>
              {cantidad > 0 && p.clave !== "pagadas" && p.clave !== "anuladas" && (
                <span className={clsx("rounded-full px-1.5 py-px text-[10px] tabular-nums",
                  resaltar(p.clave) ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600")}>
                  {cantidad}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {(pestana.clave === "porGenerar" ? !porGenerar : !listado) ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">No se pudieron cargar las cuentas de cobro.</p>
      ) : (
        <PanelCuentasCobro
          key={`${pestana.clave}-${searchParams.q ?? ""}-${searchParams.pagina ?? ""}`}
          pestana={pestana.clave}
          porGenerar={porGenerar ?? []}
          listado={listado ?? { cuentas: [], total: 0, porPagina: 100, conteos: {} }}
          busqueda={searchParams.q ?? ""}
          pagina={Number(searchParams.pagina) || 1}
          cuentaInicial={Number(searchParams.cuenta) || null}
        />
      )}
    </div>
  )
}
