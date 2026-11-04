"use client"

import { useMemo, useState } from "react"
import clsx from "clsx"
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { AlertTriangle, Cake, Info, Map as IconoMapa, MapPin, Search, Users, X } from "lucide-react"
import {
  MESES, MINUTOS_DESPLAZAMIENTO, celular, diasParaCumple, distancia, enlaceRuta, normalizar, ordenarPersonas, textoDistancia, tituloMunicipio,
  type DatosDirectorio, type MunicipioDirectorio, type PersonaDirectorio
} from "@/src/directorio"
import FichaPersona, { Avatar, Etiquetas } from "./FichaPersona"

type Vista = "municipio" | "tramitador" | "cobertura" | "cumple"
const VISTAS: { id: Vista, nombre: string, icono: typeof MapPin }[] = [
  { id: "municipio", nombre: "Por municipio", icono: MapPin },
  { id: "tramitador", nombre: "Por tramitador", icono: Users },
  { id: "cobertura", nombre: "Cobertura", icono: IconoMapa },
  { id: "cumple", nombre: "Cumpleaños", icono: Cake }
]

const claseInput = "w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-300 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
const claseTarjeta = "rounded-xl border border-slate-200 bg-white p-4 shadow-sm"

// Directorio de tramitadores (Ayudas Torre de Control). La vista y el municipio quedan en la
// dirección (?vista=…&municipio=…) para compartir el enlace
export default function DirectorioTramitadores({ datos, vistaInicial, municipioInicial }: {
  datos: DatosDirectorio
  vistaInicial?: string
  municipioInicial: number | null
}) {
  const [vista, setVista] = useState<Vista>(VISTAS.some(v => v.id === vistaInicial) ? vistaInicial as Vista : "municipio")
  const [municipioId, setMunicipioId] = useState<number | null>(municipioInicial)
  const [ficha, setFicha] = useState<PersonaDirectorio | null>(null)

  const municipios = useMemo(() => new Map(datos.municipios.map(m => [m.id, m])), [datos])
  // Municipio → personas que lo cubren, en el orden de prioridad
  const cobertura = useMemo(() => {
    const mapa = new Map<number, PersonaDirectorio[]>()
    for (const p of datos.tramitadores) for (const id of p.cobertura) mapa.set(id, [...(mapa.get(id) ?? []), p])
    mapa.forEach(lista => lista.sort(ordenarPersonas))
    return mapa
  }, [datos])

  const actualizarUrl = (v: Vista, m: number | null) => {
    const q = new URLSearchParams({ vista: v, ...(m ? { municipio: String(m) } : {}) })
    window.history.replaceState(null, "", `/center/directorio?${q}`)
  }
  const irA = (v: Vista) => { setVista(v); actualizarUrl(v, municipioId) }
  const elegirMunicipio = (id: number | null) => {
    setMunicipioId(id); setVista("municipio"); setFicha(null); actualizarUrl("municipio", id)
    window.scrollTo({ top: 0 })
  }

  const hoy = new Date()
  const cumplenHoy = datos.tramitadores.filter(p => diasParaCumple(p, hoy) === 0).length
  const props = { datos, municipios, cobertura, elegirMunicipio, verFicha: setFicha }

  return (
    <div className="space-y-5">
      <nav className="flex gap-1 overflow-x-auto border-b border-slate-200" aria-label="Vistas del directorio">
        {VISTAS.map(({ id, nombre, icono: Icono }) => (
          <button key={id} type="button" onClick={() => irA(id)} aria-current={vista === id ? "page" : undefined}
            className={clsx("-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-xs font-semibold transition",
              vista === id ? "border-sky-500 text-sky-700" : "border-transparent text-slate-500 hover:text-slate-700")}>
            <Icono size={14} /> {nombre}
            {id === "cumple" && cumplenHoy > 0 && <span className="rounded-full bg-sky-600 px-1.5 text-[10px] text-white">{cumplenHoy}</span>}
          </button>
        ))}
      </nav>

      {vista === "municipio" && <VistaMunicipio {...props} municipioId={municipioId} />}
      {vista === "tramitador" && <VistaPersonas {...props} />}
      {vista === "cobertura" && <VistaCobertura {...props} />}
      {vista === "cumple" && <VistaCumpleanos {...props} />}

      {ficha && (
        <Dialog open onClose={() => setFicha(null)} className="relative z-50">
          <div className="fixed inset-0 bg-slate-900/30" aria-hidden="true" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <DialogPanel className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-xl bg-slate-50 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
                <DialogTitle className="text-sm font-semibold text-slate-800">{ficha.esMensajero ? "Mensajero propio" : "Tramitador"}</DialogTitle>
                <button type="button" onClick={() => setFicha(null)} className="text-slate-400 hover:text-slate-600" aria-label="Cerrar"><X size={18} /></button>
              </div>
              <div className="overflow-y-auto p-4">
                <FichaPersona persona={ficha} municipios={municipios} municipio={municipioId ? municipios.get(municipioId) : null} onMunicipio={elegirMunicipio} completa />
              </div>
            </DialogPanel>
          </div>
        </Dialog>
      )}
    </div>
  )
}

type Props = {
  datos: DatosDirectorio
  municipios: Map<number, MunicipioDirectorio>
  cobertura: Map<number, PersonaDirectorio[]>
  elegirMunicipio: (id: number | null) => void
  verFicha: (p: PersonaDirectorio) => void
}

const conteo = (personas: PersonaDirectorio[] | undefined) => {
  const lista = personas ?? []
  const m = lista.filter(p => p.esMensajero).length
  return { mensajeros: m, tramitadores: lista.length - m }
}

function ResumenCobertura({ personas }: { personas: PersonaDirectorio[] | undefined }) {
  const { mensajeros, tramitadores } = conteo(personas)
  if (!mensajeros && !tramitadores) return <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500">Sin cobertura</span>
  return (
    <span className="flex flex-wrap gap-1">
      {mensajeros > 0 && <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">{mensajeros} mensajero{mensajeros > 1 ? "s" : ""}</span>}
      {tramitadores > 0 && <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700">{tramitadores} tramitador{tramitadores > 1 ? "es" : ""}</span>}
    </span>
  )
}

// ── Por municipio ──
function VistaMunicipio({ datos, municipios, cobertura, elegirMunicipio, verFicha, municipioId }: Props & { municipioId: number | null }) {
  const [texto, setTexto] = useState("")
  const municipio = municipioId ? municipios.get(municipioId) : undefined

  const sugerencias = useMemo(() => {
    const q = normalizar(texto)
    if (!q) return []
    return datos.municipios
      .map(m => {
        const n = normalizar(m.nombre)
        const puntaje = n === q ? 0 : n.startsWith(q) ? 1 : ` ${n}`.includes(` ${q}`) ? 2 : `${n} ${normalizar(m.departamento)}`.includes(q) ? 3 : -1
        return { m, puntaje, cubierto: cobertura.has(m.id) }
      })
      .filter(x => x.puntaje >= 0)
      .sort((a, b) => a.puntaje - b.puntaje || Number(b.cubierto) - Number(a.cubierto) || a.m.nombre.localeCompare(b.m.nombre, "es"))
      .slice(0, 10)
  }, [texto, datos, cobertura])

  const personas = municipio ? cobertura.get(municipio.id) ?? [] : []

  return (
    <div className="space-y-4">
      <div className={claseTarjeta}>
        <label className="mb-1.5 block text-xs font-medium text-slate-600" htmlFor="buscarMunicipio">¿Quién atiende el municipio?</label>
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
          <input id="buscarMunicipio" value={texto} onChange={e => setTexto(e.target.value)} placeholder="Escriba un municipio, p. ej. Girón" className={`${claseInput} pl-9`} autoComplete="off" />
        </div>
        {sugerencias.length > 0 && (
          <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
            {sugerencias.map(({ m }) => (
              <li key={m.id}>
                <button type="button" onClick={() => { setTexto(""); elegirMunicipio(m.id) }} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-slate-700">{tituloMunicipio(m.nombre)}</span>
                    <span className="block text-[11px] text-slate-400">{tituloMunicipio(m.departamento)}{m.regional ? ` · Regional ${tituloMunicipio(m.regional)}` : ""}</span>
                  </span>
                  <ResumenCobertura personas={cobertura.get(m.id)} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {texto.trim() && !sugerencias.length && <p className="mt-2 text-xs text-slate-400">No hay municipios con ese nombre.</p>}
      </div>

      {!municipio ? <MunicipiosCubiertos {...{ datos, municipios, cobertura, elegirMunicipio }} /> : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className="text-2xl font-semibold text-slate-800">{tituloMunicipio(municipio.nombre)}</h2>
            <span className="text-sm text-slate-400">{tituloMunicipio(municipio.departamento)}{municipio.regional ? ` · Regional ${tituloMunicipio(municipio.regional)}` : ""}</span>
            <ResumenCobertura personas={personas} />
            <button type="button" onClick={() => elegirMunicipio(null)} className="ml-auto text-xs font-semibold text-sky-700 hover:underline">Nueva consulta</button>
          </div>

          {personas.length > 1 && (
            <div className="flex gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-slate-700">
              <Info size={18} className="mt-0.5 shrink-0 text-sky-600" />
              <p><b>Antes de generar poderes o autorizaciones a nombre de un tramitador, consulte a Torre de Control.</b> {tituloMunicipio(municipio.nombre)} lo cubren {personas.length} personas, y Torre de Control asigna según la capacidad y las diligencias que cada una ya tiene programadas.</p>
            </div>
          )}

          {personas.length > 0 ? (
            <>
              {[{ titulo: "Mensajeros propios", lista: personas.filter(p => p.esMensajero) }, { titulo: "Tramitadores", lista: personas.filter(p => !p.esMensajero) }]
                .filter(g => g.lista.length)
                .map(g => (
                  <section key={g.titulo}>
                    <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{g.titulo}</h3>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {g.lista.map(p => <FichaPersona key={p.id} persona={p} municipios={municipios} municipio={municipio} onMunicipio={elegirMunicipio} />)}
                    </div>
                  </section>
                ))}
            </>
          ) : <SinCobertura {...{ datos, municipios, elegirMunicipio, verFicha, municipio }} />}
        </div>
      )}
    </div>
  )
}

// Municipios con cobertura por regional (cuando no se ha elegido uno)
function MunicipiosCubiertos({ municipios, cobertura, elegirMunicipio }: Pick<Props, "datos" | "municipios" | "cobertura" | "elegirMunicipio">) {
  const porRegional = new Map<string, MunicipioDirectorio[]>()
  cobertura.forEach((_, id) => {
    const m = municipios.get(id)
    if (m) porRegional.set(m.regional ?? "Sin regional", [...(porRegional.get(m.regional ?? "Sin regional") ?? []), m])
  })
  return (
    <div className={claseTarjeta}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Municipios con cobertura ({cobertura.size})</p>
      <div className="mt-3 space-y-4">
        {[...porRegional.entries()].sort(([a], [b]) => a.localeCompare(b, "es")).map(([regional, lista]) => (
          <div key={regional}>
            <p className="mb-1.5 text-xs font-semibold text-slate-600">Regional {tituloMunicipio(regional)} · {lista.length}</p>
            <div className="flex flex-wrap gap-1">
              {lista.sort((a, b) => a.nombre.localeCompare(b.nombre, "es")).map(m => (
                <button key={m.id} type="button" onClick={() => elegirMunicipio(m.id)}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600 hover:border-sky-300 hover:text-sky-700">
                  {(cobertura.get(m.id) ?? []).some(p => p.esMensajero) && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                  {tituloMunicipio(m.nombre)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Atendido también por mensajeros propios</p>
    </div>
  )
}

// Municipio sin tramitador: escalar a Torre y, como referencia, quién puede desplazarse
function SinCobertura({ datos, municipios, elegirMunicipio, verFicha, municipio }: Pick<Props, "datos" | "municipios" | "elegirMunicipio" | "verFicha"> & { municipio: MunicipioDirectorio }) {
  const cercanos = datos.tramitadores
    .map(p => ({ p, d: distancia(p.residenciaId ? municipios.get(p.residenciaId) : undefined, municipio), residencia: p.residenciaId ? municipios.get(p.residenciaId) : undefined }))
    .filter((x): x is { p: PersonaDirectorio, d: { km: number, minutos: number }, residencia: MunicipioDirectorio } => Boolean(x.d && x.residencia))
    .sort((a, b) => a.d.minutos - b.d.minutos)
  const aMano = cercanos.filter(x => x.d.minutos <= MINUTOS_DESPLAZAMIENTO)
  const mostrar = aMano.length ? aMano.slice(0, 12) : cercanos.slice(0, 3)
  const enDepartamento = datos.tramitadores.filter(p => p.cobertura.some(id => municipios.get(id)?.departamento === municipio.departamento)).sort(ordenarPersonas)

  const fila = (p: PersonaDirectorio, detalle: React.ReactNode, ruta?: string) => (
    <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
      <Avatar persona={p} pequeno />
      <span className="text-sm font-medium text-slate-700">{p.nombre}</span>
      <span className="text-xs text-slate-500">{detalle}</span>
      <Etiquetas persona={p} />
      <span className="ml-auto flex gap-2">
        {ruta && <a href={ruta} target="_blank" rel="noreferrer" className="text-xs font-semibold text-sky-700 hover:underline">Ver ruta</a>}
        <button type="button" onClick={() => verFicha(p)} className="text-xs font-semibold text-sky-700 hover:underline">Ver ficha</button>
      </span>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <AlertTriangle size={18} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold">No se tiene tramitador en {tituloMunicipio(municipio.nombre)}</p>
          <p><b>Por favor escalar a Torre de Control para la gestión.</b> Como referencia, estas son las opciones más cercanas.</p>
        </div>
      </div>

      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          {aMano.length ? `Pueden desplazarse (hasta 1 h 30 min desde donde residen)` : `Nadie reside a menos de 1 h 30 min · los más cercanos`}
        </h3>
        <div className="space-y-2">
          {mostrar.map(x => (
            fila(x.p, <>reside en {tituloMunicipio(x.residencia.nombre)}{x.residencia.departamento !== municipio.departamento ? ` (${tituloMunicipio(x.residencia.departamento)})` : ""} · <b>{textoDistancia(x.d)}</b></>,
              enlaceRuta(x.residencia, municipio))
          ))}
          {!mostrar.length && <p className="text-xs text-slate-400">No hay tramitadores con municipio de residencia registrado.</p>}
        </div>
        <p className="mt-2 text-[11px] text-slate-400">Distancia y tiempo estimados por carretera desde el municipio donde reside cada persona. Confirme con «Ver ruta».</p>
      </section>

      {enDepartamento.length > 0 && (
        <section>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Cubren otros municipios de {tituloMunicipio(municipio.departamento)}</h3>
          <div className="space-y-2">
            {enDepartamento.map(p => {
              const ms = p.cobertura.map(id => municipios.get(id)).filter((m): m is MunicipioDirectorio => m?.departamento === municipio.departamento)
              return fila(p, <>cubre {ms.slice(0, 4).map(m => tituloMunicipio(m.nombre)).join(", ")}{ms.length > 4 ? ` y ${ms.length - 4} más` : ""}</>)
            })}
          </div>
        </section>
      )}
      <button type="button" onClick={() => elegirMunicipio(null)} className="text-xs font-semibold text-sky-700 hover:underline">Nueva consulta</button>
    </div>
  )
}

// ── Por tramitador ──
function VistaPersonas({ datos, municipios, verFicha }: Props) {
  const [texto, setTexto] = useState("")
  const [tipo, setTipo] = useState<"todos" | "tramitador" | "mensajero">("todos")
  const [regional, setRegional] = useState("")
  const regionales = useMemo(() => [...new Set(datos.municipios.map(m => m.regional).filter((r): r is string => Boolean(r)))].sort(), [datos])

  const lista = datos.tramitadores.filter(p => {
    if (tipo === "mensajero" && !p.esMensajero) return false
    if (tipo === "tramitador" && p.esMensajero) return false
    const cubre = p.cobertura.map(id => municipios.get(id)).filter((m): m is MunicipioDirectorio => Boolean(m))
    const residencia = p.residenciaId ? municipios.get(p.residenciaId) : undefined
    if (regional && !cubre.some(m => m.regional === regional) && residencia?.regional !== regional) return false
    const q = normalizar(texto)
    if (!q) return true
    const digitos = q.replace(/\D/g, "")
    return normalizar(p.nombre).includes(q) || (digitos.length >= 4 && String(p.identificacion ?? "").includes(digitos))
      || normalizar(residencia?.nombre ?? p.ciudad).includes(q) || cubre.some(m => normalizar(m.nombre).includes(q) || normalizar(m.departamento).includes(q))
  }).sort((a, b) => Number(b.esMensajero) - Number(a.esMensajero) || a.nombre.localeCompare(b.nombre, "es"))

  return (
    <div className="space-y-4">
      <div className={clsx(claseTarjeta, "flex flex-wrap items-center gap-3")}>
        <div className="relative min-w-[16rem] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
          <input value={texto} onChange={e => setTexto(e.target.value)} placeholder="Nombre, cédula, ciudad o municipio que cubre" className={`${claseInput} pl-9`} aria-label="Buscar tramitador" />
        </div>
        <div className="inline-flex rounded-lg bg-slate-100 p-0.5" role="group" aria-label="Tipo">
          {([["todos", "Todos"], ["tramitador", "Tramitadores"], ["mensajero", "Mensajeros propios"]] as const).map(([v, n]) => (
            <button key={v} type="button" onClick={() => setTipo(v)} aria-pressed={tipo === v}
              className={clsx("rounded-md px-3 py-1.5 text-xs font-semibold", tipo === v ? "bg-white text-sky-700 shadow-sm" : "text-slate-500")}>{n}</button>
          ))}
        </div>
        <select value={regional} onChange={e => setRegional(e.target.value)} className={clsx(claseInput, "w-auto")} aria-label="Regional">
          <option value="">Todas las regionales</option>
          {regionales.map(r => <option key={r} value={r}>{tituloMunicipio(r)}</option>)}
        </select>
      </div>
      <p className="text-xs text-slate-400">{lista.length} de {datos.tramitadores.length} personas</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {lista.map(p => {
          const residencia = p.residenciaId ? municipios.get(p.residenciaId) : undefined
          return (
            <button key={p.id} type="button" onClick={() => verFicha(p)} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-sky-200">
              <Avatar persona={p} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-800">{p.nombre}</span>
                <span className="block text-[11px] text-slate-400">
                  {p.esMensajero ? "Mensajero propio" : "Tramitador"} · {residencia ? tituloMunicipio(residencia.nombre) : p.ciudad || "—"} · {p.cobertura.length} municipio{p.cobertura.length === 1 ? "" : "s"}
                </span>
                {celular(p.whatsapp) && <span className="block text-[11px] text-slate-500">{celular(p.whatsapp)}</span>}
                <span className="mt-1 block"><Etiquetas persona={p} /></span>
              </span>
            </button>
          )
        })}
      </div>
      {!lista.length && <p className="py-10 text-center text-sm text-slate-400">No hay resultados con esos filtros.</p>}
    </div>
  )
}

// ── Cobertura ──
function VistaCobertura({ datos, cobertura, elegirMunicipio, verFicha }: Props) {
  const mensajeros = datos.tramitadores.filter(p => p.esMensajero).length
  const totales = useMemo(() => {
    const porDepto = new Map<string, { total: number, cubiertos: number, conMensajero: number }>()
    const porRegional = new Map<string, { total: number, cubiertos: number, personas: Set<number> }>()
    for (const m of datos.municipios) {
      const lista = cobertura.get(m.id) ?? []
      const d = porDepto.get(m.departamento) ?? { total: 0, cubiertos: 0, conMensajero: 0 }
      d.total++
      if (lista.length) { d.cubiertos++; if (lista.some(p => p.esMensajero)) d.conMensajero++ }
      porDepto.set(m.departamento, d)
      const clave = m.regional ?? "Sin regional"
      const r = porRegional.get(clave) ?? { total: 0, cubiertos: 0, personas: new Set<number>() }
      r.total++
      if (lista.length) { r.cubiertos++; lista.forEach(p => r.personas.add(p.id)) }
      porRegional.set(clave, r)
    }
    return { porDepto, porRegional }
  }, [datos, cobertura])
  const deptosConPresencia = [...totales.porDepto.values()].filter(d => d.cubiertos).length
  const rankingDeptos = [...totales.porDepto.entries()].filter(([, d]) => d.cubiertos).sort((a, b) => b[1].cubiertos - a[1].cubiertos).slice(0, 12)
  const maxDepto = Math.max(1, ...rankingDeptos.map(([, d]) => d.cubiertos))
  const rankingPersonas = [...datos.tramitadores].sort((a, b) => b.cobertura.length - a.cobertura.length || a.nombre.localeCompare(b.nombre, "es")).slice(0, 10)
  const maxPersona = Math.max(1, ...rankingPersonas.map(p => p.cobertura.length))
  const [departamento, setDepartamento] = useState<string | null>(null)

  const indicador = (valor: number, etiqueta: string, color?: string, detalle?: string) => (
    <div key={etiqueta} className={claseTarjeta}>
      <p className={clsx("text-2xl font-semibold tabular-nums", color ?? "text-slate-800")}>{valor.toLocaleString("es-CO")}{detalle && <span className="text-sm font-medium text-slate-400"> {detalle}</span>}</p>
      <p className="text-xs text-slate-500">{etiqueta}</p>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {indicador(datos.tramitadores.length - mensajeros, "Tramitadores activos", "text-sky-700")}
        {indicador(mensajeros, "Mensajeros propios", "text-emerald-700")}
        {indicador(cobertura.size, `Municipios con cobertura · ${(cobertura.size / Math.max(1, datos.municipios.length) * 100).toLocaleString("es-CO", { maximumFractionDigits: 1 })} %`, undefined, `/ ${datos.municipios.length.toLocaleString("es-CO")}`)}
        {indicador(deptosConPresencia, "Departamentos con presencia", undefined, `/ ${totales.porDepto.size}`)}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className={claseTarjeta}>
          <h3 className="text-sm font-semibold text-slate-800">Por regional</h3>
          <table className="mt-3 w-full text-xs">
            <thead className="text-[10px] uppercase tracking-wide text-slate-400">
              <tr><th className="pb-2 text-left font-semibold">Regional</th><th className="pb-2 text-right font-semibold">Cubiertos</th><th className="pb-2 text-right font-semibold">Personas</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...totales.porRegional.entries()].sort((a, b) => b[1].cubiertos - a[1].cubiertos).map(([r, d]) => (
                <tr key={r}>
                  <td className="py-2">
                    {tituloMunicipio(r)}
                    <div className="mt-1 h-1.5 rounded-full bg-slate-100"><div className="h-1.5 rounded-full bg-sky-500" style={{ width: `${d.cubiertos / Math.max(1, d.total) * 100}%` }} /></div>
                  </td>
                  <td className="py-2 text-right tabular-nums">{d.cubiertos} / {d.total}</td>
                  <td className="py-2 text-right tabular-nums">{d.personas.size}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className={claseTarjeta}>
          <h3 className="text-sm font-semibold text-slate-800">Departamentos con más cobertura</h3>
          <p className="mb-3 text-[11px] text-slate-400"><span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> con mensajeros propios · <span className="inline-block h-2 w-2 rounded-full bg-sky-500" /> tramitadores. Toque uno para ver sus municipios.</p>
          <div className="space-y-1">
            {rankingDeptos.map(([nombre, d]) => (
              <button key={nombre} type="button" onClick={() => setDepartamento(departamento === nombre ? null : nombre)}
                className={clsx("grid w-full grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs hover:bg-slate-50", departamento === nombre && "bg-sky-50")}>
                <span className="truncate">{tituloMunicipio(nombre)}</span>
                <span className="flex h-2 overflow-hidden rounded-full bg-slate-100">
                  <span className="bg-emerald-500" style={{ width: `${d.conMensajero / maxDepto * 100}%` }} />
                  <span className="bg-sky-500" style={{ width: `${(d.cubiertos - d.conMensajero) / maxDepto * 100}%` }} />
                </span>
                <span className="tabular-nums font-semibold">{d.cubiertos}<span className="font-normal text-slate-400">/{d.total}</span></span>
              </button>
            ))}
          </div>
        </section>

        <section className={claseTarjeta}>
          <h3 className="text-sm font-semibold text-slate-800">Quién cubre más municipios</h3>
          <p className="mb-3 text-[11px] text-slate-400">Toque una persona para ver su ficha.</p>
          <div className="space-y-1">
            {rankingPersonas.map(p => (
              <button key={p.id} type="button" onClick={() => verFicha(p)} className="grid w-full grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs hover:bg-slate-50">
                <span className="truncate">{p.nombre}</span>
                <span className="flex h-2 overflow-hidden rounded-full bg-slate-100"><span className={p.esMensajero ? "bg-emerald-500" : "bg-sky-500"} style={{ width: `${p.cobertura.length / maxPersona * 100}%` }} /></span>
                <span className="tabular-nums font-semibold">{p.cobertura.length}</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      {departamento && (
        <section className={claseTarjeta}>
          <h3 className="text-sm font-semibold text-slate-800">{tituloMunicipio(departamento)}</h3>
          <div className="mt-2 flex flex-wrap gap-1">
            {datos.municipios.filter(m => m.departamento === departamento).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")).map(m => {
              const lista = cobertura.get(m.id) ?? []
              return (
                <button key={m.id} type="button" onClick={() => elegirMunicipio(m.id)}
                  className={clsx("rounded-full border px-2 py-0.5 text-[11px]", lista.length
                    ? lista.some(p => p.esMensajero) ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-sky-200 bg-sky-50 text-sky-800"
                    : "border-slate-200 text-slate-400")}>
                  {tituloMunicipio(m.nombre)}{lista.length ? ` · ${lista.length}` : ""}
                </button>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

// ── Cumpleaños ──
function VistaCumpleanos({ datos, municipios, verFicha }: Props) {
  const hoy = new Date()
  const [mes, setMes] = useState(hoy.getMonth() + 1)
  const conFecha = datos.tramitadores.filter(p => p.cumpleDia && p.cumpleMes)
  const sinFecha = datos.tramitadores.filter(p => !p.cumpleDia || !p.cumpleMes)
  const proximos = conFecha.map(p => ({ p, dias: diasParaCumple(p, hoy)! })).sort((a, b) => a.dias - b.dias)
  const deHoy = proximos.filter(x => x.dias === 0)

  const fila = (p: PersonaDirectorio, dias?: number) => {
    const residencia = p.residenciaId ? municipios.get(p.residenciaId) : undefined
    return (
      <div key={p.id} className="flex items-center gap-3 border-b border-slate-100 py-2 last:border-0">
        <span className={clsx("flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg border leading-none", dias === 0 ? "border-sky-600 bg-sky-600 text-white" : "border-slate-200 bg-slate-50 text-slate-700")}>
          <b className="text-base">{p.cumpleDia}</b><span className="text-[9px] uppercase">{MESES[p.cumpleMes! - 1].slice(0, 3)}</span>
        </span>
        <span className="min-w-0 flex-1">
          <button type="button" onClick={() => verFicha(p)} className="text-sm font-medium text-slate-700 hover:text-sky-700 hover:underline">{p.nombre}</button>
          <span className="block text-[11px] text-slate-400">{p.esMensajero ? "Mensajero propio" : "Tramitador"} · {residencia ? tituloMunicipio(residencia.nombre) : p.ciudad || "—"}</span>
        </span>
        {dias !== undefined && (
          <span className={clsx("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold", dias === 0 ? "border-sky-200 bg-sky-50 text-sky-700" : dias <= 7 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 text-slate-500")}>
            {dias === 0 ? "¡Hoy!" : dias === 1 ? "Mañana" : `En ${dias} días`}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {deHoy.length > 0 && (
        <div className="flex items-center gap-4 rounded-xl border border-sky-200 bg-sky-50 px-5 py-4">
          <Cake size={30} className="shrink-0 text-sky-600" />
          <div>
            <p className="text-xs font-semibold text-sky-700">Hoy cumple{deHoy.length > 1 ? "n" : ""} años</p>
            {deHoy.map(x => (
              <p key={x.p.id} className="text-base font-semibold text-slate-800">
                {x.p.nombre} {celular(x.p.whatsapp) && <span className="text-xs font-normal text-slate-500">· {celular(x.p.whatsapp)}</span>}
              </p>
            ))}
          </div>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className={claseTarjeta}>
          <h3 className="text-sm font-semibold text-slate-800">Próximos 30 días</h3>
          {proximos.filter(x => x.dias <= 30).map(x => fila(x.p, x.dias))}
          {!proximos.some(x => x.dias <= 30) && <p className="mt-2 text-xs text-slate-400">Nadie cumple años en los próximos 30 días.</p>}
        </section>
        <section className={claseTarjeta}>
          <div className="flex items-center gap-2">
            <h3 className="flex-1 text-sm font-semibold capitalize text-slate-800">{MESES[mes - 1]}</h3>
            <select value={mes} onChange={e => setMes(Number(e.target.value))} className={clsx(claseInput, "h-8 w-auto text-xs")} aria-label="Mes">
              {MESES.map((m, i) => <option key={m} value={i + 1}>{m.charAt(0).toUpperCase() + m.slice(1)} · {conFecha.filter(p => p.cumpleMes === i + 1).length}</option>)}
            </select>
          </div>
          {conFecha.filter(p => p.cumpleMes === mes).sort((a, b) => a.cumpleDia! - b.cumpleDia!).map(p => fila(p))}
          {!conFecha.some(p => p.cumpleMes === mes) && <p className="mt-2 text-xs text-slate-400">No hay cumpleaños registrados en {MESES[mes - 1]}.</p>}
        </section>
      </div>
      {sinFecha.length > 0 && (
        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer">{sinFecha.length} de {datos.tramitadores.length} personas no tienen fecha de cumpleaños (se llena en Catálogos → Tramitadores)</summary>
          <div className="mt-2 flex flex-wrap gap-1">
            {sinFecha.map(p => <button key={p.id} type="button" onClick={() => verFicha(p)} className="rounded-full border border-slate-200 px-2 py-0.5 hover:border-sky-300 hover:text-sky-700">{p.nombre}</button>)}
          </div>
        </details>
      )}
    </div>
  )
}
