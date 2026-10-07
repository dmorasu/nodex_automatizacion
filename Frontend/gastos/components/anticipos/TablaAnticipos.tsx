"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CheckCircle2 } from "lucide-react"
import { formatoFecha, formatoMoneda } from "@/src/lib/formato"
import { TIPOS_ANTICIPO, type AnticipoListado } from "@/src/schemas/gastos"
import { claseBotonPrimario } from "../ui/estilos"
import EstadoAnticipo from "./EstadoAnticipo"
import ModalConfirmarAnticipos from "./ModalConfirmarAnticipos"

// Listado de anticipos. Con `seleccionable` (Contabilidad, por confirmar) se marcan varios y se
// confirman juntos (recibo de caja masivo).
export default function TablaAnticipos({
  anticipos,
  seleccionable = false,
  vacio
}: {
  anticipos: AnticipoListado[]
  seleccionable?: boolean
  vacio: string
}) {
  const router = useRouter()
  const [seleccion, setSeleccion] = useState<number[]>([])
  const [confirmando, setConfirmando] = useState(false)

  const alternar = (id: number) =>
    setSeleccion(actual => actual.includes(id) ? actual.filter(x => x !== id) : [...actual, id])
  const todos = seleccionable && anticipos.length > 0 && seleccion.length === anticipos.length
  const seleccionados = anticipos.filter(a => seleccion.includes(a.id))
  const totalSeleccionado = seleccionados.reduce((t, a) => t + Number(a.valorConsignado), 0)

  return (
    <div className="space-y-3">
      {seleccionable && seleccion.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2.5">
          <p className="text-xs text-emerald-800">
            {seleccion.length} seleccionado(s) · {formatoMoneda(totalSeleccionado)} consignado
          </p>
          <button type="button" onClick={() => setConfirmando(true)} className={claseBotonPrimario}>
            <CheckCircle2 size={15} />
            Confirmar seleccionados
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              {seleccionable && (
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={todos}
                    onChange={() => setSeleccion(todos ? [] : anticipos.map(a => a.id))}
                    className="h-4 w-4 accent-emerald-600"
                    aria-label="Seleccionar todos"
                  />
                </th>
              )}
              <th className="px-4 py-3 font-semibold">Anticipo</th>
              <th className="px-4 py-3 font-semibold">Cliente</th>
              <th className="px-4 py-3 font-semibold">Vehículo / inmueble</th>
              <th className="px-4 py-3 font-semibold">Consignación</th>
              <th className="px-4 py-3 font-semibold text-right">Valor</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {anticipos.map(a => (
              <tr key={a.id} className={seleccion.includes(a.id) ? "bg-emerald-50/40" : "hover:bg-slate-50"}>
                {seleccionable && (
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={seleccion.includes(a.id)}
                      onChange={() => alternar(a.id)}
                      className="h-4 w-4 accent-emerald-600"
                      aria-label={`Seleccionar ${a.codigo}`}
                    />
                  </td>
                )}
                <td className="px-4 py-3">
                  <Link href={`/anticipos/${a.id}`} className="font-semibold text-emerald-700 hover:underline">{a.codigo}</Link>
                  <p className="text-[11px] text-slate-400">{a.operacion.nombreOperacion}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-700">{a.cliente.nombre}</p>
                  <p className="text-[11px] text-slate-400">{a.cliente.tipoIdentificacion} {a.cliente.identificacion} · {a.clienteEmpresarial.nombre}</p>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {TIPOS_ANTICIPO[a.tipo] ?? a.tipo}: <b className="font-medium">{a.placa ?? a.matriculaInmobiliaria}</b>
                  <p className="text-[11px] text-slate-400">{a.concepto}</p>
                </td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                  {formatoFecha(a.fechaConsignacion)}
                  {a.reciboCaja && <p className="text-[11px] text-slate-400">RC {a.reciboCaja}</p>}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <p className="font-semibold text-slate-800">{formatoMoneda(a.valorRecibido ?? a.valorConsignado)}</p>
                  {a.valorRecibido && Number(a.valorRecibido) !== Number(a.valorConsignado) && (
                    <p className="text-[11px] text-amber-700">consignó {formatoMoneda(a.valorConsignado)}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <EstadoAnticipo estado={a.estado} />
                  {a.estado === "CONFIRMADO" && (
                    <p className="mt-1 text-[11px] text-slate-400">{a.cantidadGastos ? `${a.cantidadGastos} gasto(s)` : "Sin gastos aún"}</p>
                  )}
                  {a.estado === "NOVEDAD" && a.motivoNovedad && <p className="mt-1 max-w-[220px] text-[11px] text-red-600">{a.motivoNovedad}</p>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {anticipos.length === 0 && <p className="py-14 text-center text-sm text-slate-400">{vacio}</p>}
      </div>

      {confirmando && (
        <ModalConfirmarAnticipos
          anticipos={seleccionados}
          onCerrar={() => setConfirmando(false)}
          onConfirmados={() => { setSeleccion([]); router.refresh() }}
        />
      )}
    </div>
  )
}
