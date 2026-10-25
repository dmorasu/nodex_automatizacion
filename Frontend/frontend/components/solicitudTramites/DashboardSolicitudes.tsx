"use client"

import { FormEvent } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import clsx from "clsx"
import { ChevronLeft, ChevronRight, Filter, Search, X } from "lucide-react"

import { useTramites } from "@/hooks/useTramites"
import { useTramitadores } from "@/hooks/useTramitadores"
import { useOperaciones } from "@/hooks/useOperaciones"
import { useEstados } from "@/hooks/useEstadosSelect"
import { useSolicitudesFiltradas } from "@/hooks/useSolicitudesFiltradas"
import { useAnalistas } from "@/hooks/useAnalistas"
import { usePermisosAnalistas } from "@/src/auth/PerfilContexto"

import SolicitudTramiteMenu from "@/components/solicitudTramites/MenuSolicitudTramites"
import EstadoTramite from "@/components/solicitudTramites/EstadoTramite"
import { claseBotonPrimario, claseBotonSecundario, claseInput } from "@/components/ui/estilos"
import SelectBuscable from "@/components/ui/SelectBuscable"

// Filtros que viajan en la URL: al volver del detalle de un trámite siguen aplicados
const FILTROS = [
  "search", "placa", "estadoId", "tramiteId", "analistaId", "tramitadorId", "operacionesId",
  "fechaFinalizacionDesde", "fechaFinalizacionHasta"
] as const

const TAMANO_PAGINA = 10 // el backend devuelve 10 por página

const claseFiltro = `${claseInput} h-9`
const claseEtiqueta = "block mb-1 text-[11px] font-medium text-slate-500"

// "2026-10-05T14:00:00Z" → "5 oct 2026". `sinZona` para fechas guardadas sin hora (no se corren un día)
const fechaCorta = (iso?: string | null, sinZona?: boolean) => {
  if (!iso) return null
  const fecha = sinZona ? new Date(`${iso.split("T")[0]}T12:00:00`) : new Date(iso)
  if (isNaN(fecha.getTime())) return null
  return fecha.toLocaleDateString("es-CO", {
    ...(sinZona ? {} : { timeZone: "America/Bogota" }),
    day: "numeric", month: "short", year: "numeric"
  }).replace(/\./g, "")
}

// Listado de solicitudes de trámite con filtros (Dashboard de Nodex Trámites)
export default function DashboardPageClient() {
  const router = useRouter()
  const ruta = usePathname()
  const parametros = useSearchParams()

  const filtros = Object.fromEntries(FILTROS.map(f => [f, parametros.get(f) ?? ""])) as Record<typeof FILTROS[number], string>
  const pagina = Math.max(1, Number(parametros.get("page")) || 1)
  const cantidadFiltros = FILTROS.filter(f => filtros[f]).length

  const { data: tramites } = useTramites()
  const { data: tramitadores } = useTramitadores()
  const { data: operaciones } = useOperaciones()
  const { data: estados } = useEstados()
  const { data: analistas } = useAnalistas()
  const { esAnalista, usuarioId } = usePermisosAnalistas()

  // El analista ve solo sus trámites asignados; al buscar por número o identificación el
  // backend le devuelve cualquiera (la regla vive en SolicitudTramitesController)
  const analistaBuscando = esAnalista && Boolean(filtros.search)

  const { data: solicitudes, loading, total, totalPages } =
    useSolicitudesFiltradas({ ...filtros, page: pagina })

  const irA = (valores: Partial<Record<string, string>>) => {
    const query = new URLSearchParams(
      Object.entries(valores).filter(([, v]) => v) as [string, string][]
    ).toString()
    router.push(query ? `${ruta}?${query}` : ruta, { scroll: false })
  }

  // Aplicar filtros: vuelve a la primera página
  const filtrar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const datos = new FormData(e.currentTarget)
    irA(Object.fromEntries(FILTROS.map(f => [f, String(datos.get(f) ?? "").trim()])))
  }

  const irAPagina = (p: number) => irA({ ...filtros, page: p > 1 ? String(p) : "" })

  const desde = total === 0 ? 0 : (pagina - 1) * TAMANO_PAGINA + 1
  const hasta = Math.min(pagina * TAMANO_PAGINA, total)

  return (
    <div className="space-y-5">

      {/* ENCABEZADO */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">
            {esAnalista ? "Mis trámites" : "Trámites"}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {loading && solicitudes.length === 0
              ? "Cargando..."
              : `${total.toLocaleString("es-CO")} ${
                  analistaBuscando ? "resultado(s) de la búsqueda en todos los trámites"
                  : esAnalista ? "trámite(s) asignado(s) a ti"
                  : "trámite(s) encontrado(s)"
                }${cantidadFiltros ? ` con ${cantidadFiltros} filtro(s)` : ""}`}
          </p>
          {esAnalista && (
            <p className="mt-0.5 text-[11px] text-slate-400">
              {analistaBuscando
                ? "La búsqueda incluye trámites de otros analistas. Quítala para ver solo los tuyos."
                : "Solo se listan tus trámites asignados. Busca por número o identificación para encontrar cualquier trámite."}
            </p>
          )}
        </div>
      </div>

      {/* FILTROS (la `key` reinicia los campos al limpiar o al navegar) */}
      <form
        key={parametros.toString()}
        onSubmit={filtrar}
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block sm:col-span-2">
            <span className={claseEtiqueta}>Buscar</span>
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
              <input name="search" defaultValue={filtros.search} placeholder={esAnalista
                ? "N° de trámite o identificación (busca en todos los trámites)"
                : "N° de trámite o identificación del cliente"} className={`${claseFiltro} pl-9`} />
            </div>
          </label>
          <label className="block">
            <span className={claseEtiqueta}>Placa</span>
            <input name="placa" defaultValue={filtros.placa} placeholder="Ej: ABC123" className={`${claseFiltro} uppercase placeholder:normal-case`} />
          </label>
          <label className="block">
            <span className={claseEtiqueta}>Estado</span>
            <SelectBuscable name="estadoId" defaultValue={filtros.estadoId} className={claseFiltro}>
              <option value="">Todos</option>
              {estados.map(e => <option key={e.id} value={e.id}>{e.nombreEstado}</option>)}
            </SelectBuscable>
          </label>

          <label className="block">
            <span className={claseEtiqueta}>Tipo de trámite</span>
            <SelectBuscable name="tramiteId" defaultValue={filtros.tramiteId} className={claseFiltro}>
              <option value="">Todos</option>
              {tramites.map(t => <option key={t.id} value={t.id}>{t.nombreTramite}</option>)}
            </SelectBuscable>
          </label>
          {/* El analista no filtra por analista: el backend le muestra solo los suyos */}
          {!esAnalista && (
            <label className="block">
              <span className={claseEtiqueta}>Analista</span>
              <SelectBuscable name="analistaId" defaultValue={filtros.analistaId} className={claseFiltro}>
                <option value="">Todos</option>
                <option value="sin">Sin analista</option>
                {analistas.map(a => <option key={a.id} value={a.id}>{a.nombreUsuario}</option>)}
              </SelectBuscable>
            </label>
          )}
          <label className="block">
            <span className={claseEtiqueta}>Tramitador</span>
            <SelectBuscable name="tramitadorId" defaultValue={filtros.tramitadorId} className={claseFiltro}>
              <option value="">Todos</option>
              {tramitadores.map(t => <option key={t.id} value={t.id}>{t.nombreTramitador}</option>)}
            </SelectBuscable>
          </label>
          <label className="block">
            <span className={claseEtiqueta}>Operación</span>
            <SelectBuscable name="operacionesId" defaultValue={filtros.operacionesId} className={claseFiltro}>
              <option value="">Todas</option>
              {operaciones.map(o => <option key={o.id} value={o.id}>{o.nombreOperacion}</option>)}
            </SelectBuscable>
          </label>

          <label className="block">
            <span className={claseEtiqueta}>Finalizado desde</span>
            <input type="date" name="fechaFinalizacionDesde" defaultValue={filtros.fechaFinalizacionDesde} className={claseFiltro} />
          </label>
          <label className="block">
            <span className={claseEtiqueta}>Finalizado hasta</span>
            <input type="date" name="fechaFinalizacionHasta" defaultValue={filtros.fechaFinalizacionHasta} className={claseFiltro} />
          </label>
          <div className={clsx("flex items-end gap-2", esAnalista ? "sm:col-span-2 lg:col-span-1" : "sm:col-span-2")}>
            <button type="submit" className={`${claseBotonPrimario} h-9 flex-1`}>
              <Filter size={14} /> Filtrar
            </button>
            {cantidadFiltros > 0 && (
              <button type="button" onClick={() => irA({})} className={`${claseBotonSecundario} h-9`}>
                <X size={14} /> Limpiar
              </button>
            )}
          </div>
        </div>
      </form>

      {/* TABLA */}
      <div className={clsx(
        "overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm transition-opacity",
        loading && solicitudes.length > 0 && "opacity-60"
      )}>
        <table className="w-full min-w-[960px] text-left text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              {/* Opciones (Editar...) al inicio de la fila: en pantallas medianas la tabla se
                  desplaza y al final quedaban escondidas */}
              <th className="w-10 py-3 pl-3 pr-0"><span className="sr-only">Opciones</span></th>
              <th className="px-3 py-3 font-semibold">Trámite</th>
              <th className="px-3 py-3 font-semibold">Estado</th>
              <th className="px-3 py-3 font-semibold">Cliente</th>
              <th className="px-3 py-3 font-semibold">Ubicación</th>
              <th className="px-3 py-3 font-semibold">Responsables</th>
              <th className="px-3 py-3 font-semibold">Fechas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">

            {loading && solicitudes.length === 0 && Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                <td colSpan={7} className="px-3 py-4">
                  <div className="h-10 animate-pulse rounded-md bg-slate-100" />
                </td>
              </tr>
            ))}

            {solicitudes.map(s => {
              const estado: string | undefined = s.estadosTramites?.[0]?.estado?.nombreEstado
              const subestado: string | undefined = s.subEstadosSolicitud?.[0]?.subEstado?.nombre
              const finalizado = fechaCorta(s.programacion?.fechaFinalizacionServicio)
              const entrega = fechaCorta(s.fechaEntregaResultado, true)
              const identificador = s.placa || s.matriculaInmobiliaria

              return (
                <tr key={s.id} className="align-top transition hover:bg-slate-50/70">

                  <td className="py-3 pl-3 pr-0">
                    <SolicitudTramiteMenu solicitudId={s.id} />
                  </td>

                  <td className="px-3 py-3">
                    <Link href={`/center/solicitudTramites/${s.id}`} className="font-semibold text-sky-700 hover:underline">
                      #{s.id}
                    </Link>
                    {esAnalista && s.analistaAsignado !== usuarioId && (
                      <span className="ml-1.5 rounded-full border border-slate-200 bg-slate-50 px-1.5 py-px text-[10px] font-medium text-slate-500">
                        No asignado a ti
                      </span>
                    )}
                    <p className="max-w-[240px] text-[11px] font-medium text-slate-600">{s.tramite?.nombreTramite ?? "—"}</p>
                    {identificador && (
                      <span className="mt-1 inline-block rounded border border-slate-200 bg-slate-50 px-1.5 py-px font-mono text-[10px] uppercase text-slate-600">
                        {identificador}
                      </span>
                    )}
                    {s.detalleSolicitud && (
                      <p className="mt-1 max-w-[240px] truncate text-[11px] text-slate-400" title={s.detalleSolicitud}>
                        {s.detalleSolicitud}
                      </p>
                    )}
                  </td>

                  <td className="px-3 py-3">
                    <EstadoTramite nombre={estado} />
                    {subestado && (
                      <p className="mt-1 max-w-[180px] text-[11px] leading-4 text-slate-500" title="Subestado">{subestado}</p>
                    )}
                  </td>

                  <td className="px-3 py-3">
                    <p className="max-w-[200px] text-slate-700">{s.clientes?.nombreCliente ?? "—"}</p>
                    {s.clientes?.identificacionCliente && (
                      <p className="text-[11px] tabular-nums text-slate-400">{s.clientes.identificacionCliente}</p>
                    )}
                    {s.operaciones?.nombreOperacion && (
                      <p className="text-[11px] text-slate-400">{s.operaciones.nombreOperacion}</p>
                    )}
                  </td>

                  <td className="px-3 py-3">
                    <p className="text-slate-700">{s.municipios?.nombreMunicipio ?? "—"}</p>
                    {s.direccionTramite && (
                      <p className="max-w-[200px] truncate text-[11px] text-slate-400" title={s.direccionTramite}>
                        {s.direccionTramite}
                      </p>
                    )}
                  </td>

                  <td className="px-3 py-3 text-[11px]">
                    <p>
                      <span className="text-slate-400">Analista: </span>
                      {s.nombreAnalista
                        ? <span className="text-slate-700">{s.nombreAnalista}</span>
                        : <span className="font-medium text-amber-600">Sin asignar</span>}
                    </p>
                    <p className="mt-0.5">
                      <span className="text-slate-400">Tramitador: </span>
                      {s.tramitador?.nombreTramitador
                        ? <span className="text-slate-700">{s.tramitador.nombreTramitador}</span>
                        : <span className="font-medium text-amber-600">Sin asignar</span>}
                    </p>
                  </td>

                  <td className="whitespace-nowrap px-3 py-3 text-[11px] text-slate-500">
                    <p>
                      Creado {fechaCorta(s.createdAt) ?? "—"}
                      <span className="text-slate-400"> · {s.usuario?.nombreUsuario ?? "automático"}</span>
                    </p>
                    {entrega && <p>Entrega {entrega}</p>}
                    {finalizado
                      ? <p className="font-medium text-emerald-700">Finalizado {finalizado}</p>
                      : <p className="text-slate-400">Sin finalizar</p>}
                  </td>

                </tr>
              )
            })}
          </tbody>
        </table>

        {!loading && solicitudes.length === 0 && (
          <div className="py-14 text-center">
            <p className="text-sm text-slate-500">Ningún trámite coincide con los filtros.</p>
            {cantidadFiltros > 0 && (
              <button type="button" onClick={() => irA({})} className="mt-2 text-xs font-semibold text-sky-700 hover:underline">
                Limpiar filtros
              </button>
            )}
          </div>
        )}
      </div>

      {/* PAGINACIÓN */}
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <span>
            Mostrando <span className="font-semibold text-slate-700">{desde}–{hasta}</span> de{" "}
            <span className="font-semibold text-slate-700">{total.toLocaleString("es-CO")}</span>
          </span>
          <div className="flex items-center gap-2">
            <span>Página {pagina} de {totalPages}</span>
            <button
              type="button"
              onClick={() => irAPagina(pagina - 1)}
              disabled={pagina <= 1 || loading}
              aria-label="Página anterior"
              className={`${claseBotonSecundario} h-8 px-2`}
            >
              <ChevronLeft size={15} />
            </button>
            <button
              type="button"
              onClick={() => irAPagina(pagina + 1)}
              disabled={pagina >= totalPages || loading}
              aria-label="Página siguiente"
              className={`${claseBotonSecundario} h-8 px-2`}
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
