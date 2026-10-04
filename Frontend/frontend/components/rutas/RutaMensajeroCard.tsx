"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "react-toastify"
import clsx from "clsx"
import { ArrowDown, ArrowUp, Camera, ExternalLink, Loader2, MapPin, MapPinOff, Navigation, Sparkles } from "lucide-react"
import { llamarApi } from "@/src/lib/apiCliente"
import {
  COLOR_ESTADO,
  NOMBRE_ESTADO_PARADA,
  distanciaMetros,
  enlacesGoogleMaps,
  type Parada,
  type RutaMensajero
} from "@/src/rutas"
import ModalUbicacion from "./ModalUbicacion"

const Mapa = dynamic(() => import("./MapaRutaLeaflet"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center rounded-lg bg-slate-50 text-xs text-slate-400">Cargando mapa…</div>
})

const claseBoton = "inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"

const hora = (iso: string) => new Date(iso).toLocaleTimeString("es-CO", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit" })

// Ruta del día de un mensajero: mapa + lista ordenable + lo que confirmó en campo
export default function RutaMensajeroCard({ ruta, fecha, googleDisponible }: { ruta: RutaMensajero, fecha: string, googleDisponible: boolean }) {
  const router = useRouter()
  const [paradas, setParadas] = useState<Parada[]>(ruta.paradas)
  const [guardando, setGuardando] = useState(false)
  const [optimizando, setOptimizando] = useState(false)
  const [ubicando, setUbicando] = useState<Parada | null>(null)

  useEffect(() => setParadas(ruta.paradas), [ruta.paradas])

  const { mensajero, sede, resumen } = ruta
  const enlaces = enlacesGoogleMaps(sede, paradas.filter(p => p.estado === "PENDIENTE"))

  // Sube o baja una parada y guarda el orden
  const mover = async (indice: number, paso: -1 | 1) => {
    const destino = indice + paso
    if (destino < 0 || destino >= paradas.length) return
    const nuevas = [...paradas]
    ;[nuevas[indice], nuevas[destino]] = [nuevas[destino], nuevas[indice]]
    const reordenadas = nuevas.map((p, i) => ({ ...p, orden: i + 1 }))
    setParadas(reordenadas)
    setGuardando(true)
    const r = await llamarApi(`/mensajeria/rutas/${mensajero.id}/orden`, "PUT", { fecha, paradaIds: reordenadas.map(p => p.id) })
    setGuardando(false)
    if (!r.ok) {
      toast.error(r.error)
      setParadas(ruta.paradas)
    }
  }

  const optimizar = async () => {
    setOptimizando(true)
    const r = await llamarApi<{ metodo: string, kilometros: number, minutos: number | null, sinUbicacion: number }>(
      `/mensajeria/rutas/${mensajero.id}/optimizar`, "POST", { fecha }
    )
    setOptimizando(false)
    if (!r.ok) return toast.error(r.error)
    const { metodo, kilometros, minutos, sinUbicacion } = r.datos
    toast.success(metodo === "GOOGLE"
      ? `Ruta optimizada con Google: ${kilometros} km${minutos ? ` · ${minutos} min` : ""} (ida y vuelta a la sede)`
      : `Ruta ordenada por cercanía: ~${kilometros} km en línea recta`)
    if (sinUbicacion) toast.warning(`${sinUbicacion} parada(s) sin ubicación quedaron al final`)
    router.refresh()
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* ENCABEZADO */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">{mensajero.nombre}</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            {sede ? `Sale de ${sede.nombre}` : "Sin sede asignada"} · {resumen.total} parada(s)
            {resumen.total > 0 && ` · ${resumen.entregadas} entregada(s)`}
            {resumen.noSePudo > 0 && ` · ${resumen.noSePudo} no se pudo`}
          </p>
        </div>
        {paradas.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={optimizar} disabled={optimizando || guardando} className={claseBoton}
              title={googleDisponible ? "Orden óptimo por calles con Google" : "Orden por cercanía (sin Google)"}>
              {optimizando ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              Optimizar
            </button>
            {enlaces.map((enlace, i) => (
              <a key={enlace} href={enlace} target="_blank" rel="noreferrer" className={claseBoton}>
                <Navigation size={13} />
                {enlaces.length > 1 ? `Google Maps (tramo ${i + 1})` : "Abrir en Google Maps"}
              </a>
            ))}
          </div>
        )}
      </div>

      {paradas.length === 0 ? (
        <p className="px-5 py-8 text-center text-xs text-slate-400">Sin diligencias programadas para este día.</p>
      ) : (
        <div className="grid gap-5 p-5 lg:grid-cols-[1fr_420px]">
          <div className="relative z-0 h-[420px]">
            <Mapa sede={sede} paradas={paradas} />
          </div>

          {/* LISTA EN ORDEN */}
          <ol className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {paradas.map((p, i) => {
              const distancia = p.latitudConfirmacion !== null && p.longitudConfirmacion !== null && p.latitud !== null && p.longitud !== null
                ? distanciaMetros({ latitud: p.latitud, longitud: p.longitud }, { latitud: p.latitudConfirmacion, longitud: p.longitudConfirmacion })
                : null
              return (
                <li key={p.id} className="rounded-lg border border-slate-200 px-3 py-2.5 text-xs">
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white" style={{ backgroundColor: COLOR_ESTADO[p.estado] }}>
                      {p.orden}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2">
                        <Link href={`/center/solicitudTramites/${p.tramiteId}`} className="font-semibold text-slate-700 hover:text-sky-600">#{p.tramiteId}</Link>
                        <span className="truncate text-slate-500">{p.tipo ?? "—"}</span>
                      </div>
                      <p className="truncate text-slate-600">{p.cliente ?? "Sin cliente"}{p.placa ? ` · ${p.placa}` : ""}</p>
                      <p className="text-[11px] text-slate-400">{p.direccion ?? "Sin dirección"}{p.municipio ? `, ${p.municipio}` : ""}</p>

                      {/* Ubicación de la dirección */}
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                        {p.latitud === null ? (
                          <span className="inline-flex items-center gap-1 font-medium text-amber-700"><MapPinOff size={12} /> Sin ubicar</span>
                        ) : p.ubicacionPrecisa === false ? (
                          <span className="inline-flex items-center gap-1 font-medium text-amber-700"><MapPin size={12} /> Aproximada</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-400"><MapPin size={12} /> {p.ubicacionFuente === "MANUAL" ? "Ubicada a mano" : "Ubicada"}</span>
                        )}
                        <button type="button" onClick={() => setUbicando(p)} className="font-medium text-sky-600 hover:underline">
                          {p.latitud === null ? "Ubicar" : "Corregir"}
                        </button>
                      </div>

                      {/* Confirmación del mensajero */}
                      {p.estado !== "PENDIENTE" && (
                        <div className={clsx("mt-2 rounded-md px-2.5 py-1.5", p.estado === "ENTREGADO" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700")}>
                          <p className="font-semibold">
                            {NOMBRE_ESTADO_PARADA[p.estado]}{p.fechaConfirmacion && ` · ${hora(p.fechaConfirmacion)}`}
                            {distancia !== null && <span className="font-normal"> · a {distancia >= 1000 ? `${(distancia / 1000).toFixed(1)} km` : `${distancia} m`} de la dirección</span>}
                          </p>
                          {p.observacion && <p className="mt-0.5 whitespace-pre-line">{p.observacion}</p>}
                          {p.tieneFoto && (
                            <a href={`/api/backend/mensajeria/paradas/${p.id}/foto`} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 font-medium underline">
                              <Camera size={12} /> Ver foto <ExternalLink size={10} />
                            </a>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Subir / bajar */}
                    <div className="flex shrink-0 flex-col">
                      <button type="button" onClick={() => mover(i, -1)} disabled={i === 0 || guardando} className="p-1 text-slate-400 hover:text-sky-600 disabled:opacity-30" aria-label={`Subir parada ${p.orden}`}>
                        <ArrowUp size={14} />
                      </button>
                      <button type="button" onClick={() => mover(i, 1)} disabled={i === paradas.length - 1 || guardando} className="p-1 text-slate-400 hover:text-sky-600 disabled:opacity-30" aria-label={`Bajar parada ${p.orden}`}>
                        <ArrowDown size={14} />
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      )}

      {ubicando && (
        <ModalUbicacion
          titulo={`Ubicación del trámite #${ubicando.tramiteId}`}
          direccion={[ubicando.direccion, ubicando.municipio].filter(Boolean).join(", ") || null}
          puntoInicial={ubicando.latitud !== null && ubicando.longitud !== null ? { latitud: ubicando.latitud, longitud: ubicando.longitud } : null}
          centro={sede?.latitud != null && sede.longitud != null ? { latitud: sede.latitud, longitud: sede.longitud } : null}
          onGuardar={async punto => {
            const r = await llamarApi(`/mensajeria/tramites/${ubicando.tramiteId}/ubicacion`, "PUT", punto)
            if (!r.ok) { toast.error(r.error); return false }
            toast.success("Ubicación guardada")
            router.refresh()
            return true
          }}
          onBuscarGoogle={googleDisponible ? async () => {
            const r = await llamarApi<{ latitud: number, longitud: number, ubicacionPrecisa: boolean }>(`/mensajeria/tramites/${ubicando.tramiteId}/ubicar`, "POST")
            if (!r.ok) { toast.error(r.error); return null }
            if (!r.datos.ubicacionPrecisa) toast.warning("Google la ubicó de forma aproximada: verifique el punto")
            return { latitud: r.datos.latitud, longitud: r.datos.longitud }
          } : undefined}
          onCerrar={() => setUbicando(null)}
        />
      )}
    </section>
  )
}
