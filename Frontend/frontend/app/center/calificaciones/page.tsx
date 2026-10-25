import { Metadata } from "next"
import Link from "next/link"
import clsx from "clsx"
import { Search } from "lucide-react"
import { encabezadosSesion } from "@/src/lib/sesionApi"
import { nivel, numero, type CalificacionesPorTramite, type CalificacionesPorTramitador } from "@/src/calificaciones"
import SelectBuscable from "@/components/ui/SelectBuscable"
import { claseBotonSecundario, claseInput } from "@/components/ui/estilos"
import TablaCalificacionesTramites from "@/components/calificaciones/TablaCalificacionesTramites"
import TablaCalificacionesTramitadores from "@/components/calificaciones/TablaCalificacionesTramitadores"

export const metadata: Metadata = {
  title: "Nodex - Calificaciones",
}

type Parametros = { vista?: string, mes?: string, tramitadorId?: string, estado?: string, q?: string, pagina?: string }

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
// "2026-10" → "Octubre 2026"
const nombreMes = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1]} ${mes.slice(0, 4)}`
// Primer y último día del mes (YYYY-MM)
const rangoDelMes = (mes: string) => {
  const ultimo = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)).getUTCDate()
  return { desde: `${mes}-01`, hasta: `${mes}-${String(ultimo).padStart(2, "0")}` }
}

// Calificaciones de la encuesta que se llena al finalizar el trámite, por trámite y por
// tramitador; los finalizados sin calificar se pueden calificar desde aquí
export default async function CalificacionesPage(props: { searchParams: Promise<Parametros> }) {
  const p = await props.searchParams
  const vista = p.vista === "tramitadores" ? "tramitadores" : "tramites"
  // Un mes a la vez (por fecha de finalizado; por defecto el mes en curso) para que la tabla no sea
  // tan larga; "todos" quita el filtro
  const mesActual = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" }).slice(0, 7)
  const mes = p.mes === "todos" ? "todos" : /^\d{4}-\d{2}$/.test(p.mes ?? "") ? p.mes! : mesActual
  const { desde, hasta } = mes === "todos" ? { desde: "", hasta: "" } : rangoDelMes(mes)
  const estado = ["calificados", "sinCalificar"].includes(p.estado ?? "") ? p.estado! : "todas"
  const encabezados = await encabezadosSesion()

  const leer = async <T,>(ruta: string): Promise<T | null> => {
    try {
      const req = await fetch(`${process.env.API_URL}${ruta}`, { headers: encabezados, cache: "no-store" })
      return req.ok ? await req.json() : null
    } catch {
      return null
    }
  }

  const conFechas = { ...(desde && { desde }), ...(hasta && { hasta }) }
  const consulta = new URLSearchParams({ ...conFechas, estado })
  if (p.tramitadorId) consulta.set("tramitadorId", p.tramitadorId)
  if (p.q) consulta.set("q", p.q)
  if (p.pagina) consulta.set("pagina", p.pagina)

  const [porTramite, porTramitador, tramitadores, meses] = await Promise.all([
    leer<CalificacionesPorTramite>(`/calificaciones/tramites?${consulta}`),
    vista === "tramitadores" ? leer<CalificacionesPorTramitador>(`/calificaciones/tramitadores?${new URLSearchParams(conFechas)}`) : null,
    leer<{ id: number, nombreTramitador: string }[]>("/tramitador/tramitadores"),
    leer<{ mes: string, finalizados: number, sinCalificar: number }[]>("/calificaciones/meses")
  ])
  // El mes en curso siempre se puede elegir, aunque todavía no tenga finalizados
  const opcionesMes = [...(meses ?? [])]
  if (!opcionesMes.some(m => m.mes === mesActual)) opcionesMes.unshift({ mes: mesActual, finalizados: 0, sinCalificar: 0 })
  const resumen = porTramite?.resumen

  const enlaceVista = (v: string) => `/center/calificaciones?${new URLSearchParams({ vista: v, mes })}`

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-slate-800">Calificaciones</h1>

      <nav className="flex border-b border-slate-200" aria-label="Vista">
        {[{ v: "tramites", nombre: "Por trámite" }, { v: "tramitadores", nombre: "Por tramitador" }].map(o => (
          <Link key={o.v} href={enlaceVista(o.v)} aria-current={vista === o.v ? "page" : undefined}
            className={clsx("-mb-px flex min-h-[3rem] flex-1 items-center justify-center border-b-2 px-2 py-2 text-xs font-semibold transition sm:flex-none sm:px-6",
              vista === o.v ? "border-sky-600 bg-sky-50/60 text-sky-700" : "border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700")}>
            {o.nombre}
          </Link>
        ))}
      </nav>

      {/* Filtros (GET): mes de finalizado; en "Por trámite" también tramitador, estado y búsqueda */}
      <form className="flex flex-wrap items-end gap-3" action="/center/calificaciones">
        <input type="hidden" name="vista" value={vista} />
        <label className="block min-w-[13rem]">
          <span className="mb-1.5 block text-xs font-medium text-slate-600">Mes de finalizado</span>
          <SelectBuscable name="mes" defaultValue={mes} className={claseInput}>
            {opcionesMes.map(m => (
              <option key={m.mes} value={m.mes}>
                {nombreMes(m.mes)} · {m.finalizados}{m.sinCalificar ? ` (${m.sinCalificar} sin calificar)` : ""}
              </option>
            ))}
            <option value="todos">Todos los meses</option>
          </SelectBuscable>
        </label>
        {vista === "tramites" && (
          <>
            <label className="block min-w-[14rem]">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Tramitador</span>
              <SelectBuscable name="tramitadorId" defaultValue={p.tramitadorId ?? ""} className={claseInput}>
                <option value="">Todos</option>
                <option value="0">Sin tramitador</option>
                {(tramitadores ?? []).map(t => <option key={t.id} value={t.id}>{t.nombreTramitador.trim()}</option>)}
              </SelectBuscable>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Calificación</span>
              <select name="estado" defaultValue={estado} className={claseInput}>
                <option value="todas">Todas</option>
                <option value="calificados">Calificados</option>
                <option value="sinCalificar">Sin calificar</option>
              </select>
            </label>
            <label className="block min-w-[12rem] flex-1">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Buscar</span>
              <input name="q" defaultValue={p.q ?? ""} placeholder="N° de trámite, placa, matrícula o quién lo creó" className={claseInput} />
            </label>
          </>
        )}
        <button type="submit" className={claseBotonSecundario}><Search size={15} /> Consultar</button>
      </form>

      {resumen && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Indicador etiqueta="Finalizados" valor={String(resumen.finalizados)} />
          <Indicador etiqueta="Calificados" valor={String(resumen.calificados)}
            detalle={resumen.finalizados ? `${Math.round((resumen.calificados / resumen.finalizados) * 100)} %` : undefined} />
          <Indicador etiqueta="Sin calificar" valor={String(resumen.sinCalificar)} resaltar={resumen.sinCalificar > 0} />
          <Indicador etiqueta="Promedio" valor={resumen.promedio === null ? "—" : `${numero(resumen.promedio)} / 4`}
            detalle={resumen.promedio === null ? undefined : nivel(resumen.promedio).nombre} />
          <Indicador etiqueta="Calificaciones bajas" valor={String(resumen.bajas)} resaltar={resumen.bajas > 0} />
        </div>
      )}

      {vista === "tramites"
        ? porTramite
          ? <TablaCalificacionesTramites datos={porTramite} pagina={Number(p.pagina) || 1} parametros={consulta.toString()} />
          : <Error />
        : porTramitador
          ? <TablaCalificacionesTramitadores datos={porTramitador} mes={mes} />
          : <Error />}
    </div>
  )
}

const Error = () => <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">No se pudieron cargar las calificaciones.</p>

function Indicador({ etiqueta, valor, detalle, resaltar }: { etiqueta: string, valor: string, detalle?: string, resaltar?: boolean }) {
  return (
    <div className={clsx("rounded-xl border bg-white px-4 py-4 shadow-sm", resaltar ? "border-amber-200" : "border-slate-200")}>
      <p className="text-xs font-medium text-slate-500">{etiqueta}</p>
      <p className={clsx("mt-1 text-xl font-semibold tabular-nums", resaltar ? "text-amber-700" : "text-slate-900")}>{valor}</p>
      {detalle && <p className="mt-1 text-[11px] text-slate-400">{detalle}</p>}
    </div>
  )
}
