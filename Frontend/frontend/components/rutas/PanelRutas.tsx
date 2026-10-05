"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import clsx from "clsx"
import { Check, Loader2, Map as IconoMapa } from "lucide-react"
import { llamarApi } from "@/src/lib/apiCliente"
import { claveMapaGoogle } from "@/src/lib/googleMaps"
import {
  COLOR_ESTADO,
  NOMBRE_ESTADO_PARADA,
  colorMensajero,
  decodificarPolyline,
  puntosRuta,
  type Parada,
  type PuntoMapa,
  type RutaEnMapa,
  type RutaMensajero
} from "@/src/rutas"
import RutaMensajeroCard from "./RutaMensajeroCard"

const cargandoMapa = () => <div className="flex h-full items-center justify-center rounded-lg bg-slate-50 text-xs text-slate-400">Cargando mapa…</div>
const MapaGoogle = dynamic(() => import("./MapaRutasGoogle"), { ssr: false, loading: cargandoMapa })
const MapaLibre = dynamic(() => import("./MapaRutaLeaflet"), { ssr: false, loading: cargandoMapa })

const MAXIMO_PUNTOS_TRAZADO = 27 // igual que el backend (límite de Google Routes)

type Trazado = { puntos: PuntoMapa[] | null, km: number | null, minutos: number | null }

// Rutas del día: un solo mapa con los mensajeros elegidos (cada uno de un color, con la
// ruta por las calles) y debajo la tarjeta de cada mensajero para ordenar y revisar.
export default function PanelRutas({ rutas, fecha, googleDisponible }: { rutas: RutaMensajero[], fecha: string, googleDisponible: boolean }) {
  // Paradas en el orden actual de cada mensajero (las tarjetas avisan cuando se reordenan)
  const [paradas, setParadas] = useState<Record<number, Parada[]>>({})
  useEffect(() => setParadas(Object.fromEntries(rutas.map(r => [r.mensajero.id, r.paradas]))), [rutas])

  // Mensajeros visibles en el mapa: al inicio, todos los que tienen paradas
  const [visibles, setVisibles] = useState<Set<number>>(() => new Set(rutas.filter(r => r.paradas.length).map(r => r.mensajero.id)))
  useEffect(() => setVisibles(new Set(rutas.filter(r => r.paradas.length).map(r => r.mensajero.id))), [rutas])

  const mapaRef = useRef<HTMLDivElement>(null)
  const colores = useMemo(() => Object.fromEntries(rutas.map((r, i) => [r.mensajero.id, colorMensajero(i)])), [rutas])

  // Trazado por las calles de cada ruta visible. Se pide al backend (Google Routes) y se
  // guarda por puntos: si no cambia el orden, no se vuelve a pedir.
  const [trazados, setTrazados] = useState<Record<string, Trazado>>({})
  const [trazando, setTrazando] = useState(0)
  const pedidos = useRef(new Set<string>())

  const claveRuta = (id: number) => {
    const ruta = rutas.find(r => r.mensajero.id === id)
    return ruta ? JSON.stringify(puntosRuta(ruta.sede, paradas[id] ?? ruta.paradas)) : ""
  }

  useEffect(() => {
    if (!googleDisponible) return
    for (const id of visibles) {
      const clave = claveRuta(id)
      const puntos: PuntoMapa[] = clave ? JSON.parse(clave) : []
      if (puntos.length < 2 || puntos.length > MAXIMO_PUNTOS_TRAZADO || pedidos.current.has(clave)) continue
      pedidos.current.add(clave)
      setTrazando(n => n + 1)
      llamarApi<{ polyline: string | null, km: number | null, minutos: number | null }>("/mensajeria/trazado", "POST", {
        puntos: puntos.map(([latitud, longitud]) => ({ latitud, longitud }))
      }).then(r => {
        setTrazados(actuales => ({
          ...actuales,
          [clave]: r.ok && r.datos.polyline
            ? { puntos: decodificarPolyline(r.datos.polyline), km: r.datos.km, minutos: r.datos.minutos }
            : { puntos: null, km: null, minutos: null }
        }))
      }).finally(() => setTrazando(n => n - 1))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibles, paradas, googleDisponible])

  // Solo cambia cuando cambian las rutas visibles, su orden o su trazado (así el mapa no se
  // redibuja ni se reencuadra por otros cambios de la pantalla)
  const enMapa: RutaEnMapa[] = useMemo(() => rutas
    .filter(r => visibles.has(r.mensajero.id))
    .map(r => ({
      id: r.mensajero.id,
      nombre: r.mensajero.nombre,
      color: colores[r.mensajero.id],
      sede: r.sede,
      paradas: paradas[r.mensajero.id] ?? r.paradas,
      trazado: trazados[claveRuta(r.mensajero.id)]?.puntos ?? null
    // eslint-disable-next-line react-hooks/exhaustive-deps
    })), [rutas, visibles, paradas, trazados, colores])

  const alternar = (id: number) => setVisibles(actuales => {
    const nuevos = new Set(actuales)
    if (nuevos.has(id)) nuevos.delete(id)
    else nuevos.add(id)
    return nuevos
  })

  const verSolo = (id: number) => {
    setVisibles(new Set([id]))
    mapaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const conParadas = rutas.filter(r => r.paradas.length)

  return (
    <div className="space-y-6">

      {/* MAPA DEL DÍA */}
      <section ref={mapaRef} className="scroll-mt-4 rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <IconoMapa size={16} className="text-sky-500" /> Mapa del día
            {trazando > 0 && <span className="inline-flex items-center gap-1 text-[11px] font-normal text-slate-400"><Loader2 size={12} className="animate-spin" /> Trazando rutas…</span>}
          </h2>
          {conParadas.length > 1 && (
            <div className="flex gap-3 text-[11px] font-semibold">
              <button type="button" onClick={() => setVisibles(new Set(conParadas.map(r => r.mensajero.id)))} className="text-sky-700 hover:underline">Ver todos</button>
              <button type="button" onClick={() => setVisibles(new Set())} className="text-slate-500 hover:underline">Ninguno</button>
            </div>
          )}
        </div>

        {/* Mensajeros: casilla para mostrar u ocultar su ruta */}
        <div className="flex flex-wrap gap-2 px-5 pt-3">
          {rutas.map(r => {
            const visible = visibles.has(r.mensajero.id)
            const t = trazados[claveRuta(r.mensajero.id)]
            const color = colores[r.mensajero.id]
            const sinParadas = r.paradas.length === 0
            return (
              <button
                key={r.mensajero.id}
                type="button"
                onClick={() => alternar(r.mensajero.id)}
                disabled={sinParadas}
                aria-pressed={visible}
                className={clsx(
                  "inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs transition disabled:cursor-not-allowed disabled:opacity-40",
                  visible ? "border-slate-300 bg-white shadow-sm" : "border-slate-200 bg-slate-50 text-slate-500"
                )}
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded" style={{ backgroundColor: visible ? color : "transparent", border: `2px solid ${color}` }}>
                  {visible && <Check size={11} strokeWidth={3} className="text-white" />}
                </span>
                <span>
                  <span className="block font-semibold text-slate-700">{r.mensajero.nombre}</span>
                  <span className="block text-[10px] text-slate-400">
                    {sinParadas ? "Sin diligencias" : `${r.resumen.total} parada(s)`}
                    {t?.km != null && ` · ${t.km} km`}
                    {t?.minutos != null && ` · ${t.minutos} min`}
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        <div className="p-5 pt-3">
          <div className="relative z-0 h-[520px]">
            {enMapa.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400">
                {conParadas.length ? "Marque uno o más mensajeros para ver su ruta." : "No hay diligencias para este día."}
              </div>
            ) : claveMapaGoogle ? <MapaGoogle rutas={enMapa} /> : <MapaLibre rutas={enMapa} />}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
            <span>Borde del número:</span>
            {Object.entries(NOMBRE_ESTADO_PARADA).map(([estado, nombre]) => (
              <span key={estado} className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full border-[3px] bg-slate-400" style={{ borderColor: estado === "PENDIENTE" ? "#fff" : COLOR_ESTADO[estado as Parada["estado"]], boxShadow: "0 0 0 1px #cbd5e1" }} aria-hidden="true" />
                {nombre}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5">
              <span className="flex h-3.5 w-3.5 items-center justify-center rounded bg-slate-900 text-[8px] font-bold text-white" aria-hidden="true">S</span>
              Sede
            </span>
            {googleDisponible
              ? <span>· Línea continua: ruta por las calles; punteada: sin trazado (más de 25 paradas o sin respuesta de Google)</span>
              : <span>· Líneas rectas entre paradas (Google no está configurado)</span>}
          </div>
        </div>
      </section>

      {/* TARJETA DE CADA MENSAJERO */}
      {rutas.map(ruta => (
        <RutaMensajeroCard
          key={`${ruta.mensajero.id}-${fecha}`}
          ruta={ruta}
          fecha={fecha}
          googleDisponible={googleDisponible}
          color={colores[ruta.mensajero.id]}
          onParadas={nuevas => setParadas(actuales => ({ ...actuales, [ruta.mensajero.id]: nuevas }))}
          onVerEnMapa={() => verSolo(ruta.mensajero.id)}
        />
      ))}
    </div>
  )
}
