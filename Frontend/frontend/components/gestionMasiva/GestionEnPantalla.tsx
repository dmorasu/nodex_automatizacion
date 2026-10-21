"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "react-toastify"
import clsx from "clsx"
import { AlertTriangle, Check, CheckCircle2, CircleAlert, Hash, ListPlus, Loader2, Save, Search, Trash2, Wand2, X } from "lucide-react"
import { useOperaciones } from "@/hooks/useOperaciones"
import {
  ACCIONES,
  ORDEN_GUARDADO,
  camposVisibles,
  tieneCambios,
  valoresIniciales,
  type Accion,
  type Campo,
  type Catalogo,
  type TipoAccion,
  type TramiteMasivo
} from "./camposAcciones"
import SelectBuscable from "@/components/ui/SelectBuscable"

const API = "/api/backend" // proxy del frontend: agrega el token de sesión

type Opcion = { id: number, nombre: string }
type Resultado = { estado: "ok" | "error", mensaje: string }

const claseCelda = "h-8 w-full min-w-[120px] rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-50"
const claseBotonSecundario = "inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
const claseFiltro = "h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
const claseEtiqueta = "mb-1 block text-[11px] font-medium text-slate-500"

// Catálogos para las listas desplegables (se cargan una vez)
const useCatalogos = () => {
  const [catalogos, setCatalogos] = useState<Record<Catalogo, Opcion[]>>({ estados: [], tiposRechazo: [], tramitadores: [], transportadoras: [] })

  useEffect(() => {
    const leer = async (ruta: string, nombre: (x: Record<string, string | undefined>) => string | undefined): Promise<Opcion[]> => {
      try {
        const res = await fetch(`${API}${ruta}`)
        const datos = res.ok ? await res.json() : []
        return Array.isArray(datos) ? datos.map(x => ({ id: x.id, nombre: nombre(x) ?? "" })) : []
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
      <SelectBuscable value={valor} onChange={e => onChange(e.target.value)} disabled={disabled} className={claseCelda} aria-label={campo.etiqueta}>
        <option value="">{campo.obligatorio ? "Seleccione…" : "—"}</option>
        {opciones.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
      </SelectBuscable>
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
export default function GestionEnPantalla({ idsIniciales = [], accionInicial }: { idsIniciales?: number[], accionInicial?: string } = {}) {
  const catalogos = useCatalogos()

  const { data: operaciones } = useOperaciones()

  // Cómo se eligen los trámites: pegando los números o buscando con filtros
  const [modo, setModo] = useState<"numeros" | "filtros">("numeros")
  const [numeros, setNumeros] = useState("")
  const [busqueda, setBusqueda] = useState({
    tramitadorId: "", operacionesId: "", estado: "abiertos", fecha: "creacion", desde: "", hasta: ""
  })
  const cambiarBusqueda = (clave: keyof typeof busqueda, valor: string) => setBusqueda(b => ({ ...b, [clave]: valor }))
  const [cargando, setCargando] = useState(false)
  const [tramites, setTramites] = useState<TramiteMasivo[]>([])

  // Acciones elegidas (una o varias): se guardan juntas en ORDEN_GUARDADO
  const accionValida = ACCIONES.find(a => a.tipo === accionInicial)?.tipo
  const [tipos, setTipos] = useState<TipoAccion[]>([accionValida ?? "estados"])
  const acciones = ACCIONES.filter(a => tipos.includes(a.tipo))
  const alternarAccion = (tipo: TipoAccion) =>
    setTipos(actuales => actuales.includes(tipo)
      ? (actuales.length > 1 ? actuales.filter(t => t !== tipo) : actuales)
      : [...actuales, tipo])

  // Valores por trámite (todas las acciones en un solo registro) y de "mismo valor para todos"
  const [valores, setValores] = useState<Record<number, Record<string, string>>>({})
  const [paraTodos, setParaTodos] = useState<Record<string, string>>({})
  const [resultados, setResultados] = useState<Record<number, Resultado>>({})
  const [guardando, setGuardando] = useState(false)
  // Filas marcadas: "Aplicar" llena solo esas (si no hay ninguna, todas)
  const [marcadas, setMarcadas] = useState<Set<number>>(new Set())

  // Cada fila arranca con sus valores actuales; lo que ya se editó se conserva al agregar o quitar trámites
  useEffect(() => {
    setValores(previos => Object.fromEntries(tramites.map(t => [t.id, { ...valoresIniciales(t), ...previos[t.id] }])))
    setMarcadas(previas => new Set(tramites.map(t => t.id).filter(id => previas.has(id))))
  }, [tramites])

  useEffect(() => {
    setResultados({})
    setParaTodos({})
  }, [tipos])

  const opcionesDe = (campo: Campo) => (campo.catalogo ? catalogos[campo.catalogo] : [])

  // ── Trámites ─────────────────────────────

  // Trámites que llegan marcados desde el Tablero de gestión: se cargan una vez al abrir
  const idsDelTablero = idsIniciales.slice(0, 500).join(",")
  useEffect(() => {
    if (!idsDelTablero) return
    let vigente = true
    setCargando(true)
    fetch(`${API}/bulk/tramites?ids=${idsDelTablero}`)
      .then(async res => {
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? "No se pudieron consultar los trámites")
        if (!vigente) return
        setTramites(json.tramites)
        toast.success(`${json.tramites.length} trámite(s) cargado(s) desde el tablero`)
      })
      .catch(error => vigente && toast.error((error as Error).message))
      .finally(() => vigente && setCargando(false))
    return () => { vigente = false }
  }, [idsDelTablero])

  // Consulta los trámites con sus valores actuales
  const consultar = async (ids: number[]) => {
    const res = await fetch(`${API}/bulk/tramites?ids=${ids.join(",")}`)
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? "No se pudieron consultar los trámites")
    return json as { tramites: TramiteMasivo[], noEncontrados: number[] }
  }

  // Búsqueda por filtros: los resultados reemplazan la lista o se agregan a la que hay
  const buscarTramites = async (agregar: boolean) => {
    const { tramitadorId, operacionesId, desde, hasta } = busqueda
    if (!tramitadorId && !operacionesId && !desde && !hasta) {
      return toast.error("Elija al menos un tramitador, una operación o un rango de fechas")
    }
    if (desde && hasta && desde > hasta) return toast.error("La fecha inicial es mayor que la final")

    setCargando(true)
    try {
      const query = new URLSearchParams(Object.entries(busqueda).filter(([, v]) => v) as [string, string][])
      const res = await fetch(`${API}/bulk/tramites/buscar?${query}`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? "No se pudieron buscar los trámites")

      const encontrados = json.tramites as TramiteMasivo[]
      if (encontrados.length === 0) return toast.info("Ningún trámite coincide con la búsqueda")

      const yaEstan = new Set(tramites.map(t => t.id))
      const lista = agregar ? [...tramites, ...encontrados.filter(t => !yaEstan.has(t.id))] : encontrados
      if (lista.length > 500) return toast.error("Máximo 500 trámites a la vez: acote la búsqueda o limpie la lista")

      setTramites(lista)
      setResultados({})
      toast.success(agregar
        ? `${lista.length - tramites.length} trámite(s) agregado(s)`
        : `${encontrados.length} trámite(s) cargado(s)`)
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setCargando(false)
    }
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

  const alternarFila = (id: number) => setMarcadas(actuales => {
    const nuevas = new Set(actuales)
    if (nuevas.has(id)) nuevas.delete(id)
    else nuevas.add(id)
    return nuevas
  })
  const todasMarcadas = tramites.length > 0 && marcadas.size === tramites.length

  const aplicarATodos = () => {
    const llenos = Object.entries(paraTodos).filter(([, v]) => v !== "")
    if (llenos.length === 0) return toast.error("Escriba al menos un valor para aplicar")
    const destino = marcadas.size > 0 ? marcadas : new Set(tramites.map(t => t.id))
    setValores(actuales => Object.fromEntries(
      Object.entries(actuales).map(([id, fila]) => [id, destino.has(Number(id)) ? { ...fila, ...Object.fromEntries(llenos) } : fila])
    ))
    toast.info(`Aplicado a ${destino.size} trámite(s)`)
  }

  // Qué acciones se aplicarán a cada trámite con lo que tiene escrito
  const porTramite = useMemo(() => new Map(tramites.map(t => [
    t.id,
    ORDEN_GUARDADO.filter(tipo => tipos.includes(tipo) && tieneCambios(tipo, valores[t.id], t))
  ])), [tramites, tipos, valores])

  // ── Guardar ──────────────────────────────

  // Filas con las mismas columnas de la plantilla de Excel (sin los campos auxiliares)
  const filasPara = (accion: Accion, ids: number[]) => ids.map(id => ({
    solicitudTramiteId: id,
    ...Object.fromEntries(accion.campos.filter(c => !c.auxiliar).map(c => [c.clave, valores[id]?.[c.clave] ?? ""]))
  }))

  // Errores del backend: "fila" es la del Excel (encabezado = 1), aquí es la posición + 2
  const erroresPorTramite = (ids: number[], errores: { fila: number, error: string }[]) => {
    const porId: Record<number, string> = {}
    for (const e of errores) {
      const id = ids[e.fila - 2]
      if (id) porId[id] = porId[id] ? `${porId[id]} · ${e.error}` : e.error
      else toast.error(e.error)
    }
    return porId
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
    if (tramites.length === 0) return toast.error("Cargue los trámites")

    // Cada acción solo con los trámites que tienen algo que aplicar
    const plan = ORDEN_GUARDADO
      .filter(tipo => tipos.includes(tipo))
      .map(tipo => ({
        accion: ACCIONES.find(a => a.tipo === tipo)!,
        ids: tramites.filter(t => porTramite.get(t.id)?.includes(tipo)).map(t => t.id)
      }))
      .filter(paso => paso.ids.length > 0)
    if (plan.length === 0) return toast.error("No hay cambios para guardar: llene los valores de los trámites")

    const resumen = plan.map(p => `• ${p.accion.nombre}: ${p.ids.length} trámite(s)`).join("\n")
    const avisos = plan.filter(p => p.accion.aviso).map(p => `• ${p.accion.aviso}`).join("\n")
    if (!confirm(`Se guardará, en este orden:\n${resumen}${avisos ? `\n\nTenga en cuenta:\n${avisos}` : ""}\n\n¿Continuar?`)) return

    setGuardando(true)
    setResultados({})
    const hechos: Record<number, string[]> = {}
    const fallas: Record<number, string> = {}
    const anotar = (ids: number[], nombre: string, errores: Record<number, string>) => {
      for (const id of ids) {
        if (errores[id]) fallas[id] = `${nombre}: ${errores[id]}`
        else (hechos[id] ??= []).push(nombre)
      }
    }
    // Si una acción falla, las siguientes no se aplican (las anteriores ya quedaron guardadas)
    let detenido: { mensaje: string, paso: number } | null = null

    try {
      for (const [paso, { accion, ids }] of plan.entries()) {
        // Observación del cambio de estado: primero como trazabilidad (la notificación de novedad usa la última)
        if (accion.tipo === "estados" && !tipos.includes("trazabilidad")) {
          const conObservacion = ids.filter(id => valores[id]?.observacion?.trim())
          if (conObservacion.length > 0) {
            const traza = await enviar("trazabilidad", conObservacion.map(id => ({
              solicitudTramiteId: id,
              observacionTrazabilidad: valores[id].observacion.trim(),
              nombreUsuario: ""
            })))
            if (!traza.ok || traza.errores.length > 0) {
              const errores = erroresPorTramite(conObservacion, traza.errores)
              anotar(conObservacion.filter(id => errores[id]), "Observación del estado", errores)
              detenido = { mensaje: traza.mensaje ?? "No se pudo guardar la observación del cambio de estado", paso }
              break
            }
          }
        }

        const respuesta = await enviar(accion.tipo, filasPara(accion, ids))
        if (!respuesta.ok && respuesta.errores.length === 0) {
          detenido = { mensaje: `${accion.nombre}: ${respuesta.mensaje ?? "no se pudo procesar"}`, paso }
          break
        }
        // Si la validación falla no se guarda nada de esta acción; si falla el proceso, solo esas filas
        const errores = erroresPorTramite(ids, respuesta.errores)
        anotar(respuesta.ok ? ids : ids.filter(id => errores[id]), accion.nombre, errores)
        if (!respuesta.ok || Object.keys(errores).length > 0) {
          detenido = {
            mensaje: respuesta.ok
              ? `${accion.nombre}: ${Object.keys(errores).length} trámite(s) con error`
              : `${accion.nombre}: hay errores y no se guardó esta acción`,
            paso
          }
          break
        }
      }
    } catch {
      detenido = { mensaje: "Se perdió la conexión con el servidor", paso: -1 }
    }

    // Resultado por trámite: lo que quedó guardado y lo que falló
    setResultados(Object.fromEntries([
      ...Object.entries(hechos)
        .filter(([id]) => !fallas[Number(id)])
        .map(([id, nombres]) => [id, { estado: "ok", mensaje: `Guardado: ${nombres.join(", ")}` } as Resultado]),
      ...Object.entries(fallas).map(([id, error]) => [id, {
        estado: "error",
        mensaje: hechos[Number(id)]?.length ? `${error} (sí se guardó: ${hechos[Number(id)].join(", ")})` : error
      } as Resultado])
    ]))

    const guardados = Object.keys(hechos).length
    if (guardados > 0) {
      // Refresca la columna "Actual" y reinicia los valores con lo que quedó guardado
      consultar(tramites.map(t => t.id)).then(json => {
        setValores({})
        setTramites(json.tramites)
      }).catch(() => undefined)
    }
    if (detenido) {
      const sinAplicar = detenido.paso >= 0 ? plan.slice(detenido.paso + 1).map(p => p.accion.nombre) : []
      toast.error(`${detenido.mensaje}.${sinAplicar.length ? ` No se aplicó: ${sinAplicar.join(", ")}.` : ""}`, { autoClose: 10000 })
    } else {
      toast.success(`${guardados} trámite(s) actualizado(s)`)
    }
    setGuardando(false)
  }

  const conError = useMemo(() => Object.values(resultados).filter(r => r.estado === "error").length, [resultados])

  // ── Vista ────────────────────────────────

  return (
    <div className="space-y-6">

      {/* 1. TRÁMITES */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-700">1. Trámites</h2>
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5" role="tablist">
            {([["numeros", "Por número", Hash], ["filtros", "Buscar con filtros", Search]] as const).map(([valor, texto, Icono]) => (
              <button
                key={valor}
                type="button"
                role="tab"
                aria-selected={modo === valor}
                onClick={() => setModo(valor)}
                className={clsx(
                  "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition",
                  modo === valor ? "bg-white text-sky-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                <Icono size={13} /> {texto}
              </button>
            ))}
          </div>
        </div>

        {modo === "filtros" ? (
          <>
            <p className="mt-0.5 text-xs text-slate-400">
              Busque por tramitador, operación, estado y fechas. Elija al menos un tramitador, una operación o un rango de fechas. Máximo 500.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="block">
                <span className={claseEtiqueta}>Tramitador</span>
                <SelectBuscable value={busqueda.tramitadorId} onChange={e => cambiarBusqueda("tramitadorId", e.target.value)} className={claseFiltro}>
                  <option value="">Todos</option>
                  <option value="sin">Sin tramitador</option>
                  {catalogos.tramitadores.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </SelectBuscable>
              </label>
              <label className="block">
                <span className={claseEtiqueta}>Operación</span>
                <SelectBuscable value={busqueda.operacionesId} onChange={e => cambiarBusqueda("operacionesId", e.target.value)} className={claseFiltro}>
                  <option value="">Todas</option>
                  {operaciones.map(o => <option key={o.id} value={o.id}>{o.nombreOperacion}</option>)}
                </SelectBuscable>
              </label>
              <label className="block">
                <span className={claseEtiqueta}>Estado actual</span>
                <SelectBuscable value={busqueda.estado} onChange={e => cambiarBusqueda("estado", e.target.value)} className={claseFiltro}>
                  <option value="abiertos">Abiertos (sin finalizar ni desistir)</option>
                  <option value="">Todos</option>
                  {catalogos.estados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </SelectBuscable>
              </label>
              <label className="block">
                <span className={claseEtiqueta}>Fecha de</span>
                <SelectBuscable value={busqueda.fecha} onChange={e => cambiarBusqueda("fecha", e.target.value)} className={claseFiltro}>
                  <option value="creacion">Creación del trámite</option>
                  <option value="diligencia">Diligencia (programación)</option>
                  <option value="finalizacion">Finalización del servicio</option>
                </SelectBuscable>
              </label>
              <label className="block">
                <span className={claseEtiqueta}>Desde</span>
                <input type="date" value={busqueda.desde} onChange={e => cambiarBusqueda("desde", e.target.value)} className={claseFiltro} />
              </label>
              <label className="block">
                <span className={claseEtiqueta}>Hasta</span>
                <input type="date" value={busqueda.hasta} onChange={e => cambiarBusqueda("hasta", e.target.value)} className={claseFiltro} />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              {tramites.length > 0 && (
                <button type="button" onClick={() => buscarTramites(true)} disabled={cargando || guardando} className={claseBotonSecundario}>
                  Agregar a la lista
                </button>
              )}
              <button type="button" onClick={() => buscarTramites(false)} disabled={cargando || guardando}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-sky-500 px-4 text-xs font-semibold text-white hover:bg-sky-600 disabled:opacity-50">
                {cargando ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                Buscar y cargar
              </button>
            </div>
          </>
        ) : (
        <>
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
        </>
        )}
      </section>

      {/* 2. ACCIONES (una o varias) */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">2. ¿Qué quiere hacer?</h2>
        <p className="mt-0.5 text-xs text-slate-400">Elija una o varias acciones: se guardan juntas con un solo clic.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {ACCIONES.map(a => {
            const elegida = tipos.includes(a.tipo)
            return (
              <button
                key={a.tipo}
                type="button"
                onClick={() => alternarAccion(a.tipo)}
                disabled={guardando}
                aria-pressed={elegida}
                className={clsx(
                  "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition",
                  elegida ? "border-sky-500 bg-sky-500 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                )}
              >
                <span className={clsx(
                  "flex h-4 w-4 items-center justify-center rounded border",
                  elegida ? "border-white bg-white text-sky-600" : "border-slate-300 bg-white"
                )}>
                  {elegida && <Check size={11} strokeWidth={3} />}
                </span>
                {a.nombre}
              </button>
            )
          })}
        </div>

        <ul className="mt-3 space-y-1.5">
          {acciones.map(a => (
            <li key={a.tipo} className="text-xs text-slate-500">
              <span className="font-semibold text-slate-700">{a.nombre}:</span> {a.descripcion}
            </li>
          ))}
        </ul>
        {acciones.some(a => a.aviso) && (
          <div className="mt-3 space-y-1 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {acciones.filter(a => a.aviso).map(a => (
              <p key={a.tipo} className="flex items-start gap-1.5">
                <AlertTriangle size={14} className="mt-px shrink-0" /> {a.aviso}
              </p>
            ))}
          </div>
        )}
        {tipos.length > 1 && (
          <p className="mt-3 text-[11px] text-slate-400">
            Orden al guardar: {ORDEN_GUARDADO.filter(t => tipos.includes(t)).map(t => ACCIONES.find(a => a.tipo === t)!.nombre).join(" → ")}.
            El estado va al final para que su notificación salga con lo demás ya guardado.
          </p>
        )}
      </section>

      {/* 3. VALORES */}
      {tramites.length > 0 && (
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-700">3. Valores ({tramites.length} trámites)</h2>
            <div className="flex gap-3 text-xs">
              <span className="text-slate-500">
                {[...porTramite.values()].filter(t => t.length > 0).length} con cambios
              </span>
              {conError > 0 && <span className="font-semibold text-red-600">{conError} con error</span>}
            </div>
          </div>

          {/* Mismo valor para todos (o para las filas marcadas) */}
          <div className="rounded-lg border border-sky-100 bg-sky-50/60 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-sky-800">
              <Wand2 size={14} />
              {marcadas.size > 0
                ? `Mismo valor para los ${marcadas.size} trámite(s) marcados`
                : "Mismo valor para todos (marque filas para aplicarlo solo a esas)"}
              <span className="font-normal text-sky-700">· solo se aplican los campos que llene</span>
            </p>
            <div className="space-y-2">
              {acciones.map(accion => (
                <div key={accion.tipo} className="flex flex-wrap items-end gap-3">
                  <span className="w-full text-[10px] font-semibold uppercase tracking-wide text-sky-700 sm:w-28 sm:pb-2">{accion.nombre}</span>
                  {camposVisibles(accion, tipos).map(campo => (
                    <label key={campo.clave} className="block">
                      <span className="mb-1 block text-[11px] font-medium text-slate-600">{campo.etiqueta}</span>
                      <Celda campo={campo} valor={paraTodos[campo.clave] ?? ""} opciones={opcionesDe(campo)}
                        onChange={v => setParaTodos(a => ({ ...a, [campo.clave]: v }))} disabled={guardando} />
                    </label>
                  ))}
                </div>
              ))}
              <div className="flex justify-end">
                <button type="button" onClick={aplicarATodos} disabled={guardando} className={`${claseBotonSecundario} h-8`}>
                  {marcadas.size > 0 ? `Aplicar a ${marcadas.size} marcado(s)` : "Aplicar a todas las filas"}
                </button>
              </div>
            </div>
          </div>

          {/* Tabla: una fila por trámite, columnas agrupadas por acción */}
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr className="border-b border-slate-200">
                  <th rowSpan={2} className="w-8 px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={todasMarcadas}
                      onChange={() => setMarcadas(todasMarcadas ? new Set() : new Set(tramites.map(t => t.id)))}
                      aria-label="Marcar todos"
                      className="h-3.5 w-3.5 accent-sky-600"
                    />
                  </th>
                  <th rowSpan={2} className="px-3 py-2.5 font-semibold">Trámite</th>
                  <th rowSpan={2} className="px-3 py-2.5 font-semibold">Actual</th>
                  {acciones.map(a => (
                    <th key={a.tipo} colSpan={camposVisibles(a, tipos).length} className="border-l border-slate-200 bg-sky-50 px-3 py-1.5 text-center font-semibold text-sky-700">
                      {a.nombre}
                    </th>
                  ))}
                  <th rowSpan={2} className="border-l border-slate-200 px-3 py-2.5 font-semibold">Se aplicará / resultado</th>
                  <th rowSpan={2} className="px-3 py-2.5" />
                </tr>
                <tr>
                  {acciones.flatMap(a => camposVisibles(a, tipos).map((c, i) => (
                    <th key={c.clave} className={clsx("px-3 py-2 font-semibold normal-case tracking-normal", i === 0 && "border-l border-slate-200")}>
                      {c.etiqueta}
                    </th>
                  )))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tramites.map(t => {
                  const resultado = resultados[t.id]
                  const aplicara = porTramite.get(t.id) ?? []
                  return (
                    <tr key={t.id} className={clsx(
                      "align-top",
                      resultado?.estado === "error" && "bg-red-50/50",
                      resultado?.estado === "ok" && "bg-emerald-50/50",
                      !resultado && marcadas.has(t.id) && "bg-sky-50/40"
                    )}>
                      <td className="px-3 py-2.5">
                        <input type="checkbox" checked={marcadas.has(t.id)} onChange={() => alternarFila(t.id)}
                          aria-label={`Marcar trámite ${t.id}`} className="h-3.5 w-3.5 accent-sky-600" />
                      </td>
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
                      {acciones.flatMap(a => camposVisibles(a, tipos).map((campo, i) => (
                        <td key={campo.clave} className={clsx("px-3 py-2", i === 0 && "border-l border-slate-100")}>
                          <Celda campo={campo} valor={valores[t.id]?.[campo.clave] ?? ""} opciones={opcionesDe(campo)}
                            onChange={v => cambiar(t.id, campo.clave, v)} disabled={guardando} />
                        </td>
                      )))}
                      <td className="max-w-[240px] border-l border-slate-100 px-3 py-2">
                        {resultado?.estado === "ok" && <span className="inline-flex items-start gap-1 text-emerald-700"><CheckCircle2 size={14} className="mt-px shrink-0" /> {resultado.mensaje}</span>}
                        {resultado?.estado === "error" && <span className="inline-flex items-start gap-1 text-red-600"><CircleAlert size={14} className="mt-px shrink-0" /> {resultado.mensaje}</span>}
                        {!resultado && (aplicara.length > 0
                          ? (
                            <div className="flex flex-wrap gap-1">
                              {aplicara.map(tipo => (
                                <span key={tipo} className="rounded-full border border-sky-200 bg-sky-50 px-1.5 py-px text-[10px] font-medium text-sky-700">
                                  {ACCIONES.find(a => a.tipo === tipo)!.nombre}
                                </span>
                              ))}
                            </div>
                          )
                          : <span className="text-[11px] text-slate-400">Sin cambios</span>)}
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
