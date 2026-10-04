"use client"

import { useEffect, useRef, useState } from "react"
import { CheckCircle2, Link2, Loader2, MapPin } from "lucide-react"

export type MunicipioSugerido = { id: number, nombreMunicipio: string, departamento: string }

type Sugerencia = { placeId: string, principal: string, secundario: string }
type Lugar = { direccion: string, nombre: string | null, latitud: number, longitud: number, municipio: MunicipioSugerido | null }

const claseInput = "w-full h-10 px-3 text-xs text-slate-700 bg-white border border-slate-200 rounded-md outline-none transition placeholder:text-slate-300 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"

const esEnlaceMaps = (texto: string) => /^https?:\/\/\S*(google\.[a-z.]+\/maps|maps\.google\.|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(texto.trim())

const nuevaSesion = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()))

// Dirección del trámite con sugerencias de Google mientras se escribe (lugares o direcciones,
// ej: "Alcaldía de Medellín") o pegando un enlace de Google Maps. Al elegir, guarda la
// ubicación exacta y propone el municipio. Sin Google configurado funciona como un campo normal.
export default function CampoDireccion({ name, defaultValue, onMunicipio }: {
  name: string
  defaultValue?: string | null
  onMunicipio?: (municipio: MunicipioSugerido) => void
}) {
  const [texto, setTexto] = useState(defaultValue ?? "")
  const [disponible, setDisponible] = useState(false)
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([])
  const [abierto, setAbierto] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [ubicacion, setUbicacion] = useState<{ latitud: number, longitud: number, nombre: string | null } | null>(null)
  const sesion = useRef(nuevaSesion())
  const elegido = useRef(false)

  useEffect(() => {
    fetch("/api/backend/direcciones/disponible")
      .then(r => (r.ok ? r.json() : { disponible: false }))
      .then(j => setDisponible(Boolean(j.disponible)))
      .catch(() => setDisponible(false))
  }, [])

  // Sugerencias mientras escribe (espera a que deje de escribir)
  useEffect(() => {
    if (!disponible || elegido.current || texto.trim().length < 3 || esEnlaceMaps(texto)) {
      setSugerencias([])
      return
    }
    const control = new AbortController()
    const espera = setTimeout(async () => {
      try {
        setCargando(true)
        const r = await fetch(`/api/backend/direcciones/sugerencias?q=${encodeURIComponent(texto.trim())}&sesion=${sesion.current}`, { signal: control.signal })
        const datos = r.ok ? await r.json() : []
        setSugerencias(Array.isArray(datos) ? datos : [])
        setAbierto(true)
      } catch {
        /* búsqueda cancelada o sin conexión: se deja escribir normal */
      } finally {
        setCargando(false)
      }
    }, 350)
    return () => { clearTimeout(espera); control.abort() }
  }, [texto, disponible])

  const aplicar = (lugar: Lugar) => {
    elegido.current = true
    setTexto(lugar.direccion)
    setUbicacion({ latitud: lugar.latitud, longitud: lugar.longitud, nombre: lugar.nombre })
    setSugerencias([])
    setAbierto(false)
    if (lugar.municipio) onMunicipio?.(lugar.municipio)
    sesion.current = nuevaSesion()
  }

  const elegir = async (s: Sugerencia) => {
    setCargando(true)
    try {
      const r = await fetch(`/api/backend/direcciones/lugares/${encodeURIComponent(s.placeId)}?sesion=${sesion.current}`)
      if (r.ok) aplicar(await r.json())
    } finally {
      setCargando(false)
    }
  }

  // Enlace de Google Maps pegado
  const usarEnlace = async (url: string) => {
    setCargando(true)
    try {
      const r = await fetch("/api/backend/direcciones/enlace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      })
      const json = await r.json().catch(() => ({}))
      if (r.ok) aplicar(json)
      else setTexto(url) // se deja el texto para que lo corrija
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="relative">
      <div className="relative">
        <input
          type="text"
          id={name}
          name={name}
          value={texto}
          autoComplete="off"
          onChange={e => {
            const valor = e.target.value
            elegido.current = false
            setUbicacion(null) // si cambia el texto, la ubicación elegida ya no aplica
            setTexto(valor)
            if (disponible && esEnlaceMaps(valor)) usarEnlace(valor)
          }}
          onFocus={() => sugerencias.length && setAbierto(true)}
          onBlur={() => setTimeout(() => setAbierto(false), 150)}
          placeholder={disponible
            ? "Escriba la dirección o el lugar (ej: Alcaldía de Medellín) o pegue un enlace de Google Maps"
            : "Dirección donde se realizará el trámite"}
          className={`${claseInput} pr-8`}
        />
        {cargando && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />}
      </div>

      {/* Coordenadas del lugar elegido: van con el formulario */}
      {ubicacion && (
        <>
          <input type="hidden" name="latitud" value={ubicacion.latitud} />
          <input type="hidden" name="longitud" value={ubicacion.longitud} />
          <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-700">
            <CheckCircle2 size={12} /> Ubicación tomada de Google Maps{ubicacion.nombre ? ` · ${ubicacion.nombre}` : ""}
          </p>
        </>
      )}

      {abierto && sugerencias.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg" role="listbox">
          {sugerencias.map(s => (
            <li key={s.placeId}>
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => elegir(s)}
                className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-sky-50"
              >
                <MapPin size={14} className="mt-0.5 shrink-0 text-slate-400" />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium text-slate-700">{s.principal}</span>
                  {s.secundario && <span className="block truncate text-[11px] text-slate-400">{s.secundario}</span>}
                </span>
              </button>
            </li>
          ))}
          <li className="flex items-center gap-1 px-3 pt-1.5 pb-1 text-[10px] text-slate-400">
            <Link2 size={10} /> También puede pegar un enlace de Google Maps
          </li>
        </ul>
      )}
    </div>
  )
}
