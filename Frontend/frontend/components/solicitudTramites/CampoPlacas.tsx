"use client"

import { useState, type ClipboardEvent, type KeyboardEvent } from "react"
import { X } from "lucide-react"
import { MAXIMO_PLACAS, separarPlacas, textoDePlacas } from "@/src/lib/placas"

// Placas del trámite (hasta 10): cada placa queda como etiqueta al pulsar Enter, coma o espacio,
// al pegar varias o al salir del campo. Se envía en `name` como "ABC123, DEF456".
export default function CampoPlacas({
  name,
  onCambiar
}: {
  name: string
  onCambiar?: (texto: string) => void
}) {
  const [placas, setPlacas] = useState<string[]>([])
  const [borrador, setBorrador] = useState("")

  const guardar = (nuevas: string[]) => {
    setPlacas(nuevas)
    onCambiar?.(textoDePlacas(nuevas))
  }

  // Agrega lo escrito (o pegado) sin repetir y sin pasar de 10. Si no hay ninguna placa (ej. "AB"),
  // lo escrito se queda en el campo para corregirlo
  const agregar = (texto: string) => {
    const leidas = separarPlacas(texto)
    if (!leidas.length) return setBorrador(texto.trim().toUpperCase())
    const nuevas = leidas.filter(p => !placas.includes(p))
    if (nuevas.length) guardar([...placas, ...nuevas].slice(0, MAXIMO_PLACAS))
    setBorrador("")
  }

  const quitar = (placa: string) => guardar(placas.filter(p => p !== placa))

  const alTeclear = (e: KeyboardEvent<HTMLInputElement>) => {
    // Enter no envía el formulario: agrega la placa
    if (e.key === "Enter" || e.key === "," || e.key === " ") {
      e.preventDefault()
      // "ABC 123": el espacio después de las letras no corta la placa
      if (e.key === " " && borrador.trim().length < 5) return
      if (borrador.trim()) agregar(borrador)
    } else if (e.key === "Backspace" && !borrador && placas.length) {
      quitar(placas[placas.length - 1])
    }
  }

  const alPegar = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    agregar(`${borrador} ${e.clipboardData.getData("text")}`)
  }

  const lleno = placas.length >= MAXIMO_PLACAS

  return (
    <div className="space-y-1.5">
      <div className="flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1.5 transition focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-100">
        {placas.map(placa => (
          <span key={placa} className="inline-flex items-center gap-1 rounded bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 ring-1 ring-sky-200">
            {placa}
            <button type="button" onClick={() => quitar(placa)} aria-label={`Quitar ${placa}`} className="text-sky-500 hover:text-sky-800">
              <X size={12} />
            </button>
          </span>
        ))}
        {!lleno && (
          <input
            id={name}
            type="text"
            value={borrador}
            onChange={e => setBorrador(e.target.value.toUpperCase())}
            onKeyDown={alTeclear}
            onPaste={alPegar}
            onBlur={() => { if (borrador.trim()) agregar(borrador) }}
            // Sin placas el campo es obligatorio (el navegador avisa al guardar)
            required={!placas.length}
            maxLength={20}
            placeholder={placas.length ? "" : "Ingrese la placa"}
            className="h-7 min-w-[7rem] flex-1 bg-transparent px-1 text-xs text-slate-700 outline-none placeholder:text-slate-300"
          />
        )}
      </div>
      <div className="text-right text-[11px] text-slate-400">{placas.length}/{MAXIMO_PLACAS}</div>
      <input type="hidden" name={name} value={textoDePlacas(placas)} />
    </div>
  )
}
