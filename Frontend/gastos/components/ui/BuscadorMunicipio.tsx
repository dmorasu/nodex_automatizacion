"use client"

import { useRef, useState } from "react"
import { buscarMunicipios } from "@/actions/gastos/gastos"
import { claseInput } from "./estilos"

type Municipio = { id: number, nombreMunicipio: string, departamento: string }

// Campo de texto con sugerencias de la lista de municipios de Nodex Trámites: al escribir
// aparecen los que coinciden y al elegir uno queda "Municipio - Departamento"
export default function BuscadorMunicipio({ valor, onCambiar }: { valor: string, onCambiar: (valor: string) => void }) {
  const [opciones, setOpciones] = useState<Municipio[]>([])
  const [abierto, setAbierto] = useState(false)
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Solo cuenta la última búsqueda (las respuestas pueden llegar en otro orden)
  const ultima = useRef(0)

  const escribir = (texto: string) => {
    onCambiar(texto)
    if (espera.current) clearTimeout(espera.current)
    if (texto.trim().length < 2) {
      setOpciones([])
      return
    }
    espera.current = setTimeout(async () => {
      const numero = ++ultima.current
      const encontrados = await buscarMunicipios(texto)
      if (numero !== ultima.current) return
      setOpciones(encontrados)
      setAbierto(true)
    }, 300)
  }

  const elegir = (m: Municipio) => {
    onCambiar(`${m.nombreMunicipio.trim()} - ${m.departamento.trim()}`)
    setOpciones([])
    setAbierto(false)
  }

  return (
    <div className="relative">
      <input
        value={valor}
        onChange={e => escribir(e.target.value)}
        onFocus={() => opciones.length && setAbierto(true)}
        onBlur={() => setAbierto(false)}
        maxLength={150}
        autoComplete="off"
        className={claseInput}
      />
      {abierto && opciones.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-slate-200 bg-white py-1 text-xs shadow-lg">
          {opciones.map(m => (
            <li key={m.id}>
              {/* onMouseDown: se elige antes de que el campo pierda el foco y cierre la lista */}
              <button
                type="button"
                onMouseDown={e => {
                  e.preventDefault()
                  elegir(m)
                }}
                className="flex w-full justify-between gap-3 px-3 py-1.5 text-left hover:bg-emerald-50"
              >
                <span className="text-slate-700">{m.nombreMunicipio}</span>
                <span className="text-slate-400">{m.departamento}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
