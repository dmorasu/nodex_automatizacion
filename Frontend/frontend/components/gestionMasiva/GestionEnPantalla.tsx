"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "react-toastify"
import clsx from "clsx"
import { AlertTriangle, CheckCircle2, CircleAlert, ListPlus, Loader2, Save, Trash2, Wand2, X } from "lucide-react"
import {
  ACCIONES,
  valoresActuales,
  type Campo,
  type Catalogo,
  type TipoAccion,
  type TramiteMasivo
} from "./camposAcciones"

const API = "/api/backend" // proxy del frontend: agrega el token de sesión

type Opcion = { id: number, nombre: string }
type Resultado = { estado: "ok" | "error", mensaje: string }

const claseCelda = "h-8 w-full min-w-[120px] rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-50"
const claseBotonSecundario = "inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"

// Catálogos para las listas desplegables (se cargan una vez)
const useCatalogos = () => {
  const [catalogos, setCatalogos] = useState<Record<Catalogo, Opcion[]>>({ estados: [], tiposRechazo: [], tramitadores: [], transportadoras: [] })

  useEffect(() => {
    const leer = async (ruta: string, nombre: (x: any) => string): Promise<Opcion[]> => {
      try {
        const res = await fetch(`${API}${ruta}`)
        const datos = res.ok ? await res.json() : []
        return Array.isArray(datos) ? datos.map(x => ({ id: x.id, nombre: nombre(x) })) : []
      } catch {
        return []
      }
    }
    Promise.all([
      leer("/estados", x => x.nombreEstado),
      leer("/tiposRechazo", x => x.nombre ?? x.nombreTipoRechazo ?? `Tipo ${x.id}`),
      leer("/tramitador/tramitadores", x => x.nombreTramitador?.trim()),
      leer("/transportadora", x => x.nombreTransportadora)
    ]).then(([estados, tiposRechazo, tramitadores, transportadoras]) =>
      setCatalogos({ estados, tiposRechazo, tramitadores, transportadoras }))
  }, [])

  return catalogos
}

// Una celda editable según el tipo de campo
function Celda({ campo, valor, opciones, onChange, disabled }: {
  campo: Campo
  valor: string
  opciones: Opcion[]
  onChange: (valor: string) => void
  disabled?: boolean
}) {
  if (campo.tipo === "seleccion") {
    return (
      <select value={valor} onChange={e => onChange(e.target.value)} disabled={disabled} className={claseCelda} aria-label={campo.etiqueta}>
        <option value="">{campo.obligatorio ? "Seleccione…" : "—"}</option>
        {opciones.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
      </select>
    )
  }
  if (campo.tipo === "textoLargo") {
    return (
      <textarea value={valor} onChange={e => onChange(e.target.value)} disabled={disabled} rows={2} maxLength={2000}
        className={`${claseCelda} h-auto min-w-[220px] py-1.5`} aria-label={campo.etiqueta} />
    )
  }
  return (
    <input
      type={campo.tipo === "numero" ? "number" : campo.tipo === "fecha" ? "date" : "text"}
      min={campo.tipo === "numero" ? 0 : undefined}
      value={valor}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className={claseCelda}
      aria-label={campo.etiqueta}
    />
  )
}

// Gestión masiva sin Excel: se eligen los trámites, la acción y los valores (iguales para
// todos o fila por fila) y se guarda con el mismo proceso del cargue por Excel.
export default function GestionEnPantalla() {
  const catalogos = useCatalogos()

  const [numeros, setNumeros] = useState("")
  const [cargando, setCargando] = useState(false)
  const [tramites, setTramites] = useState<TramiteMasivo[]>([])

  const [tipo, setTipo] = useState<TipoAccion>("estados")
  const accion = ACCIONES.find(a => a.tipo === tipo)!

  // Valores por trámite y valores de "aplicar a todos"
  const [valores, setValores] = useState<Record<number, Record<string, string>>>({})
  const [paraTodos, setParaTodos] = useState<Record<string, string>>({})
  const [resultados, setResultados] = useState<Record<number, Resultado>>({})
  const [guardando, setGuardando] = useState(false)

  // Al cambiar de acción o de trámites, cada fila arranca con sus valores actuales
  useEffect(() => {
    setValores(Object.fromEntries(tramites.map(t => [t.id, valoresActuales(tipo, t)])))
    setParaTodos({})
  }, [tipo, tramites])

  useEffect(() => setResultados({}), [tipo])

  const opcionesDe = (campo: Campo) => (campo.catalogo ? catalogos[campo.catalogo] : [])

  // ── Trámites ─────────────────────────────

  // Consulta los trámites con sus valores actuales
  const consultar = async (ids: number[]) => {
    const res = await fetch(`${API}/bulk/tramites?ids=${ids.join(",")}`)
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? "No se pudieron consultar los trámites")
    return json as { tramites: TramiteMasivo[], noEncontrados: number[] }
  }

  const cargarTramites = async (agregar: boolean) => {
    const ids = numeros.split(/[\s,;]+/).map(Number).filter(n => Number.isInteger(n) && n > 0)
    if (ids.length === 0) return toast.error("Escriba o pegue los números de trámite")

    const todos = agregar ? [...new Set([...tramites.map(t => t.id), ...ids])] : [...new Set(ids)]
    if (todos.length > 500) return toast.error("Máximo 500 trámites a la vez")

    setCargando(true)
    try {
      const json = await consultar(todos)
      setTramites(json.tramites)
      setResultados({})
      setNumeros("")
      if (json.noEncontrados.length) toast.warning(`No existen: ${json.noEncontrados.join(", ")}`, { autoClose: 8000 })
      else toast.success(`${json.tramites.length} trámite(s) cargado(s)`)
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setCargando(false)
    }
  }

  const quitar = (id: number) => setTramites(actuales => actuales.filter(t => t.id !== id))

  // ── Edición ──────────────────────────────

  const cambiar = (id: number, clave: string, valor: string) =>
    setValores(actuales => ({ ...actuales, [id]: { ...actuales[id], [clave]: valor } }))

  const aplicarATodos = () => {
    const llenos = Object.entries(paraTodos).filter(([, v]) => v !== "")
    if (llenos.length === 0) return toast.error("Escriba al menos un valor para aplicar")
    setValores(actuales => Object.fromEntries(
      Object.entries(actuales).map(([id, fila]) => [id, { ...fila, ...Object.fromEntries(llenos) }])
    ))
    toast.info(`Aplicado a ${tramites.length} trámite(s)`)
  }

  // ── Guardar ──────────────────────────────

  // Filas con las mismas columnas de la plantilla de Excel (sin los campos auxiliares)
  const filasPara = (ids: number[]) => ids.map(id => ({
    solicitudTramiteId: id,
    ...Object.fromEntries(accion.campos.filter(c => !c.auxiliar).map(c => [c.clave, valores[id]?.[c.clave] ?? ""]))
  }))

  // Errores del backend: "fila" es la del Excel (encabezado = 1), aquí es la posición + 2
  const marcarErrores = (ids: number[], errores: { fila: number, error: string, columna?: string }[]) => {
    const nuevos: Record<number, Resultado> = {}
    for (const e of errores) {
      const id = ids[e.fila - 2]
      if (id) nuevos[id] = { estado: "error", mensaje: nuevos[id] ? `${nuevos[id].mensaje} · ${e.error}` : e.error }
      else toast.error(e.error)
    }
    return nuevos
  }

  const enviar = async (tipoEnvio: TipoAccion, filas: object[]) => {
    const res = await fetch(`${API}/bulk/${tipoEnvio}/procesar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filas })
    })
    const json = await res.json().catch(() => ({}))
    return { ok: res.ok, errores: (json.errores ?? []) as { fila: number, error: string }[], mensaje: json.error as string | undefined }
  }

  const guardar = async () => {
    const ids = tramites.map(t => t.id)
    if (ids.length === 0) return toast.error("Cargue los trámites")

    // Obligatorios
    const faltantes = accion.campos.filter(c => c.obligatorio)
      .flatMap(c => ids.filter(id => !valores[id]?.[c.clave]).map(id => ({ id, campo: c.etiqueta })))
    if (faltantes.length > 0) {
      setResultados(Object.fromEntries(faltantes.map(f => [f.id, { estado: "error", mensaje: `Falta: ${f.campo}` }])))
      return toast.error(`Hay ${new Set(faltantes.map(f => f.id)).size} trámite(s) con campos obligatorios vacíos`)
    }

    const resumen = tipo === "estados"
      ? `Cambiar el estado de ${ids.length} trámite(s)`
      : `${accion.nombre}: ${ids.length} trámite(s)`
    if (!confirm(`${resumen}.${accion.aviso ? `\n\n${accion.aviso}` : ""}\n\n¿Continuar?`)) return

    setGuardando(true)
    setResultados({})
    try {
      // Estado con observación: primero la trazabilidad (la notificación de novedad usa la última)
      if (tipo === "estados") {
        const conObservacion = ids.filter(id => valores[id]?.observacion?.trim())
        if (conObservacion.length > 0) {
          const traza = await enviar("trazabilidad", conObservacion.map(id => ({
            solicitudTramiteId: id,
            observacionTrazabilidad: valores[id].observacion.trim(),
            nombreUsuario: ""
          })))
          if (!traza.ok || traza.errores.length > 0) {
            setResultados(marcarErrores(conObservacion, traza.errores))
            return toast.error(traza.mensaje ?? "No se pudo guardar la trazabilidad; no se cambió ningún estado")
          }
        }
      }

      const respuesta = await enviar(tipo, filasPara(ids))
      const errores = marcarErrores(ids, respuesta.errores)
      if (!respuesta.ok && respuesta.errores.length === 0) {
        return toast.error(respuesta.mensaje ?? "No se pudo procesar")
      }

      // Si la validación falla no se guarda nada; si falla el proceso, solo esas filas
      const guardados = respuesta.ok ? ids.filter(id => !errores[id]) : []
      setResultados({
        ...Object.fromEntries(guardados.map(id => [id, { estado: "ok", mensaje: "Guardado" } as Resultado])),
        ...errores
      })

      if (guardados.length > 0) {
        toast.success(`${guardados.length} trámite(s) actualizado(s)`)
        // Refresca la columna "Actual" y los valores con lo que quedó guardado
        consultar(ids).then(json => setTramites(json.tramites)).catch(() => undefined)
      }
      if (Object.keys(errores).length > 0) {
        toast.error(respuesta.ok
          ? `${Object.keys(errores).length} trámite(s) con error`
          : "Hay errores: no se guardó ningún cambio. Corríjalos y vuelva a guardar")
      }
    } catch {
      toast.error("No se pudo completar la operación")
    } finally {
      setGuardando(false)
    }
  }

  const conError = useMemo(() => Object.values(resultados).filter(r => r.estado === "error").length, [resultados])

  // ── Vista ────────────────────────────────

  return (
    <div className="space-y-6">

      {/* 1. TRÁMITES */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">1. Trámites</h2>
        <p className="mt-0.5 text-xs text-slate-400">Escriba o pegue los números (separados por coma, espacio o salto de línea). Máximo 500.</p>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <textarea
            value={numeros}
            onChange={e => setNumeros(e.target.value)}
            rows={2}
            placeholder="Ej: 3758, 3760, 3801"
            className="w-full flex-1 rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            aria-label="Números de trámite"
          />
          <div className="flex gap-2 sm:flex-col">
            <button type="button" onClick={() => cargarTramites(false)} disabled={cargando || guardando}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-sky-500 px-4 text-xs font-semibold text-white hover:bg-sky-600 disabled:opacity-50">
              {cargando ? <Loader2 size={15} className="animate-spin" /> : <ListPlus size={15} />}
              Cargar
            </button>
            {tramites.length > 0 && (
              <button type="button" onClick={() => cargarTramites(true)} disabled={cargando || guardando} className={claseBotonSecundario}>
                Agregar a la lista
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 2. ACCIÓN */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">2. ¿Qué quiere hacer?</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {ACCIONES.map(a => (
            <button
              key={a.tipo}
              type="button"
              onClick={() => setTipo(a.tipo)}
              disabled={guardando}
              className={clsx(
                "h-9 rounded-lg border px-4 text-xs font-semibold transition",
                tipo === a.tipo ? "border-sky-500 bg-sky-500 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              )}
            >
              {a.nombre}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">{accion.descripcion}</p>
        {accion.aviso && (
          <p className="mt-2 flex items-start gap-1.5 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle size={14} className="mt-px shrink-0" />
            {accion.aviso}
          </p>
        )}
      </section>

      {/* 3. VALORES */}
      {tramites.length > 0 && (
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-700">3. Valores ({tramites.length} trámites)</h2>
            {conError > 0 && <span className="text-xs font-semibold text-red-600">{conError} con error</span>}
          </div>

          {/* Aplicar a todos */}
          <div className="rounded-lg border border-sky-100 bg-sky-50/60 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-sky-800">
              <Wand2 size={14} /> Mismo valor para todos (solo se aplican los campos que llene)
            </p>
            <div className="flex flex-wrap items-end gap-3">
              {accion.campos.map(campo => (
                <label key={campo.clave} className="block">
                  <span className="mb-1 block text-[11px] font-medium text-slate-600">{campo.etiqueta}</span>
                  <Celda campo={campo} valor={paraTodos[campo.clave] ?? ""} opciones={opcionesDe(campo)}
                    onChange={v => setParaTodos(a => ({ ...a, [campo.clave]: v }))} disabled={guardando} />
                </label>
              ))}
              <button type="button" onClick={aplicarATodos} disabled={guardando} className={`${claseBotonSecundario} h-8`}>
                Aplicar a todas las filas
              </button>
            </div>
          </div>

          {/* Tabla: una fila por trámite */}
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Trámite</th>
                  <th className="px-3 py-2.5 font-semibold">Actual</th>
                  {accion.campos.map(c => (
                    <th key={c.clave} className="px-3 py-2.5 font-semibold">
                      {c.etiqueta}{c.obligatorio && <span className="text-red-400"> *</span>}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 font-semibold">Resultado</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tramites.map(t => {
                  const resultado = resultados[t.id]
                  return (
                    <tr key={t.id} className={clsx("align-top", resultado?.estado === "error" && "bg-red-50/50", resultado?.estado === "ok" && "bg-emerald-50/50")}>
                      <td className="max-w-[220px] px-3 py-2">
                        <p className="font-semibold text-slate-700">#{t.id} · {t.tramite?.nombreTramite ?? "—"}</p>
                        <p className="truncate text-[11px] text-slate-500">{t.clientes?.nombreCliente ?? "Sin cliente"}</p>
                        <p className="text-[11px] text-slate-400">{t.placa ?? t.matriculaInmobiliaria ?? "—"} · {t.municipios?.nombreMunicipio ?? "—"}</p>
                      </td>
                      <td className="px-3 py-2 text-[11px] text-slate-500">
                        <p><b className="text-slate-600">{t.estadoActual?.nombreEstado ?? "Sin estado"}</b></p>
                        <p>Tramitador: {t.tramitador?.nombreTramitador?.trim() ?? "—"}</p>
                        <p>Analista: {t.nombreAnalista ?? "—"}</p>
                      </td>
                      {accion.campos.map(campo => (
                        <td key={campo.clave} className="px-3 py-2">
                          <Celda campo={campo} valor={valores[t.id]?.[campo.clave] ?? ""} opciones={opcionesDe(campo)}
                            onChange={v => cambiar(t.id, campo.clave, v)} disabled={guardando} />
                        </td>
                      ))}
                      <td className="max-w-[220px] px-3 py-2">
                        {resultado?.estado === "ok" && <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 size={14} /> {resultado.mensaje}</span>}
                        {resultado?.estado === "error" && <span className="inline-flex items-start gap-1 text-red-600"><CircleAlert size={14} className="mt-px shrink-0" /> {resultado.mensaje}</span>}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button type="button" onClick={() => quitar(t.id)} disabled={guardando} className="p-1.5 text-slate-400 hover:text-red-600" aria-label={`Quitar trámite ${t.id}`}>
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button type="button" onClick={() => setTramites([])} disabled={guardando} className={claseBotonSecundario}>
              <X size={15} /> Limpiar lista
            </button>
            <button type="button" onClick={guardar} disabled={guardando}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-sky-500 px-5 text-xs font-semibold text-white hover:bg-sky-600 disabled:opacity-50">
              {guardando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              Guardar cambios
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
