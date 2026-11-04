"use client"

import { useEffect, useRef, useState } from "react"
import { Combobox, ComboboxInput, ComboboxOption, ComboboxOptions } from "@headlessui/react"
import { Loader2 } from "lucide-react"
import { llamarApi } from "@/src/lib/apiCliente"

export type MunicipioElegido = { id: number, nombreMunicipio: string, departamento: string, regional?: string | null }

const claseLista = "z-[70] max-h-60 w-[var(--input-width)] min-w-64 overflow-y-auto rounded-md border border-slate-200 bg-white py-1 text-xs shadow-lg empty:invisible"
const claseOpcion = "cursor-pointer px-3 py-1.5 text-slate-700 data-[focus]:bg-sky-50"

// Municipio por nombre (busca en el servidor). Con `limpiarAlElegir` sirve para agregar varios
// (la cobertura del tramitador): elige y vuelve a quedar vacío
export default function BuscadorMunicipioServidor({ valor, onElegir, placeholder = "Buscar municipio", className, limpiarAlElegir }: {
  valor: MunicipioElegido | null
  onElegir: (municipio: MunicipioElegido | null) => void
  placeholder?: string
  className: string
  limpiarAlElegir?: boolean
}) {
  const [opciones, setOpciones] = useState<MunicipioElegido[]>([])
  const [buscando, setBuscando] = useState(false)
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Busca 300 ms después de la última tecla
  const buscar = (texto: string) => {
    if (espera.current) clearTimeout(espera.current)
    if (texto.trim().length < 2) { setOpciones([]); setBuscando(false); return }
    setBuscando(true)
    espera.current = setTimeout(async () => {
      const r = await llamarApi<MunicipioElegido[]>(`/municipios/search?search=${encodeURIComponent(texto.trim())}&limit=15`)
      setOpciones(r.ok ? r.datos : [])
      setBuscando(false)
    }, 300)
  }
  useEffect(() => () => { if (espera.current) clearTimeout(espera.current) }, [])

  return (
    <Combobox
      value={limpiarAlElegir ? null : valor}
      onChange={(m: MunicipioElegido | null) => { onElegir(m); if (limpiarAlElegir) setOpciones([]) }}
      by="id"
    >
      <div className="relative">
        <ComboboxInput
          className={className}
          displayValue={(m: MunicipioElegido | null) => (m ? `${m.nombreMunicipio} - ${m.departamento}` : "")}
          onChange={e => buscar(e.target.value)}
          placeholder={placeholder}
        />
        {buscando && <Loader2 size={12} className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />}
      </div>
      <ComboboxOptions anchor="bottom start" className={claseLista}>
        {opciones.map(m => (
          <ComboboxOption key={m.id} value={m} className={claseOpcion}>
            {m.nombreMunicipio} <span className="text-slate-400">· {m.departamento}</span>
          </ComboboxOption>
        ))}
      </ComboboxOptions>
    </Combobox>
  )
}
