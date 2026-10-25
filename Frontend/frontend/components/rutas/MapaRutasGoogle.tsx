"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { COLOR_ESTADO, MINUTOS_SIN_SENAL, NOMBRE_ESTADO_PARADA, haceMinutos, horaCorta, iniciales, puntosRuta, type Parada, type RutaEnMapa } from "@/src/rutas"
import { cargarGoogleMaps, mapIdGoogle } from "@/src/lib/googleMaps"

const escapar = (texto: string | null | undefined) =>
  (texto ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!))

// Marcador numerado: relleno del color del mensajero y borde del color del estado
const elementoParada = (numero: number, color: string, estado: Parada["estado"]) => {
  const span = document.createElement("span")
  span.textContent = String(numero)
  span.style.cssText = `display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:9999px;background:${color};color:#fff;font:600 11px system-ui;border:3px solid ${estado === "PENDIENTE" ? "#fff" : COLOR_ESTADO[estado]};box-shadow:0 1px 3px rgba(0,0,0,.4)`
  return span
}

const elementoSede = () => {
  const span = document.createElement("span")
  span.textContent = "S"
  span.style.cssText = "display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:8px;background:#0f172a;color:#fff;font:700 11px system-ui;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)"
  return span
}

// Mensajero en vivo: sus iniciales en su color, con halo si la posición es reciente; gris si no hay señal
const elementoEnVivo = (nombre: string, color: string, sinSenal: boolean) => {
  const span = document.createElement("span")
  span.textContent = iniciales(nombre)
  span.style.cssText = `display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:9999px;background:${sinSenal ? "#94a3b8" : color};color:#fff;font:700 11px system-ui;border:3px solid #fff;box-shadow:0 0 0 ${sinSenal ? "1px #94a3b8" : `5px ${color}55`},0 1px 4px rgba(0,0,0,.4)`
  return span
}

// Punto del recorrido real (donde confirmó una visita)
const elementoPuntoRecorrido = (color: string) => {
  const span = document.createElement("span")
  span.style.cssText = `display:block;width:10px;height:10px;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:0 0 0 1px ${color}`
  return span
}

// Mapa de Google con las rutas de varios mensajeros (un color por mensajero)
export default function MapaRutasGoogle({ rutas }: { rutas: RutaEnMapa[] }) {
  const contenedor = useRef<HTMLDivElement>(null)
  const mapa = useRef<google.maps.Map | null>(null)
  const ventana = useRef<google.maps.InfoWindow | null>(null)
  const dibujos = useRef<{ quitar: () => void }[]>([])
  const dibujosEnVivo = useRef<{ quitar: () => void }[]>([])
  const encuadradoEnVivo = useRef(false)

  // La ruta planeada y la capa en vivo se dibujan aparte: la posición se actualiza cada minuto
  // y no debe reencuadrar ni redibujar el resto del mapa
  const claveBase = useMemo(() => JSON.stringify(rutas.map(r => [r.id, r.color, r.sede, r.paradas, r.trazado])), [rutas])
  const claveEnVivo = useMemo(() => JSON.stringify(rutas.map(r => [r.id, r.enVivo, r.recorrido])), [rutas])
  const [listo, setListo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Crea el mapa una vez
  useEffect(() => {
    let cancelado = false
    cargarGoogleMaps()
      .then(maps => {
        if (cancelado || !contenedor.current) return
        mapa.current = new maps.Map(contenedor.current, {
          center: { lat: 4.6, lng: -74.1 },
          zoom: 6,
          mapId: mapIdGoogle,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
          gestureHandling: "cooperative"
        })
        ventana.current = new maps.InfoWindow()
        setListo(true)
      })
      .catch(e => setError((e as Error).message))
    return () => { cancelado = true }
  }, [])

  // Dibuja de nuevo cuando cambian las rutas (selección, orden o trazado)
  useEffect(() => {
    const m = mapa.current
    if (!listo || !m) return
    dibujos.current.forEach(d => d.quitar())
    dibujos.current = []
    const limites = new google.maps.LatLngBounds()
    const abrir = (marcador: google.maps.marker.AdvancedMarkerElement, html: string) =>
      marcador.addListener("click", () => {
        ventana.current?.setContent(`<div style="font:12px system-ui;line-height:1.45;max-width:260px">${html}</div>`)
        ventana.current?.open({ map: m, anchor: marcador })
      })

    const sedesDibujadas = new Set<number>()
    for (const ruta of rutas) {
      // Línea: por las calles si hay trazado; si no, recta y punteada
      const camino = (ruta.trazado ?? puntosRuta(ruta.sede, ruta.paradas)).map(([lat, lng]) => ({ lat, lng }))
      if (camino.length > 1) {
        const linea = new google.maps.Polyline({
          map: m,
          path: camino,
          strokeColor: ruta.color,
          strokeOpacity: ruta.trazado ? 0.85 : 0,
          strokeWeight: 4,
          icons: ruta.trazado ? [] : [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 0.9, strokeColor: ruta.color, scale: 3 }, offset: "0", repeat: "14px" }]
        })
        dibujos.current.push({ quitar: () => linea.setMap(null) })
        camino.forEach(p => limites.extend(p))
      }

      if (ruta.sede && ruta.sede.latitud !== null && ruta.sede.longitud !== null && !sedesDibujadas.has(ruta.sede.id)) {
        sedesDibujadas.add(ruta.sede.id)
        const posicion = { lat: ruta.sede.latitud, lng: ruta.sede.longitud }
        const marcador = new google.maps.marker.AdvancedMarkerElement({ map: m, position: posicion, content: elementoSede(), title: `Sede ${ruta.sede.nombre}`, zIndex: 1 })
        abrir(marcador, `<b>Sede ${escapar(ruta.sede.nombre)}</b><br>${escapar(ruta.sede.direccion)}`)
        dibujos.current.push({ quitar: () => { marcador.map = null } })
        limites.extend(posicion)
      }

      for (const p of ruta.paradas) {
        if (p.latitud === null || p.longitud === null) continue
        const posicion = { lat: p.latitud, lng: p.longitud }
        const marcador = new google.maps.marker.AdvancedMarkerElement({
          map: m,
          position: posicion,
          content: elementoParada(p.orden, ruta.color, p.estado),
          title: `${ruta.nombre} · parada ${p.orden}`,
          zIndex: 10
        })
        abrir(marcador, `
          <b style="color:${ruta.color}">${escapar(ruta.nombre)}</b><br>
          <b>${p.orden}. Trámite #${p.tramiteId}</b> · ${NOMBRE_ESTADO_PARADA[p.estado]}<br>
          ${escapar(p.tipo)}<br>
          ${escapar(p.cliente ?? "Sin cliente")}<br>
          ${escapar(p.direccion ?? "Sin dirección")}${p.municipio ? `, ${escapar(p.municipio)}` : ""}
          ${p.ubicacionPrecisa === false ? "<br><i>Ubicación aproximada</i>" : ""}
          <br><a href="/center/solicitudTramites/${p.tramiteId}" style="color:#0284c7;font-weight:600">Ver trámite</a>`)
        dibujos.current.push({ quitar: () => { marcador.map = null } })
        limites.extend(posicion)
      }
    }

    encuadradoEnVivo.current = !limites.isEmpty()
    if (!limites.isEmpty()) {
      m.fitBounds(limites, 40)
      // Con un solo punto el zoom quedaría al máximo
      google.maps.event.addListenerOnce(m, "idle", () => { if ((m.getZoom() ?? 0) > 16) m.setZoom(16) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo, claveBase])

  // Capa en vivo: recorrido real (punteado) y la última posición de cada mensajero
  useEffect(() => {
    const m = mapa.current
    if (!listo || !m) return
    dibujosEnVivo.current.forEach(d => d.quitar())
    dibujosEnVivo.current = []
    const limites = new google.maps.LatLngBounds()

    for (const ruta of rutas) {
      const camino = ruta.recorrido.map(p => ({ lat: p.latitud, lng: p.longitud }))
      if (camino.length > 1) {
        const linea = new google.maps.Polyline({
          map: m,
          path: camino,
          strokeOpacity: 0,
          icons: [{ icon: { path: google.maps.SymbolPath.CIRCLE, fillOpacity: 1, fillColor: ruta.color, strokeOpacity: 0, scale: 2.5 }, offset: "0", repeat: "9px" }],
          zIndex: 5
        })
        dibujosEnVivo.current.push({ quitar: () => linea.setMap(null) })
      }
      for (const p of ruta.recorrido) {
        if (p.titulo === "Posición en vivo") continue
        const punto = new google.maps.marker.AdvancedMarkerElement({ map: m, position: { lat: p.latitud, lng: p.longitud }, content: elementoPuntoRecorrido(ruta.color), title: `${ruta.nombre} · ${p.titulo} · ${horaCorta(p.hora)}`, zIndex: 6 })
        dibujosEnVivo.current.push({ quitar: () => { punto.map = null } })
      }

      if (ruta.enVivo) {
        const v = ruta.enVivo
        const sinSenal = v.minutos > MINUTOS_SIN_SENAL
        const posicion = { lat: v.latitud, lng: v.longitud }
        const marcador = new google.maps.marker.AdvancedMarkerElement({ map: m, position: posicion, content: elementoEnVivo(ruta.nombre, ruta.color, sinSenal), title: `${ruta.nombre} · ${haceMinutos(v.minutos)}`, zIndex: 20 })
        marcador.addListener("click", () => {
          ventana.current?.setContent(`<div style="font:12px system-ui;line-height:1.45;max-width:260px">
            <b style="color:${ruta.color}">${escapar(ruta.nombre)}</b><br>
            ${sinSenal ? "Sin señal" : "En vivo"} · ${haceMinutos(v.minutos)} (${horaCorta(v.registradaEn)})
            ${v.precisionMetros !== null ? `<br>Precisión ± ${v.precisionMetros} m` : ""}</div>`)
          ventana.current?.open({ map: m, anchor: marcador })
        })
        dibujosEnVivo.current.push({ quitar: () => { marcador.map = null } })
        limites.extend(posicion)
      }
    }

    // Si la ruta planeada no tenía nada que encuadrar (mensajero sin paradas), se encuadra una vez en vivo
    if (!encuadradoEnVivo.current && !limites.isEmpty()) {
      encuadradoEnVivo.current = true
      m.fitBounds(limites, 60)
      google.maps.event.addListenerOnce(m, "idle", () => { if ((m.getZoom() ?? 0) > 15) m.setZoom(15) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo, claveEnVivo])

  if (error) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg bg-red-50 px-6 text-center text-xs text-red-700">
        {error}. Revise que la clave NEXT_PUBLIC_GOOGLE_MAPS_API_KEY tenga habilitada &quot;Maps JavaScript API&quot; y permita este dominio.
      </div>
    )
  }

  return (
    <div className="relative isolate h-full w-full">
      <div ref={contenedor} className="h-full w-full rounded-lg" />
      {!listo && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-slate-50 text-xs text-slate-400">Cargando mapa…</div>
      )}
    </div>
  )
}
