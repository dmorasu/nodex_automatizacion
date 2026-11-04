"use client"

import { useCallback, useMemo, useState } from "react"
import clsx from "clsx"
import { ArrowLeft, X } from "lucide-react"
import { ordenarPersonas, tituloMunicipio, type DatosDirectorio, type MunicipioDirectorio, type PersonaDirectorio } from "@/src/directorio"
import { Avatar, Etiquetas } from "./FichaPersona"
import MapaCobertura, { COLOR_MENS, COLOR_TRAM, type Categoria, type PuntoCobertura } from "./MapaCobertura"

const claseTarjeta = "rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
const claseSelect = "h-9 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"

type Tipo = "todos" | "tramitador" | "mensajero"
type Foco = { tipo: "resumen" } | { tipo: "depto", nombre: string } | { tipo: "municipio", id: number }

const conCoordenadas = (m: MunicipioDirectorio | undefined): m is MunicipioDirectorio & { latitud: number, longitud: number } =>
  Boolean(m && m.latitud != null && m.longitud != null)

function Numeros({ items }: { items: [number | string, string, string?][] }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map(([v, k, color]) => (
        <div key={k} className="rounded-lg bg-slate-50 px-2 py-2 text-center">
          <p className={clsx("truncate font-semibold tabular-nums", typeof v === "string" ? "text-sm leading-7" : "text-xl", color ?? "text-slate-800")}>{typeof v === "number" ? v.toLocaleString("es-CO") : v}</p>
          <p className="text-[10px] text-slate-500">{k}</p>
        </div>
      ))}
    </div>
  )
}

const Rotulo = ({ children }: { children: React.ReactNode }) => <p className="mb-1.5 mt-4 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{children}</p>

// Cobertura: mapa de Google con los municipios cubiertos, panel de foco (país, departamento,
// municipio o persona) y rankings, como en el HTML de Torre de control
export default function VistaCobertura({ datos, municipios, cobertura, elegirMunicipio, verFicha }: {
  datos: DatosDirectorio
  municipios: Map<number, MunicipioDirectorio>
  cobertura: Map<number, PersonaDirectorio[]>
  elegirMunicipio: (id: number | null) => void
  verFicha: (p: PersonaDirectorio) => void
}) {
  const [tipo, setTipo] = useState<Tipo>("todos")
  const [regional, setRegional] = useState("")
  const [personaId, setPersonaId] = useState<number | null>(null)
  const [foco, setFoco] = useState<Foco>({ tipo: "resumen" })

  const persona = personaId ? datos.tramitadores.find(p => p.id === personaId) ?? null : null
  const regionales = useMemo(() => [...new Set(datos.municipios.map(m => m.regional).filter((r): r is string => Boolean(r)))].sort(), [datos])

  // Quién atiende cada municipio con los filtros de tipo y persona
  const filtradas = useCallback((id: number) => (cobertura.get(id) ?? []).filter(p =>
    (tipo === "todos" || (tipo === "mensajero") === p.esMensajero) && (!personaId || p.id === personaId)), [cobertura, tipo, personaId])
  const categoria = useCallback((id: number): Categoria => {
    const ps = filtradas(id)
    if (!ps.length) return "none"
    const m = ps.some(p => p.esMensajero), t = ps.some(p => !p.esMensajero)
    return m && t ? "ambos" : m ? "mens" : "tram"
  }, [filtradas])

  const visibles = useMemo(() => datos.municipios.filter(m => !regional || m.regional === regional), [datos, regional])

  // Departamentos ordenados por municipios cubiertos (con los filtros)
  const departamentos = useMemo(() => {
    const mapa = new Map<string, { nombre: string, regional: string | null, munis: MunicipioDirectorio[] }>()
    for (const m of visibles) {
      const d = mapa.get(m.departamento) ?? { nombre: m.departamento, regional: m.regional, munis: [] }
      d.munis.push(m)
      mapa.set(m.departamento, d)
    }
    return [...mapa.values()].map(d => {
      const cubiertos = d.munis.filter(m => filtradas(m.id).length)
      const personas = new Map<number, PersonaDirectorio>()
      cubiertos.forEach(m => filtradas(m.id).forEach(p => personas.set(p.id, p)))
      const top = cubiertos.map(m => ({ m, n: filtradas(m.id).length })).sort((a, b) => b.n - a.n || a.m.nombre.localeCompare(b.m.nombre, "es"))[0]
      return { ...d, cubiertos, personas: [...personas.values()].sort(ordenarPersonas), top }
    }).sort((a, b) => b.cubiertos.length - a.cubiertos.length || a.nombre.localeCompare(b.nombre, "es"))
  }, [visibles, filtradas])

  const focoDepto = foco.tipo === "depto" ? departamentos.find(d => d.nombre === foco.nombre) ?? null : null
  const focoMuni = foco.tipo === "municipio" ? municipios.get(foco.id) ?? null : null

  // Puntos del mapa: los cubiertos (con filtros) y, al enfocar un departamento, también los que no
  const puntos: PuntoCobertura[] = useMemo(() => {
    const deptoGris = focoDepto?.nombre ?? (focoMuni?.departamento ?? null)
    return visibles.filter(conCoordenadas).flatMap(m => {
      const c = categoria(m.id)
      if (c === "none" && m.departamento !== deptoGris) return []
      const n = filtradas(m.id).length
      return [{ id: m.id, lat: m.latitud!, lng: m.longitud!, categoria: c, personas: n, titulo: `${tituloMunicipio(m.nombre)} · ${n ? `${n} persona${n === 1 ? "" : "s"}` : "sin cobertura"}` }]
    })
  }, [visibles, categoria, filtradas, focoDepto, focoMuni])

  // Encuadre: departamento enfocado, persona, regional o lo cubierto en el país
  const encuadre = useMemo(() => {
    const base = focoDepto ? focoDepto.munis : focoMuni ? datos.municipios.filter(m => m.departamento === focoMuni.departamento) : visibles.filter(m => filtradas(m.id).length)
    const extra = persona?.residenciaId ? [municipios.get(persona.residenciaId)] : []
    const pts = [...base, ...extra].filter(conCoordenadas).map(m => ({ lat: m.latitud, lng: m.longitud }))
    return { clave: JSON.stringify([tipo, regional, personaId, focoDepto?.nombre ?? null, focoMuni?.departamento ?? null]), puntos: pts }
  }, [focoDepto, focoMuni, visibles, filtradas, persona, municipios, datos, tipo, regional, personaId])

  const residencia = persona?.residenciaId ? municipios.get(persona.residenciaId) : undefined
  const casa = residencia && conCoordenadas(residencia) ? { lat: residencia.latitud, lng: residencia.longitud, titulo: `Reside en ${tituloMunicipio(residencia.nombre)}` } : null

  const alTocarMunicipio = useCallback((id: number) => setFoco({ tipo: "municipio", id }), [])

  // ── Indicadores y rankings (sin filtros, como en el HTML) ──
  const mensajeros = datos.tramitadores.filter(p => p.esMensajero).length
  const deptosTodos = useMemo(() => {
    const m = new Map<string, { total: number, cubiertos: number, conMensajero: number }>()
    for (const x of datos.municipios) {
      const lista = cobertura.get(x.id) ?? []
      const d = m.get(x.departamento) ?? { total: 0, cubiertos: 0, conMensajero: 0 }
      d.total++
      if (lista.length) { d.cubiertos++; if (lista.some(p => p.esMensajero)) d.conMensajero++ }
      m.set(x.departamento, d)
    }
    return m
  }, [datos, cobertura])
  const porRegional = useMemo(() => regionales.map(r => {
    const ms = datos.municipios.filter(m => m.regional === r)
    const cub = ms.filter(m => cobertura.has(m.id))
    const pers = new Map<number, PersonaDirectorio>()
    cub.forEach(m => cobertura.get(m.id)!.forEach(p => pers.set(p.id, p)))
    const t = [...pers.values()].filter(p => !p.esMensajero).length
    return { r, total: ms.length, cub: cub.length, t, m: pers.size - t }
  }).sort((a, b) => b.cub - a.cub), [regionales, datos, cobertura])
  const rankingDeptos = [...deptosTodos.entries()].filter(([, d]) => d.cubiertos).sort((a, b) => b[1].cubiertos - a[1].cubiertos).slice(0, 12)
  const maxDepto = Math.max(1, ...rankingDeptos.map(([, d]) => d.cubiertos))
  const rankingPersonas = [...datos.tramitadores].sort((a, b) => b.cobertura.length - a.cobertura.length || a.nombre.localeCompare(b.nombre, "es")).slice(0, 10)
  const maxPersona = Math.max(1, ...rankingPersonas.map(p => p.cobertura.length))

  const elegirPersona = (id: number | null) => { setPersonaId(id); setFoco({ tipo: "resumen" }) }
  const chipPersona = (p: PersonaDirectorio) => (
    <button key={p.id} type="button" onClick={() => verFicha(p)} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 py-0.5 pl-0.5 pr-2.5 text-[11px] text-slate-700 hover:border-sky-300">
      <Avatar persona={p} pequeno /> {p.nombre.split(" ").slice(0, 2).join(" ")}
    </button>
  )
  const chipMunicipio = (m: MunicipioDirectorio) => {
    const c = categoria(m.id)
    return (
      <button key={m.id} type="button" onClick={() => setFoco({ tipo: "municipio", id: m.id })} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600 hover:border-sky-300 hover:text-sky-700">
        <span className="h-2 w-2 rounded-full" style={{ background: c === "mens" ? COLOR_MENS : c === "none" ? "#cbd5e1" : COLOR_TRAM }} />{tituloMunicipio(m.nombre)}
      </button>
    )
  }

  // ── Panel de foco ──
  let panel: React.ReactNode
  if (focoMuni) {
    const ps = filtradas(focoMuni.id).sort(ordenarPersonas)
    panel = (
      <>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Municipio · {tituloMunicipio(focoMuni.departamento)}</p>
        <h3 className="mb-3 text-2xl font-semibold text-slate-800">{tituloMunicipio(focoMuni.nombre)}</h3>
        <Numeros items={[[ps.length, "Personas"], [ps.filter(p => !p.esMensajero).length, "Tramitadores", "text-sky-700"], [ps.filter(p => p.esMensajero).length, "Mensajeros", "text-emerald-700"]]} />
        <Rotulo>Quién lo atiende</Rotulo>
        {ps.length ? <div className="flex flex-wrap gap-1.5">{ps.map(chipPersona)}</div> : <p className="text-xs text-slate-500">Nadie tiene asignado este municipio. Escale a Torre de control.</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => elegirMunicipio(focoMuni.id)} className="rounded-md bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700">Ver fichas y contactos</button>
          <button type="button" onClick={() => setFoco({ tipo: "depto", nombre: focoMuni.departamento })} className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Ver {tituloMunicipio(focoMuni.departamento)}</button>
        </div>
      </>
    )
  } else if (persona) {
    const cubre = persona.cobertura.map(id => municipios.get(id)).filter((m): m is MunicipioDirectorio => Boolean(m)).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
    panel = (
      <>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{persona.esMensajero ? "Mensajero propio" : "Tramitador"}</p>
        <h3 className="mb-3 text-2xl font-semibold text-slate-800">{persona.nombre}</h3>
        <Numeros items={[[cubre.length, "Municipios"], [new Set(cubre.map(m => m.departamento)).size, "Departamentos", "text-sky-700"], [residencia ? tituloMunicipio(residencia.nombre) : "—", "Reside en", "text-emerald-700"]]} />
        <div className="mt-3"><Etiquetas persona={persona} /></div>
        <Rotulo>Municipios que cubre</Rotulo>
        <div className="flex max-h-48 flex-wrap gap-1 overflow-y-auto">{cubre.map(chipMunicipio)}</div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => verFicha(persona)} className="rounded-md bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700">Ver ficha completa</button>
          <button type="button" onClick={() => elegirPersona(null)} className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Quitar filtro</button>
        </div>
      </>
    )
  } else if (focoDepto) {
    const puesto = departamentos.findIndex(d => d.nombre === focoDepto.nombre)
    const tram = focoDepto.personas.filter(p => !p.esMensajero).length
    panel = (
      <>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          {focoDepto.cubiertos.length ? `Puesto ${puesto + 1} de ${departamentos.filter(d => d.cubiertos.length).length}` : "Departamento"}{focoDepto.regional ? ` · Regional ${tituloMunicipio(focoDepto.regional)}` : ""}
        </p>
        <h3 className="mb-3 text-2xl font-semibold text-slate-800">{tituloMunicipio(focoDepto.nombre)}</h3>
        <Numeros items={[[focoDepto.cubiertos.length, `Municipios de ${focoDepto.munis.length}`], [tram, "Tramitadores", "text-sky-700"], [focoDepto.personas.length - tram, "Mensajeros", "text-emerald-700"]]} />
        {focoDepto.top
          ? <><Rotulo>Municipio con más apoyo</Rotulo><p className="text-xs text-slate-700">{tituloMunicipio(focoDepto.top.m.nombre)} · {focoDepto.top.n} persona{focoDepto.top.n === 1 ? "" : "s"}</p></>
          : <><Rotulo>Sin cobertura</Rotulo><p className="text-xs text-slate-500">Ningún municipio de este departamento tiene persona asignada.</p></>}
        {focoDepto.personas.length > 0 && (
          <><Rotulo>Equipo en el departamento</Rotulo>
            <div className="flex flex-wrap gap-1.5">{focoDepto.personas.slice(0, 10).map(chipPersona)}{focoDepto.personas.length > 10 && <span className="self-center text-[11px] text-slate-400">+{focoDepto.personas.length - 10} más</span>}</div></>
        )}
        {focoDepto.cubiertos.length > 0 && (
          <><Rotulo>Municipios</Rotulo>
            <div className="flex flex-wrap gap-1">{[...focoDepto.cubiertos].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")).slice(0, 18).map(chipMunicipio)}{focoDepto.cubiertos.length > 18 && <span className="self-center text-[11px] text-slate-400">+{focoDepto.cubiertos.length - 18} más</span>}</div></>
        )}
        <p className="mt-3 text-[11px] text-slate-400">En el mapa salen en gris los municipios del departamento sin cobertura.</p>
      </>
    )
  } else {
    const cubiertos = visibles.filter(m => filtradas(m.id).length)
    const cats = { tram: 0, mens: 0, ambos: 0 }
    cubiertos.forEach(m => { const c = categoria(m.id); if (c !== "none") cats[c]++ })
    panel = (
      <>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{regional ? `Regional ${tituloMunicipio(regional)}` : "Todo el país"}</p>
        <h3 className="mb-3 text-2xl font-semibold text-slate-800">Resumen de cobertura</h3>
        <Numeros items={[[cubiertos.length, `Municipios de ${visibles.length.toLocaleString("es-CO")}`], [cats.tram + cats.ambos, "Con tramitador", "text-sky-700"], [cats.mens + cats.ambos, "Con mensajeros", "text-emerald-700"]]} />
        <Rotulo>Departamentos con más cobertura</Rotulo>
        <div className="flex flex-wrap gap-1">
          {departamentos.filter(d => d.cubiertos.length).slice(0, 10).map(d => (
            <button key={d.nombre} type="button" onClick={() => setFoco({ tipo: "depto", nombre: d.nombre })} className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600 hover:border-sky-300 hover:text-sky-700">
              {tituloMunicipio(d.nombre)} · {d.cubiertos.length}
            </button>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-slate-400">Toque un municipio en el mapa o un departamento para ver quién lo atiende.</p>
      </>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {([
          [datos.tramitadores.length - mensajeros, "Tramitadores en la red", "text-sky-700", ""],
          [mensajeros, "Mensajeros propios", "text-emerald-700", ""],
          [cobertura.size, `Municipios con cobertura · ${(cobertura.size / Math.max(1, datos.municipios.length) * 100).toLocaleString("es-CO", { maximumFractionDigits: 1 })} %`, "", `/ ${datos.municipios.length.toLocaleString("es-CO")}`],
          [[...deptosTodos.values()].filter(d => d.cubiertos).length, "Departamentos con presencia", "", `/ ${deptosTodos.size}`]
        ] as [number, string, string, string][]).map(([v, k, color, detalle]) => (
          <div key={k} className={claseTarjeta}>
            <p className={clsx("text-2xl font-semibold tabular-nums", color || "text-slate-800")}>{v.toLocaleString("es-CO")}{detalle && <span className="text-sm font-medium text-slate-400"> {detalle}</span>}</p>
            <p className="text-xs text-slate-500">{k}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg bg-slate-100 p-0.5" role="group" aria-label="Tipo">
          {([["todos", "Todos"], ["tramitador", "Tramitadores"], ["mensajero", "Mensajeros propios"]] as const).map(([v, n]) => (
            <button key={v} type="button" onClick={() => { setTipo(v); setFoco({ tipo: "resumen" }) }} aria-pressed={tipo === v}
              className={clsx("rounded-md px-3 py-1.5 text-xs font-semibold", tipo === v ? "bg-white text-sky-700 shadow-sm" : "text-slate-500")}>{n}</button>
          ))}
        </div>
        <select value={regional} onChange={e => { setRegional(e.target.value); setFoco({ tipo: "resumen" }) }} className={claseSelect} aria-label="Regional">
          <option value="">Todas las regionales</option>
          {regionales.map(r => <option key={r} value={r}>{tituloMunicipio(r)}</option>)}
        </select>
        <select value={personaId ?? ""} onChange={e => elegirPersona(Number(e.target.value) || null)} className={claseSelect} aria-label="Persona">
          <option value="">Todas las personas</option>
          {[...datos.tramitadores].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")).map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        {(tipo !== "todos" || regional || personaId || foco.tipo !== "resumen") && (
          <button type="button" onClick={() => { setTipo("todos"); setRegional(""); setPersonaId(null); setFoco({ tipo: "resumen" }) }} className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:underline">
            <X size={13} /> Quitar filtros
          </button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className={claseTarjeta}>
          <div className="mb-3 flex items-center gap-2">
            <h3 className="flex-1 text-sm font-semibold text-slate-800">
              Cobertura en {focoDepto ? tituloMunicipio(focoDepto.nombre) : focoMuni ? tituloMunicipio(focoMuni.departamento) : regional ? `la regional ${tituloMunicipio(regional)}` : persona ? `los municipios de ${persona.nombre.split(" ")[0]}` : "Colombia"}
            </h3>
            {foco.tipo !== "resumen" && (
              <button type="button" onClick={() => setFoco({ tipo: "resumen" })} className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:underline"><ArrowLeft size={13} /> {regional ? "Regional" : "Colombia"}</button>
            )}
          </div>
          <MapaCobertura puntos={puntos} encuadre={encuadre} elegido={focoMuni?.id ?? null} casa={casa} onMunicipio={alTocarMunicipio} />
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border-2 border-white shadow" style={{ background: COLOR_TRAM }} /> Tramitadores</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border-2 border-white shadow" style={{ background: COLOR_MENS }} /> Mensajeros propios</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full shadow" style={{ background: COLOR_TRAM, border: `2px solid ${COLOR_MENS}` }} /> Ambos</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-slate-300" /> Sin cobertura</span>
            <span>El tamaño indica cuántas personas lo atienden{casa ? " · ⌂ donde reside" : ""}</span>
          </div>
        </div>
        <div className={clsx(claseTarjeta, "lg:self-start")}>{panel}</div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className={claseTarjeta}>
          <h3 className="text-sm font-semibold text-slate-800">Por regional</h3>
          <p className="mb-2 text-[11px] text-slate-400">Toque una regional para enfocarla.</p>
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase tracking-wide text-slate-400">
              <tr><th className="pb-2 text-left font-semibold">Regional</th><th className="pb-2 text-right font-semibold">Cubiertos</th><th className="pb-2 text-right font-semibold">Tram.</th><th className="pb-2 text-right font-semibold">Mens.</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {porRegional.map(s => (
                <tr key={s.r} className={clsx(regional === s.r && "bg-sky-50")}>
                  <td className="py-2 pr-2">
                    <button type="button" onClick={() => { setRegional(regional === s.r ? "" : s.r); setFoco({ tipo: "resumen" }) }} className="font-medium text-sky-700 hover:underline">{tituloMunicipio(s.r)}</button>
                    <div className="mt-1 h-1.5 rounded-full bg-slate-100"><div className="h-1.5 rounded-full bg-sky-500" style={{ width: `${s.cub / Math.max(1, s.total) * 100}%` }} /></div>
                  </td>
                  <td className="py-2 text-right tabular-nums">{s.cub} / {s.total}</td>
                  <td className="py-2 text-right tabular-nums">{s.t}</td>
                  <td className="py-2 text-right tabular-nums">{s.m || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className={claseTarjeta}>
          <h3 className="text-sm font-semibold text-slate-800">Departamentos con más cobertura</h3>
          <p className="mb-3 text-[11px] text-slate-400"><span className="inline-block h-2 w-2 rounded-full" style={{ background: COLOR_MENS }} /> con mensajeros propios · <span className="inline-block h-2 w-2 rounded-full" style={{ background: COLOR_TRAM }} /> tramitadores</p>
          <div className="space-y-1">
            {rankingDeptos.map(([nombre, d]) => (
              <button key={nombre} type="button" onClick={() => setFoco({ tipo: "depto", nombre })}
                className={clsx("grid w-full grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs hover:bg-slate-50", focoDepto?.nombre === nombre && "bg-sky-50")}>
                <span className="truncate">{tituloMunicipio(nombre)}</span>
                <span className="flex h-2 overflow-hidden rounded-full bg-slate-100">
                  <span style={{ width: `${d.conMensajero / maxDepto * 100}%`, background: COLOR_MENS }} />
                  <span style={{ width: `${(d.cubiertos - d.conMensajero) / maxDepto * 100}%`, background: COLOR_TRAM }} />
                </span>
                <span className="tabular-nums font-semibold">{d.cubiertos}<span className="font-normal text-slate-400">/{d.total}</span></span>
              </button>
            ))}
          </div>
        </section>

        <section className={claseTarjeta}>
          <h3 className="text-sm font-semibold text-slate-800">Quién cubre más municipios</h3>
          <p className="mb-3 text-[11px] text-slate-400">Toque una persona para ver su cobertura.</p>
          <div className="space-y-1">
            {rankingPersonas.map(p => (
              <button key={p.id} type="button" onClick={() => elegirPersona(personaId === p.id ? null : p.id)}
                className={clsx("grid w-full grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs hover:bg-slate-50", personaId === p.id && "bg-sky-50")}>
                <span className="truncate">{p.nombre}</span>
                <span className="flex h-2 overflow-hidden rounded-full bg-slate-100"><span style={{ width: `${p.cobertura.length / maxPersona * 100}%`, background: p.esMensajero ? COLOR_MENS : COLOR_TRAM }} /></span>
                <span className="tabular-nums font-semibold">{p.cobertura.length}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
