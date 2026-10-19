"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "react-toastify"
import clsx from "clsx"
import { Check, ChevronDown, ChevronRight, ListTree, Loader2, Pencil, Plus, Search, Trash2, X } from "lucide-react"
import { llamarApi } from "@/src/lib/apiCliente"
import { claseBotonPrimario, claseBotonSecundario, claseInput } from "@/components/ui/estilos"

type TipoCatalogo = "tramites" | "operaciones" | "subestados" | "rechazos" | "areas"

type TipoTramite = { id: number, nombre: string, responsable: string | null, uso: number }
type SubEstado = { id: number, nombre: string, tramiteId: number, uso: number }
type Operacion = { id: number, nombre: string, centroDeCostos: string | null, usoTramites: number, usoGastos: number }
type Rechazo = { id: number, nombre: string, uso: number }
type Area = { id: number, nombre: string, uso: number }
type Catalogos = { tramites: TipoTramite[], subestados: SubEstado[], operaciones: Operacion[], rechazos: Rechazo[], areas: Area[] }

// Campos de cada catálogo (el backend recibe `nombre` y los extras con estas claves)
type Campo = { clave: string, etiqueta: string, maximo: number, obligatorio?: boolean, ancho?: string }

const CAMPOS: Record<TipoCatalogo, Campo[]> = {
  tramites: [
    { clave: "nombre", etiqueta: "Nombre del tipo de trámite", maximo: 150, obligatorio: true },
    { clave: "responsable", etiqueta: "Responsable (opcional)", maximo: 150, ancho: "sm:w-56" }
  ],
  operaciones: [
    { clave: "nombre", etiqueta: "Nombre de la operación", maximo: 100, obligatorio: true },
    { clave: "centroDeCostos", etiqueta: "Centro de costos", maximo: 10, ancho: "sm:w-40" }
  ],
  subestados: [{ clave: "nombre", etiqueta: "Nombre del subestado", maximo: 200, obligatorio: true }],
  rechazos: [{ clave: "nombre", etiqueta: "Nombre del tipo de rechazo", maximo: 200, obligatorio: true }],
  areas: [{ clave: "nombre", etiqueta: "Nombre del área", maximo: 100, obligatorio: true }]
}

const sinTildes = (texto: string) => texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
const usoTexto = (n: number, uno: string, varios: string) => (n === 0 ? "Sin uso" : `${n.toLocaleString("es-CO")} ${n === 1 ? uno : varios}`)

// ── Formulario en línea para crear o editar ──
function FormularioCatalogo({ tipo, inicial, onGuardar, onCancelar }: {
  tipo: TipoCatalogo
  inicial?: Record<string, string>
  onGuardar: (datos: Record<string, string>) => Promise<boolean>
  onCancelar: () => void
}) {
  const [guardando, setGuardando] = useState(false)

  const enviar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const datos = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    setGuardando(true)
    const ok = await onGuardar(datos)
    setGuardando(false)
    if (ok) onCancelar()
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      {CAMPOS[tipo].map((campo, i) => (
        <input
          key={campo.clave}
          name={campo.clave}
          defaultValue={inicial?.[campo.clave] ?? ""}
          placeholder={campo.etiqueta}
          aria-label={campo.etiqueta}
          maxLength={campo.maximo}
          required={campo.obligatorio}
          autoFocus={i === 0}
          className={clsx(claseInput, "h-9", campo.ancho ?? "sm:flex-1")}
        />
      ))}
      <div className="flex gap-2">
        <button type="submit" disabled={guardando} className={`${claseBotonPrimario} h-9`}>
          {guardando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Guardar
        </button>
        <button type="button" onClick={onCancelar} disabled={guardando} className={`${claseBotonSecundario} h-9 px-3`} aria-label="Cancelar">
          <X size={14} />
        </button>
      </div>
    </form>
  )
}

// ── Botones de cada fila: editar y eliminar (eliminar solo si no se usa) ──
function AccionesFila({ enUso, motivo, onEditar, onEliminar }: {
  enUso: boolean
  motivo: string
  onEditar: () => void
  onEliminar: () => void
}) {
  return (
    <div className="flex justify-end gap-1">
      <button type="button" onClick={onEditar} className="rounded-md p-1.5 text-slate-400 transition hover:bg-sky-50 hover:text-sky-600" aria-label="Editar" title="Editar">
        <Pencil size={14} />
      </button>
      <button
        type="button"
        onClick={onEliminar}
        disabled={enUso}
        className="rounded-md p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
        aria-label="Eliminar"
        title={enUso ? `No se puede eliminar: ${motivo}` : "Eliminar"}
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

export type PestanaCatalogo = "tramites" | "operaciones" | "rechazos" | "areas"

// Administración de catálogos de Nodex Trámites: tipos de trámite (con sus subestados),
// operaciones, tipos de rechazo y áreas de los usuarios. Lo que está en uso se puede editar pero no eliminar.
// La pestaña la elige la página (/center/catalogos?pestana=...).
export default function AdministrarCatalogos({ pestana }: { pestana: PestanaCatalogo }) {
  const [datos, setDatos] = useState<Catalogos | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filtro, setFiltro] = useState("")
  const [creando, setCreando] = useState(false)
  const [editando, setEditando] = useState<string | null>(null) // "tipo:id"
  const [abiertos, setAbiertos] = useState<Set<number>>(new Set()) // tipos de trámite con subestados visibles
  const [creandoSub, setCreandoSub] = useState<number | null>(null) // tramiteId

  const cargar = useCallback(async () => {
    const r = await llamarApi<Catalogos>("/catalogos-tramites")
    if (r.ok) {
      setDatos(r.datos)
      setError(null)
    } else setError(r.error)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const guardar = async (tipo: TipoCatalogo, valores: Record<string, string>, id?: number) => {
    const r = await llamarApi(id ? `/catalogos-tramites/${tipo}/${id}` : `/catalogos-tramites/${tipo}`, id ? "PUT" : "POST", valores)
    if (!r.ok) {
      toast.error(r.error)
      return false
    }
    toast.success(id ? "Cambios guardados" : "Registro creado")
    await cargar()
    return true
  }

  const eliminar = async (tipo: TipoCatalogo, id: number, nombre: string) => {
    if (!confirm(`¿Eliminar "${nombre}"?`)) return
    const r = await llamarApi(`/catalogos-tramites/${tipo}/${id}`, "DELETE")
    if (!r.ok) return toast.error(r.error)
    toast.success("Registro eliminado")
    await cargar()
  }

  const coincide = useCallback((texto: string | null | undefined) => sinTildes(texto ?? "").includes(sinTildes(filtro.trim())), [filtro])

  const subestadosPorTramite = useMemo(() => {
    const mapa = new Map<number, SubEstado[]>()
    for (const s of datos?.subestados ?? []) mapa.set(s.tramiteId, [...(mapa.get(s.tramiteId) ?? []), s])
    return mapa
  }, [datos])

  // Un tipo de trámite aparece si coincide él o alguno de sus subestados
  const tramites = (datos?.tramites ?? []).filter(t =>
    coincide(t.nombre) || coincide(t.responsable) || (subestadosPorTramite.get(t.id) ?? []).some(s => coincide(s.nombre)))
  const operaciones = (datos?.operaciones ?? []).filter(o => coincide(o.nombre) || coincide(o.centroDeCostos))
  const rechazos = (datos?.rechazos ?? []).filter(r => coincide(r.nombre))
  const areas = (datos?.areas ?? []).filter(a => coincide(a.nombre))

  const alternar = (id: number) => setAbiertos(actual => {
    const nuevo = new Set(actual)
    if (nuevo.has(id)) nuevo.delete(id)
    else nuevo.add(id)
    return nuevo
  })

  if (error) {
    return <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">No se pudieron cargar los catálogos: {error}</p>
  }

  const textoNuevo = { tramites: "Nuevo tipo de trámite", operaciones: "Nueva operación", rechazos: "Nuevo tipo de rechazo", areas: "Nueva área" }[pestana]

  return (
    <div className="space-y-4">

      {/* BUSCAR + NUEVO */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
          <input value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="Buscar..." aria-label="Buscar" className={`${claseInput} h-9 pl-9`} />
        </div>
        {!creando && (
          <button type="button" onClick={() => { setCreando(true); setEditando(null) }} className={`${claseBotonPrimario} h-9`}>
            <Plus size={15} /> {textoNuevo}
          </button>
        )}
      </div>

      {creando && (
        <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-3">
          <p className="mb-2 text-xs font-semibold text-sky-800">{textoNuevo}</p>
          <FormularioCatalogo tipo={pestana} onGuardar={v => guardar(pestana, v)} onCancelar={() => setCreando(false)} />
        </div>
      )}

      {/* LISTADO */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {!datos ? (
          <div className="flex items-center justify-center gap-2 py-14 text-xs text-slate-400">
            <Loader2 size={15} className="animate-spin" /> Cargando catálogos...
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Nombre</th>
                {pestana === "tramites" && <th className="hidden px-4 py-3 font-semibold md:table-cell">Responsable</th>}
                {pestana === "operaciones" && <th className="hidden px-4 py-3 font-semibold md:table-cell">Centro de costos</th>}
                <th className="hidden px-4 py-3 font-semibold sm:table-cell">Uso</th>
                <th className="w-24 px-4 py-3"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">

              {/* TIPOS DE TRÁMITE (cada uno despliega sus subestados) */}
              {pestana === "tramites" && tramites.map(t => {
                const subestados = subestadosPorTramite.get(t.id) ?? []
                const abierto = abiertos.has(t.id) || (Boolean(filtro.trim()) && subestados.some(s => coincide(s.nombre)))
                const motivo = [t.uso && usoTexto(t.uso, "trámite", "trámites"), subestados.length && "tiene subestados"].filter(Boolean).join(" y ")
                return [
                  <tr key={t.id} className="align-middle hover:bg-slate-50/70">
                    {editando === `tramites:${t.id}` ? (
                      <td colSpan={4} className="px-4 py-2.5">
                        <FormularioCatalogo tipo="tramites" inicial={{ nombre: t.nombre, responsable: t.responsable ?? "" }}
                          onGuardar={v => guardar("tramites", v, t.id)} onCancelar={() => setEditando(null)} />
                      </td>
                    ) : (
                      <>
                        <td className="px-4 py-2.5">
                          <button type="button" onClick={() => alternar(t.id)} className="flex items-center gap-1.5 text-left font-medium text-slate-700 hover:text-sky-700">
                            {abierto ? <ChevronDown size={14} className="shrink-0 text-slate-400" /> : <ChevronRight size={14} className="shrink-0 text-slate-400" />}
                            {t.nombre}
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-1.5 py-px text-[10px] font-normal text-slate-500">
                              <ListTree size={10} /> {subestados.length} subestado(s)
                            </span>
                          </button>
                        </td>
                        <td className="hidden px-4 py-2.5 text-slate-500 md:table-cell">{t.responsable || "—"}</td>
                        <td className="hidden px-4 py-2.5 text-slate-500 sm:table-cell">{usoTexto(t.uso, "trámite", "trámites")}</td>
                        <td className="px-4 py-2.5">
                          <AccionesFila enUso={Boolean(motivo)} motivo={motivo}
                            onEditar={() => { setEditando(`tramites:${t.id}`); setCreando(false) }}
                            onEliminar={() => eliminar("tramites", t.id, t.nombre)} />
                        </td>
                      </>
                    )}
                  </tr>,

                  abierto && (
                    <tr key={`sub-${t.id}`} className="bg-slate-50/60">
                      <td colSpan={4} className="px-4 pb-3 pt-1">
                        <div className="ml-5 rounded-lg border border-slate-200 bg-white">
                          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Subestados de {t.nombre}</p>
                            {creandoSub !== t.id && (
                              <button type="button" onClick={() => setCreandoSub(t.id)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 hover:underline">
                                <Plus size={12} /> Agregar subestado
                              </button>
                            )}
                          </div>
                          {creandoSub === t.id && (
                            <div className="border-b border-slate-100 p-2">
                              <FormularioCatalogo tipo="subestados" onGuardar={v => guardar("subestados", { ...v, tramiteId: String(t.id) })} onCancelar={() => setCreandoSub(null)} />
                            </div>
                          )}
                          {subestados.length === 0 && creandoSub !== t.id && (
                            <p className="px-3 py-3 text-[11px] text-slate-400">Este tipo de trámite no tiene subestados.</p>
                          )}
                          <ul className="divide-y divide-slate-100">
                            {subestados.map(s => (
                              <li key={s.id} className="flex items-center gap-3 px-3 py-1.5">
                                {editando === `subestados:${s.id}` ? (
                                  <div className="flex-1">
                                    <FormularioCatalogo tipo="subestados" inicial={{ nombre: s.nombre }}
                                      onGuardar={v => guardar("subestados", v, s.id)} onCancelar={() => setEditando(null)} />
                                  </div>
                                ) : (
                                  <>
                                    <span className={clsx("flex-1 text-slate-700", filtro.trim() && coincide(s.nombre) && "font-semibold")}>{s.nombre}</span>
                                    <span className="hidden text-[11px] text-slate-400 sm:inline">{usoTexto(s.uso, "registro", "registros")}</span>
                                    <AccionesFila enUso={s.uso > 0} motivo={usoTexto(s.uso, "registro de trámite", "registros de trámites")}
                                      onEditar={() => setEditando(`subestados:${s.id}`)}
                                      onEliminar={() => eliminar("subestados", s.id, s.nombre)} />
                                  </>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </td>
                    </tr>
                  )
                ]
              })}

              {/* OPERACIONES */}
              {pestana === "operaciones" && operaciones.map(o => {
                const motivo = [o.usoTramites && usoTexto(o.usoTramites, "trámite", "trámites"), o.usoGastos && usoTexto(o.usoGastos, "gasto", "gastos")].filter(Boolean).join(" y ")
                return (
                  <tr key={o.id} className="hover:bg-slate-50/70">
                    {editando === `operaciones:${o.id}` ? (
                      <td colSpan={4} className="px-4 py-2.5">
                        <FormularioCatalogo tipo="operaciones" inicial={{ nombre: o.nombre, centroDeCostos: o.centroDeCostos ?? "" }}
                          onGuardar={v => guardar("operaciones", v, o.id)} onCancelar={() => setEditando(null)} />
                      </td>
                    ) : (
                      <>
                        <td className="px-4 py-2.5 font-medium text-slate-700">{o.nombre}</td>
                        <td className="hidden px-4 py-2.5 font-mono text-[11px] text-slate-500 md:table-cell">{o.centroDeCostos || "—"}</td>
                        <td className="hidden px-4 py-2.5 text-slate-500 sm:table-cell">{motivo || "Sin uso"}</td>
                        <td className="px-4 py-2.5">
                          <AccionesFila enUso={Boolean(motivo)} motivo={motivo}
                            onEditar={() => { setEditando(`operaciones:${o.id}`); setCreando(false) }}
                            onEliminar={() => eliminar("operaciones", o.id, o.nombre)} />
                        </td>
                      </>
                    )}
                  </tr>
                )
              })}

              {/* TIPOS DE RECHAZO */}
              {pestana === "rechazos" && rechazos.map(r => (
                <tr key={r.id} className="hover:bg-slate-50/70">
                  {editando === `rechazos:${r.id}` ? (
                    <td colSpan={3} className="px-4 py-2.5">
                      <FormularioCatalogo tipo="rechazos" inicial={{ nombre: r.nombre }}
                        onGuardar={v => guardar("rechazos", v, r.id)} onCancelar={() => setEditando(null)} />
                    </td>
                  ) : (
                    <>
                      <td className="px-4 py-2.5 font-medium text-slate-700">{r.nombre}</td>
                      <td className="hidden px-4 py-2.5 text-slate-500 sm:table-cell">{usoTexto(r.uso, "cambio de estado", "cambios de estado")}</td>
                      <td className="px-4 py-2.5">
                        <AccionesFila enUso={r.uso > 0} motivo={usoTexto(r.uso, "cambio de estado", "cambios de estado")}
                          onEditar={() => { setEditando(`rechazos:${r.id}`); setCreando(false) }}
                          onEliminar={() => eliminar("rechazos", r.id, r.nombre)} />
                      </td>
                    </>
                  )}
                </tr>
              ))}

              {/* ÁREAS DE LOS USUARIOS */}
              {pestana === "areas" && areas.map(a => (
                <tr key={a.id} className="hover:bg-slate-50/70">
                  {editando === `areas:${a.id}` ? (
                    <td colSpan={3} className="px-4 py-2.5">
                      <FormularioCatalogo tipo="areas" inicial={{ nombre: a.nombre }}
                        onGuardar={v => guardar("areas", v, a.id)} onCancelar={() => setEditando(null)} />
                    </td>
                  ) : (
                    <>
                      <td className="px-4 py-2.5 font-medium text-slate-700">{a.nombre}</td>
                      <td className="hidden px-4 py-2.5 text-slate-500 sm:table-cell">{usoTexto(a.uso, "usuario", "usuarios")}</td>
                      <td className="px-4 py-2.5">
                        <AccionesFila enUso={a.uso > 0} motivo={`${usoTexto(a.uso, "usuario", "usuarios")} (cámbieles el área primero)`}
                          onEditar={() => { setEditando(`areas:${a.id}`); setCreando(false) }}
                          onEliminar={() => eliminar("areas", a.id, a.nombre)} />
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {datos && { tramites, operaciones, rechazos, areas }[pestana].length === 0 && (
          <p className="py-12 text-center text-sm text-slate-400">
            {filtro.trim() ? "Nada coincide con la búsqueda." : "No hay registros todavía."}
          </p>
        )}
      </div>

      <p className="text-[11px] text-slate-400">
        Lo que está en uso se puede renombrar, pero no eliminar (el cambio de nombre se ve en todos los trámites que lo usan).
      </p>
    </div>
  )
}
