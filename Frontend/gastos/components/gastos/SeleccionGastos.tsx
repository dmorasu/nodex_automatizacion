"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { formatoFecha, formatoMoneda } from "@/src/lib/formato"
import type { GastoListado } from "@/src/schemas/gastos"

type Columna = {
  titulo: string
  valor: (gasto: GastoListado) => React.ReactNode
  alinearDerecha?: boolean
}

// Tabla de gastos con casillas para seleccionar varios y una barra de acción.
// `accion` recibe los seleccionados y una función para limpiar la selección.
export default function SeleccionGastos({
  gastos,
  columnas,
  valorTotal,
  accion,
  vacio
}: {
  gastos: GastoListado[]
  columnas: Columna[]
  valorTotal: (gasto: GastoListado) => number
  accion: (seleccionados: GastoListado[], limpiar: () => void) => React.ReactNode
  vacio: string
}) {
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set())

  // Solo cuentan los seleccionados que siguen visibles (los filtros pueden cambiar la lista)
  const seleccionados = useMemo(() => gastos.filter(g => seleccion.has(g.id)), [gastos, seleccion])
  const total = seleccionados.reduce((suma, g) => suma + valorTotal(g), 0)
  const todosMarcados = gastos.length > 0 && seleccionados.length === gastos.length

  const alternar = (id: number) =>
    setSeleccion(actual => {
      const nueva = new Set(actual)
      if (nueva.has(id)) nueva.delete(id)
      else nueva.add(id)
      return nueva
    })

  const alternarTodos = () => setSeleccion(todosMarcados ? new Set() : new Set(gastos.map(g => g.id)))

  return (
    <div className="space-y-3">

      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <p className="text-xs text-slate-600">
          {seleccionados.length === 0
            ? "Seleccione los gastos"
            : <><b>{seleccionados.length}</b> seleccionado(s) · total <b>{formatoMoneda(total)}</b></>}
        </p>
        {accion(seleccionados, () => setSeleccion(new Set()))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 w-10">
                <input type="checkbox" checked={todosMarcados} onChange={alternarTodos} className="h-4 w-4 accent-emerald-600" aria-label="Seleccionar todos" />
              </th>
              <th className="px-4 py-3 font-semibold">Gasto</th>
              <th className="px-4 py-3 font-semibold">Fecha</th>
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
                className={`cursor-pointer ${seleccion.has(gasto.id) ? "bg-emerald-50/60" : "hover:bg-slate-50"}`}
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={seleccion.has(gasto.id)}
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
                <td className="px-4 py-3 whitespace-nowrap text-slate-500">{formatoFecha(gasto.createdAt)}</td>
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
