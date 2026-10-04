"use client"

import { ExternalLink, Receipt, Wallet } from "lucide-react"
import { formatoFecha, formatoFechaSinZona, formatoMoneda } from "@/src/ultis"
import type { GastoTramite } from "@/src/gastos/datosGastos"

// Colores por estado del gasto (mismos estados de Nodex Gastos)
const COLORES_ESTADO: Record<string, string> = {
  SOLICITADO: "bg-amber-50 text-amber-700 border-amber-200",
  PAGADO: "bg-sky-50 text-sky-700 border-sky-200",
  FACTURADO: "bg-indigo-50 text-indigo-700 border-indigo-200",
  EN_CUENTA_COBRO: "bg-violet-50 text-violet-700 border-violet-200",
  LEGALIZADO: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CONTABILIZADO: "bg-slate-100 text-slate-700 border-slate-300",
  ANULADO: "bg-red-50 text-red-600 border-red-200"
}

const suma = (valores: (string | number | null | undefined)[]) =>
  valores.reduce<number>((total, v) => total + Number(v ?? 0), 0)

function Resumen({ etiqueta, valor }: { etiqueta: string, valor: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{etiqueta}</p>
      <p className="mt-1 text-base font-semibold text-slate-800">{valor}</p>
    </div>
  )
}

// Pestaña "Gastos" del detalle del trámite: lo que se ha pedido, pagado y legalizado
export default function GastosTramite({
  gastos,
  urlGastos,
  accion
}: {
  gastos: GastoTramite[]
  // Dirección de Nodex Gastos para abrir el detalle (si está configurada)
  urlGastos: string | null
  // Botón "Crear gasto" (solo Gestión de activos)
  accion?: React.ReactNode
}) {
  const vigentes = gastos.filter(g => g.estado.codigo !== "ANULADO")
  const reintegrosPendientes = suma(vigentes.flatMap(g => g.reintegros.filter(r => r.estado.codigo === "PENDIENTE").map(r => r.valorReintegro)))

  return (
    <div className="space-y-6">

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Gastos del trámite</h3>
          <p className="text-xs text-gray-500">Gestionados en Nodex Gastos</p>
        </div>
        {accion}
      </div>

      {vigentes.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Resumen etiqueta="Solicitado" valor={formatoMoneda(suma(vigentes.map(g => g.valorSolicitadoPago)))} />
          <Resumen etiqueta="Pagado" valor={formatoMoneda(suma(vigentes.map(g => g.valorRealmentePagado)))} />
          <Resumen etiqueta="Facturado" valor={formatoMoneda(suma(vigentes.map(g => g.factura?.valorFactura)))} />
          <Resumen etiqueta="Reintegros pendientes" valor={formatoMoneda(reintegrosPendientes)} />
        </div>
      )}

      {gastos.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 py-12 text-center">
          <Wallet size={28} className="text-gray-300" />
          <p className="text-sm text-gray-500">Este trámite no tiene gastos.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {gastos.map(gasto => (
            <li key={gasto.id} className="rounded-lg border border-gray-200 bg-white px-4 py-3 hover:border-sky-200 transition">
              <div className="flex flex-wrap items-start justify-between gap-3">

                <div className="flex items-start gap-3 min-w-0">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50">
                    <Receipt size={17} className="text-sky-500" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-800">{gasto.codigo}</p>
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${COLORES_ESTADO[gasto.estado.codigo] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
                        {gasto.estado.nombre}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-600">{gasto.conceptoPago}</p>
                    <p className="mt-1 text-[11px] text-gray-400">
                      {gasto.tipoGasto.nombre} · {gasto.beneficiario.nombre} · {gasto.bolsa?.nombre ?? "Sin bolsa"} · creado {formatoFecha(gasto.createdAt)}
                      {gasto.creador && ` por ${gasto.creador.nombreUsuario}`}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-800">{formatoMoneda(gasto.valorSolicitadoPago)}</p>
                  <p className="text-[11px] text-gray-400">solicitado</p>
                </div>
              </div>

              {/* Avance del gasto */}
              <dl className="mt-3 grid gap-3 border-t border-gray-100 pt-3 text-xs sm:grid-cols-4">
                <div>
                  <dt className="text-[11px] text-gray-400">Pagado</dt>
                  <dd className="font-medium text-slate-700">
                    {gasto.valorRealmentePagado ? `${formatoMoneda(gasto.valorRealmentePagado)} · ${formatoFechaSinZona(gasto.fechaPago)}` : "Pendiente"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-gray-400">Factura</dt>
                  <dd className="font-medium text-slate-700">
                    {gasto.factura ? `${formatoMoneda(gasto.factura.valorFactura)}${gasto.factura.numeroFactura ? ` · N° ${gasto.factura.numeroFactura}` : ""}` : "Pendiente"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-gray-400">Reintegro</dt>
                  <dd className="font-medium text-slate-700">
                    {gasto.reintegros.length
                      ? gasto.reintegros.map(r => `${formatoMoneda(r.valorReintegro)} (${r.estado.nombre.toLowerCase()})`).join(", ")
                      : "—"}
                  </dd>
                </div>
                <div className="sm:text-right">
                  {urlGastos && (
                    <a
                      href={`${urlGastos}/solicitudes/${gasto.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-sky-600 hover:underline"
                    >
                      Ver en Nodex Gastos
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
