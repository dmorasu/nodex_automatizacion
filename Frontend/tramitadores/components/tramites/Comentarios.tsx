"use client"

import { useState, useTransition } from "react"
import { toast } from "react-toastify"
import { Loader2, SendHorizontal } from "lucide-react"
import { comentarTramite } from "@/actions/tramites"
import { formatoFechaHora } from "@/src/lib/formato"
import type { DetalleTramite } from "@/src/schemas"
import { claseTextarea } from "../ui/estilos"

// Conversación con el equipo: lo propio a la derecha, lo del equipo a la izquierda
export default function Comentarios({ tramiteId, comentarios }: { tramiteId: number, comentarios: DetalleTramite["comentarios"] }) {
  const [texto, setTexto] = useState("")
  const [enviando, startEnviar] = useTransition()

  const enviar = () => {
    if (!texto.trim()) return
    startEnviar(async () => {
      const resultado = await comentarTramite(tramiteId, texto)
      if (!resultado.ok) return resultado.errores.forEach(error => toast.error(error))
      setTexto("")
    })
  }

  // Del más antiguo al más reciente, como un chat
  const ordenados = [...comentarios].reverse()

  return (
    <div className="space-y-3">
      {ordenados.length === 0 ? (
        <p className="text-sm text-slate-400">Aún no hay comentarios. Escriba si tiene una novedad o una pregunta.</p>
      ) : (
        <ul className="space-y-2">
          {ordenados.map(c => {
            const propio = c.autor.tipo === "TRAMITADOR"
            return (
              <li key={c.id} className={`flex ${propio ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${propio ? "rounded-br-sm bg-indigo-600 text-white" : "rounded-bl-sm bg-slate-100 text-slate-800"}`}>
                  {!propio && <p className="text-[11px] font-semibold text-slate-500">{c.autor.nombre}</p>}
                  <p className="whitespace-pre-line">{c.comentario}</p>
                  <p className={`mt-1 text-right text-[10px] ${propio ? "text-indigo-200" : "text-slate-400"}`}>{formatoFechaHora(c.fecha)}</p>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <div className="flex items-end gap-2">
        <textarea
          value={texto}
          onChange={e => setTexto(e.target.value)}
          rows={2}
          maxLength={1000}
          placeholder="Escriba un comentario"
          className={claseTextarea}
          aria-label="Comentario"
        />
        <button
          type="button"
          onClick={enviar}
          disabled={enviando || !texto.trim()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white active:bg-indigo-800 disabled:opacity-40"
          aria-label="Enviar comentario"
        >
          {enviando ? <Loader2 size={18} className="animate-spin" /> : <SendHorizontal size={18} />}
        </button>
      </div>
    </div>
  )
}
