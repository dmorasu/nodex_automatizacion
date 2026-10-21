"use client"

import { useEffect, useRef, useState } from "react"
import { LocateFixed, LocateOff } from "lucide-react"
import { enviarUbicacion } from "@/actions/ruta"
import { alCambiarRuta, rutaIniciada } from "@/src/lib/enRuta"

const CADA_MS = 60_000          // una posición por minuto…
const MINIMO_MS = 30_000        // …o antes si se movió, pero nunca más de una cada 30 s
const METROS_PARA_ADELANTAR = 50
const REVISAR_CADA_MS = 15_000  // cada cuánto se revisa si toca enviar la última posición conocida

type Punto = { latitud: number, longitud: number }

const metrosEntre = (a: Punto, b: Punto) => {
  const rad = (g: number) => (g * Math.PI) / 180
  const h = Math.sin(rad(b.latitud - a.latitud) / 2) ** 2
    + Math.cos(rad(a.latitud)) * Math.cos(rad(b.latitud)) * Math.sin(rad(b.longitud - a.longitud) / 2) ** 2
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h))
}

const hora = (fecha: Date) => fecha.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" })

// Con la ruta iniciada, envía la posición del mensajero mientras la app está abierta y muestra
// una franja delgada en toda la app (el mensajero sabe que está compartiendo y ve si falla).
// No se puede detener desde la app (decisión del usuario, 2026-10-21): termina al cerrar la app
// o al acabar el día. Va en el layout para seguir enviando aunque cambie de pantalla.
export default function UbicacionEnRuta() {
  const [activa, setActiva] = useState(false)
  const [estado, setEstado] = useState<{ tipo: "buscando" } | { tipo: "ok", ultima: Date } | { tipo: "error", mensaje: string }>({ tipo: "buscando" })
  const ultimoEnvio = useRef<{ momento: number, punto: Punto } | null>(null)
  // Última posición que dio el GPS (se envía aunque el celular no la vuelva a reportar)
  const ultimaPosicion = useRef<{ punto: Punto, precision: number | null } | null>(null)

  // Se lee del celular al abrir, cuando se inicia o detiene, y cada minuto (al cambiar de día se apaga)
  useEffect(() => {
    const revisar = () => setActiva(rutaIniciada())
    revisar()
    const reloj = setInterval(revisar, 60_000)
    const quitar = alCambiarRuta(revisar)
    return () => { clearInterval(reloj); quitar() }
  }, [])

  useEffect(() => {
    if (!activa) return
    if (!("geolocation" in navigator)) {
      setEstado({ tipo: "error", mensaje: "Este celular no da la ubicación" })
      return
    }
    setEstado({ tipo: "buscando" })
    ultimoEnvio.current = null
    ultimaPosicion.current = null

    // Envía la última posición conocida si pasó un minuto, o si se movió y pasaron 30 s
    const enviarSiToca = () => {
      const actual = ultimaPosicion.current
      if (!actual) return
      const ahora = Date.now()
      const anterior = ultimoEnvio.current
      const toca = !anterior
        || ahora - anterior.momento >= CADA_MS
        || (ahora - anterior.momento >= MINIMO_MS && metrosEntre(anterior.punto, actual.punto) >= METROS_PARA_ADELANTAR)
      if (!toca) return
      ultimoEnvio.current = { momento: ahora, punto: actual.punto }
      enviarUbicacion(actual.punto.latitud, actual.punto.longitud, actual.precision)
        .then(r => setEstado(r.ok ? { tipo: "ok", ultima: new Date() } : { tipo: "error", mensaje: r.errores[0] ?? "No se pudo enviar la ubicación" }))
        .catch(() => setEstado({ tipo: "error", mensaje: "Sin conexión: se enviará al volver la señal" }))
    }

    const alMoverse = (p: GeolocationPosition) => {
      ultimaPosicion.current = { punto: { latitud: p.coords.latitude, longitud: p.coords.longitude }, precision: p.coords.accuracy ?? null }
      enviarSiToca()
    }

    const vigilancia = navigator.geolocation.watchPosition(
      alMoverse,
      error => setEstado({
        tipo: "error",
        mensaje: error.code === error.PERMISSION_DENIED
          ? "Active el permiso de ubicación del navegador"
          : "No se pudo leer la ubicación"
      }),
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 60_000 }
    )

    // watchPosition solo avisa cuando la posición cambia: si el mensajero está quieto (o se movió
    // poco después del último envío) se reenvía la última conocida, así Torre de control ve que sigue
    // conectado. No se pide una lectura nueva: el GPS puede no darla si no hubo cambio.
    const latido = setInterval(enviarSiToca, REVISAR_CADA_MS)

    return () => {
      navigator.geolocation.clearWatch(vigilancia)
      clearInterval(latido)
    }
  }, [activa])

  if (!activa) return null

  const conError = estado.tipo === "error"
  return (
    <div className={conError ? "bg-amber-100 text-amber-900" : "bg-indigo-50 text-indigo-700"} role="status">
      <div className="mx-auto flex max-w-2xl items-center gap-1.5 px-4 py-1 text-[11px] leading-4">
        {conError ? <LocateOff size={12} className="shrink-0" /> : <LocateFixed size={12} className="shrink-0" />}
        <span className="min-w-0 truncate">
          {estado.tipo === "error" ? estado.mensaje : (
            <>Ubicación compartida{estado.tipo === "ok" ? ` · ${hora(estado.ultima)}` : " · buscando señal…"}</>
          )}
        </span>
      </div>
    </div>
  )
}
