"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { toast } from "react-toastify"
import { Loader2 } from "lucide-react"
import { traerGastosFiltrados } from "@/actions/gastos/gastos"
import { formatoFecha, formatoFechaHoraColombia, formatoMoneda } from "@/src/lib/formato"
import type { GastoListado } from "@/src/schemas/gastos"

export type Columna = {
  titulo: string
  valor: (gasto: GastoListado) => React.ReactNode
  alinearDerecha?: boolean
}

// Tabla de gastos con casillas para seleccionar varios y una barra de acción.
// `accion` recibe los seleccionados y una función para limpiar la selección.
// `todasLasPaginas` (bandeja paginada): con la página marcada completa aparece "Seleccionar los N",
// que trae todos los gastos de la misma consulta para aplicarles la acción de una vez.
export default function SeleccionGastos({
  gastos,
  columnas,
  valorTotal,
  accion,
  vacio,
  fechaConHora = false,
  todasLasPaginas
}: {
  gastos: GastoListado[]
  columnas: Columna[]
  valorTotal: (gasto: GastoListado) => number
  accion: (seleccionados: GastoListado[], limpiar: () => void) => React.ReactNode
  vacio: string
  // La columna de creación con la hora (Contabilidad)
  fechaConHora?: boolean
  todasLasPaginas?: { total: number, consulta: string }
}) {
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set())
  // Todos los gastos de la consulta (todas las páginas); null = solo la selección de esta página
  const [todos, setTodos] = useState<{ consulta: string, gastos: GastoListado[] } | null>(null)
  const [cargando, startCargar] = useTransition()

  // Solo cuentan los seleccionados que siguen visibles (los filtros pueden cambiar la lista);
  // "todos" se descarta si cambió la consulta (otra página u otros filtros)
  const todosVigentes = todos && todos.consulta === todasLasPaginas?.consulta ? todos.gastos : null
  const visibles = useMemo(() => gastos.filter(g => seleccion.has(g.id)), [gastos, seleccion])
  const seleccionados = todosVigentes ?? visibles
  const total = seleccionados.reduce((suma, g) => suma + valorTotal(g), 0)
  const todosMarcados = gastos.length > 0 && (!!todosVigentes || visibles.length === gastos.length)
  const hayMasPaginas = !!todasLasPaginas && todasLasPaginas.total > gastos.length
  const limpiar = () => { setSeleccion(new Set()); setTodos(null) }

  const seleccionarTodasLasPaginas = () => {
    if (!todasLasPaginas) return
    startCargar(async () => {
      const resultado = await traerGastosFiltrados(todasLasPaginas.consulta)
      if (!resultado.ok) return resultado.errores.forEach(e => toast.error(e))
      setTodos({ consulta: todasLasPaginas.consulta, gastos: resultado.datos })
    })
  }

  const alternar = (id: number) => {
    // Al desmarcar uno se vuelve a la selección de esta página
    if (todosVigentes) { setSeleccion(new Set(gastos.filter(g => g.id !== id).map(g => g.id))); setTodos(null); return }
    setSeleccion(actual => {
      const nueva = new Set(actual)
      if (nueva.has(id)) nueva.delete(id)
      else nueva.add(id)
      return nueva
    })
  }

  const alternarTodos = () => todosMarcados ? limpiar() : setSeleccion(new Set(gastos.map(g => g.id)))

  return (
    <div className="space-y-3">

      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <p className="text-xs text-slate-600">
          {seleccionados.length === 0
            ? "Seleccione los gastos"
            : <><b>{seleccionados.length}</b> seleccionado(s){todosVigentes && " de todas las páginas"} · total <b>{formatoMoneda(total)}</b></>}
          {hayMasPaginas && todosMarcados && !todosVigentes && (
            <button type="button" onClick={seleccionarTodasLasPaginas} disabled={cargando} className="ml-3 inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline disabled:opacity-50">
              {cargando && <Loader2 size={12} className="animate-spin" />}
              Seleccionar los {todasLasPaginas!.total}
            </button>
          )}
          {todosVigentes && (
            <button type="button" onClick={limpiar} className="ml-3 font-semibold text-slate-500 hover:underline">Quitar selección</button>
          )}
        </p>
        {accion(seleccionados, limpiar)}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 w-10">
                <input type="checkbox" checked={todosMarcados} onChange={alternarTodos} className="h-4 w-4 accent-emerald-600" aria-label="Seleccionar todos" />
              </th>
              <th className="px-4 py-3 font-semibold">Gasto</th>
              <th className="px-4 py-3 font-semibold">{fechaConHora ? "Creado" : "Fecha"}</th>
              {columnas.map(c => (
                <th key={c.titulo} className={`px-4 py-3 font-semibold ${c.alinearDerecha ? "text-right" : ""}`}>{c.titulo}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {gastos.map(gasto => (
              <tr
                key={gasto.id}
                onClick={() => alternar(gasto.id)}
                className={`cursor-pointer ${todosVigentes || seleccion.has(gasto.id) ? "bg-emerald-50/60" : "hover:bg-slate-50"}`}
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={!!todosVigentes || seleccion.has(gasto.id)}
                    onChange={() => alternar(gasto.id)}
                    onClick={e => e.stopPropagation()}
                    className="h-4 w-4 accent-emerald-600"
                    aria-label={`Seleccionar ${gasto.codigo}`}
                  />
                </td>
                <td className="px-4 py-3">
                  <Link href={`/solicitudes/${gasto.id}`} onClick={e => e.stopPropagation()} className="font-semibold text-emerald-700 hover:underline">
                    {gasto.codigo}
                  </Link>
                  <p className="text-[11px] text-slate-400">{gasto.conceptoPago}</p>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-500">{fechaConHora ? formatoFechaHoraColombia(gasto.createdAt) : formatoFecha(gasto.createdAt)}</td>
                {columnas.map(c => (
                  <td key={c.titulo} className={`px-4 py-3 text-slate-600 ${c.alinearDerecha ? "text-right whitespace-nowrap" : ""}`}>
                    {c.valor(gasto)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {gastos.length === 0 && <p className="py-14 text-center text-sm text-slate-400">{vacio}</p>}
      </div>
    </div>
  )
}
