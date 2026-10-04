"use client"

import { useEffect, useState } from "react"
import { Search, UserPlus, Loader2 } from "lucide-react"
import { buscarTerceros } from "@/actions/gastos/gastos"
import type { Tercero } from "@/src/schemas/gastos"
import { claseInput } from "../ui/estilos"

// Busca terceros por identificación o nombre (desde 3 caracteres).
// Si no existe, permite pasar a registrar uno nuevo con lo que se escribió.
export default function BuscadorBeneficiario({
  onSeleccionar,
  onNuevo
}: {
  onSeleccionar: (tercero: Tercero) => void
  onNuevo: (identificacion: string) => void
}) {
  const [busqueda, setBusqueda] = useState("")
  const [resultados, setResultados] = useState<Tercero[]>([])
  const [buscando, setBuscando] = useState(false)

  // Espera a que el usuario deje de escribir antes de consultar
  useEffect(() => {
    const texto = busqueda.trim()

    if (texto.length < 3) {
      setResultados([])
      return
    }

    setBuscando(true)
    const espera = setTimeout(async () => {
      setResultados(await buscarTerceros(texto))
      setBuscando(false)
    }, 350)

    return () => clearTimeout(espera)
  }, [busqueda])

  const sinResultados = busqueda.trim().length >= 3 && !buscando && resultados.length === 0

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
        <input
          type="search"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por identificación o nombre (mínimo 3 caracteres)"
          className={`${claseInput} pl-9`}
          aria-label="Buscar beneficiario"
        />
        {buscando && <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />}
      </div>

      {resultados.length > 0 && (
        <ul className="max-h-56 overflow-y-auto rounded-md border border-slate-200 divide-y divide-slate-100">
          {resultados.map(tercero => (
            <li key={tercero.id}>
              <button
                type="button"
                onClick={() => onSeleccionar(tercero)}
                className="w-full px-3 py-2 text-left hover:bg-emerald-50"
              >
                <p className="text-xs font-medium text-slate-700">{tercero.nombre}</p>
                <p className="text-[11px] text-slate-400">
                  {tercero.tipoIdentificacion} {tercero.identificacion}
                  {tercero.banco && ` · ${tercero.banco} ${tercero.tipoCuenta ?? ""} ${tercero.numeroCuenta ?? ""}`}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {sinResultados && <p className="text-[11px] text-slate-400">No se encontró ningún beneficiario.</p>}

      <button
        type="button"
        onClick={() => onNuevo(/^\d/.test(busqueda.trim()) ? busqueda.trim() : "")}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:underline"
      >
        <UserPlus size={14} />
        Registrar un beneficiario nuevo
      </button>
    </div>
  )
}
