"use client"

import { useEffect, useMemo, useState } from "react"
import { Combobox, ComboboxInput, ComboboxOption, ComboboxOptions } from "@headlessui/react"
import { Loader2 } from "lucide-react"
import { llamarApi } from "@/src/lib/apiCliente"
import { normalizar, type Municipio } from "@/src/lib/cargueTramites"

const claseCampo = "h-8 w-full min-w-0 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none placeholder:text-slate-300 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
const claseLista = "z-50 max-h-60 w-[var(--input-width)] min-w-64 overflow-y-auto rounded-md border border-slate-200 bg-white py-1 text-xs shadow-lg empty:invisible"
const claseOpcion = "cursor-pointer px-3 py-1.5 text-slate-700 data-[focus]:bg-sky-50"

type Cliente = { id: number, nombre: string, identificacion: string | null }

// Cliente por nombre o identificación (busca en el servidor: son miles)
export function BuscadorCliente({
  valor,
  placeholder = "Buscar cliente",
  onElegir
}: {
  valor: { id: number | null, nombre: string }
  placeholder?: string
  onElegir: (cliente: Cliente | null) => void
}) {
  const [busqueda, setBusqueda] = useState("")
  const [opciones, setOpciones] = useState<Cliente[]>([])
  const [buscando, setBuscando] = useState(false)

  useEffect(() => {
    if (busqueda.trim().length < 2) return setOpciones([])
    setBuscando(true)
    const espera = setTimeout(async () => {
      const r = await llamarApi<Cliente[]>(`/solicitudTramites/cargue/clientes?busqueda=${encodeURIComponent(busqueda.trim())}`)
      setOpciones(r.ok ? r.datos : [])
      setBuscando(false)
    }, 300)
    return () => clearTimeout(espera)
  }, [busqueda])

  return (
    <Combobox
      value={valor.id ? { id: valor.id, nombre: valor.nombre, identificacion: null } : null}
      onChange={(c: Cliente | null) => onElegir(c)}
      onClose={() => setBusqueda("")}
      by="id"
    >
      <div className="relative">
        <ComboboxInput
          className={claseCampo}
          displayValue={(c: Cliente | null) => c?.nombre ?? ""}
          onChange={e => setBusqueda(e.target.value)}
          placeholder={placeholder}
        />
        {buscando && <Loader2 size={12} className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />}
      </div>
      <ComboboxOptions anchor="bottom start" className={claseLista}>
        {opciones.map(c => (
          <ComboboxOption key={c.id} value={c} className={claseOpcion}>
            {c.nombre}{c.identificacion && <span className="text-slate-400"> · {c.identificacion}</span>}
          </ComboboxOption>
        ))}
      </ComboboxOptions>
    </Combobox>
  )
}

// Municipio (se filtra en el navegador: la lista viene completa con los catálogos)
export function BuscadorMunicipio({
  municipios,
  valor,
  placeholder = "Municipio",
  onElegir
}: {
  municipios: Municipio[]
  valor: number | null
  placeholder?: string
  onElegir: (id: number | null) => void
}) {
  const [busqueda, setBusqueda] = useState("")
  const elegido = municipios.find(m => m.id === valor) ?? null
  const opciones = useMemo(() => {
    const t = normalizar(busqueda)
    if (t.length < 2) return []
    return municipios
      .filter(m => normalizar(m.nombre).includes(t))
      .sort((a, b) => Number(!normalizar(a.nombre).startsWith(t)) - Number(!normalizar(b.nombre).startsWith(t)) || a.nombre.localeCompare(b.nombre))
      .slice(0, 30)
  }, [busqueda, municipios])

  return (
    <Combobox value={elegido} onChange={(m: Municipio | null) => onElegir(m?.id ?? null)} onClose={() => setBusqueda("")} by="id">
      <ComboboxInput
        className={claseCampo}
        displayValue={(m: Municipio | null) => (m ? `${m.nombre}${m.departamento ? ` (${m.departamento})` : ""}` : "")}
        onChange={e => setBusqueda(e.target.value)}
        placeholder={placeholder}
      />
      <ComboboxOptions anchor="bottom start" className={claseLista}>
        {opciones.map(m => (
          <ComboboxOption key={m.id} value={m} className={claseOpcion}>
            {m.nombre}<span className="text-slate-400"> · {m.departamento}</span>
          </ComboboxOption>
        ))}
      </ComboboxOptions>
    </Combobox>
  )
}

export { claseCampo }
