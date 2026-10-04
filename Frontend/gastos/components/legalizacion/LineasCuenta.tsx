"use client"

import { useTransition } from "react"
import Link from "next/link"
import { toast } from "react-toastify"
import { X } from "lucide-react"
import { quitarLinea } from "@/actions/gastos/legalizacion"
import { formatoMoneda } from "@/src/lib/formato"
import type { LineaCuenta } from "@/src/schemas/gastos"

const aCentavos = (valor: string | number | null) => Math.round(Number(valor ?? 0) * 100)

// Gastos de la cuenta de cobro con los valores de su factura.
// Para corregir una factura, se saca el gasto de la cuenta y se corrige desde el gasto.
export default function LineasCuenta({ cuentaId, lineas, editable }: { cuentaId: number, lineas: LineaCuenta[], editable: boolean }) {
  const [quitando, startQuitar] = useTransition()

  const quitar = (linea: LineaCuenta) => {
    if (!confirm(`¿Sacar ${linea.solicitudGasto.codigo} de la cuenta de cobro? Volverá a Facturado.`)) return

    startQuitar(async () => {
      const resultado = await quitarLinea(cuentaId, linea.id)
      if (resultado.ok) toast.success(`${linea.solicitudGasto.codigo} retirado`)
      else resultado.errores.forEach(error => toast.error(error))
    })
  }

  return (
    <div className="overflow-x-auto rounded-md border border-slate-200">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-3 font-semibold">Gasto</th>
            <th className="px-3 py-3 font-semibold">Tercero de la factura</th>
            <th className="px-3 py-3 font-semibold">Bolsa</th>
            <th className="px-3 py-3 font-semibold text-right">Pagado</th>
            <th className="px-3 py-3 font-semibold text-right">Factura</th>
            <th className="px-3 py-3 font-semibold text-right" title="Pagado − factura">Reintegro</th>
            <th className="px-3 py-3 font-semibold text-right">4x1000</th>
            <th className="px-3 py-3 font-semibold text-right">Legalizado</th>
            {editable && <th className="px-3 py-3" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {lineas.map(linea => {
            const gasto = linea.solicitudGasto
            const reintegro = (aCentavos(gasto.valorRealmentePagado) - aCentavos(linea.valorFactura)) / 100

            return (
              <tr key={linea.id}>
                <td className="px-3 py-3">
                  <Link href={`/solicitudes/${gasto.id}`} className="font-semibold text-emerald-700 hover:underline">{gasto.codigo}</Link>
                  <p className="text-[11px] text-slate-400 max-w-[200px] truncate">{gasto.conceptoPago}</p>
                </td>
                <td className="px-3 py-3 text-slate-600">
                  <p>{linea.nombreTerceroReal ?? "—"}</p>
                  <p className="text-[11px] text-slate-400">
                    {linea.identificacionTerceroReal}
                    {!linea.tieneFacturaReal && <span className="ml-1 text-amber-600">· sin factura real</span>}
                  </p>
                </td>
                <td className="px-3 py-3 text-slate-600">{gasto.bolsa?.nombre ?? "—"}</td>
                <td className="px-3 py-3 text-right text-slate-600 whitespace-nowrap">{formatoMoneda(gasto.valorRealmentePagado)}</td>
                <td className="px-3 py-3 text-right text-slate-700 whitespace-nowrap">{formatoMoneda(linea.valorFactura)}</td>
                <td className="px-3 py-3 text-right text-slate-600 whitespace-nowrap">{reintegro > 0 ? formatoMoneda(reintegro) : "—"}</td>
                <td className="px-3 py-3 text-right text-slate-500 whitespace-nowrap">{formatoMoneda(linea.cuatroXMil)}</td>
                <td className="px-3 py-3 text-right font-semibold text-slate-800 whitespace-nowrap">{formatoMoneda(linea.valorLegalizado)}</td>
                {editable && (
                  <td className="px-3 py-3 text-right">
                    <button type="button" onClick={() => quitar(linea)} disabled={quitando} className="p-1.5 text-slate-400 hover:text-red-500" aria-label={`Quitar ${gasto.codigo}`}>
                      <X size={15} />
                    </button>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>

      {lineas.length === 0 && (
        <p className="py-10 text-center text-xs text-slate-400">
          Esta cuenta no tiene gastos. Agréguelos desde la pestaña Gastos con factura.
        </p>
      )}
    </div>
  )
}
