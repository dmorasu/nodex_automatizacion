"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import clsx from "clsx"
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Download, Loader2, Phone, MapPin, X } from "lucide-react"
import { consultarEstadoDeCuenta } from "@/actions/gastos/anticipos"
import { formatoFecha, formatoFechaHora, formatoMoneda } from "@/src/lib/formato"
import type { EstadoCuentaCliente as EstadoCuenta } from "@/src/schemas/gastos"
import EstadoAnticipo from "../anticipos/EstadoAnticipo"
import EstadoGasto from "../gastos/EstadoGasto"
import { claseInput } from "../ui/estilos"

// Días en hora de Colombia (YYYY-MM-DD)
const dia = (fecha: Date) => fecha.toLocaleDateString("en-CA", { timeZone: "America/Bogota" })
const haceDias = (n: number) => dia(new Date(Date.now() - n * 86400000))
const inicioDeMes = () => `${dia(new Date()).slice(0, 7)}-01`

const PERIODOS = [
  { clave: "todo", nombre: "Todo", rango: () => ({ desde: "", hasta: "" }) },
  { clave: "hoy", nombre: "Hoy", rango: () => ({ desde: dia(new Date()), hasta: dia(new Date()) }) },
  { clave: "7", nombre: "Últimos 7 días", rango: () => ({ desde: haceDias(6), hasta: dia(new Date()) }) },
  { clave: "mes", nombre: "Este mes", rango: () => ({ desde: inicioDeMes(), hasta: dia(new Date()) }) }
] as const

type Movimiento = EstadoCuenta["movimientos"][number]

// Qué fue cada movimiento, en palabras
const detalle = (m: Movimiento) => {
  if (m.tipo === "ANTICIPO") {
    return { titulo: "Pago del cliente (anticipo)", enlace: m.anticipoId ? { href: `/anticipos/${m.anticipoId}`, texto: m.anticipoCodigo } : null, extra: [m.reciboCaja && `Recibo de caja ${m.reciboCaja}`, m.anticipoConcepto].filter(Boolean).join(" · ") }
  }
  if (m.tipo === "PAGO") {
    return { titulo: "Pago de gasto", enlace: m.gastoId ? { href: `/solicitudes/${m.gastoId}`, texto: m.gastoCodigo } : null, extra: [m.gastoConcepto, m.beneficiario && `a ${m.beneficiario}`, m.lotePagoId && `lote #${m.lotePagoId}`].filter(Boolean).join(" · ") }
  }
  if (m.tipo === "REINTEGRO") {
    return { titulo: "Reintegro (devolución de sobrante)", enlace: m.gastoId ? { href: `/solicitudes/${m.gastoId}`, texto: m.gastoCodigo } : null, extra: m.gastoConcepto ?? "" }
  }
  return { titulo: m.tipo === "AJUSTE" ? "Ajuste" : m.tipo, enlace: null, extra: m.observacion ?? "" }
}

// Panel lateral con el estado de cuenta de un cliente en una bolsa de anticipos: cuánto pagó,
// en qué se gastó (con el saldo después de cada movimiento), lo que tiene por pagar y sus anticipos.
export default function EstadoCuentaCliente({
  bolsaId,
  clienteId,
  onCerrar
}: {
  bolsaId: number
  clienteId: number
  onCerrar: () => void
}) {
  const [periodo, setPeriodo] = useState<string>("todo")
  const [rango, setRango] = useState({ desde: "", hasta: "" })
  const [datos, setDatos] = useState<EstadoCuenta | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async (desde: string, hasta: string) => {
    setCargando(true)
    const resultado = await consultarEstadoDeCuenta(bolsaId, clienteId, desde || undefined, hasta || undefined)
    setCargando(false)
    if (resultado.ok) {
      setDatos(resultado.datos)
      setError(null)
    } else {
      setError(resultado.errores[0])
    }
  }, [bolsaId, clienteId])

  useEffect(() => { void cargar(rango.desde, rango.hasta) }, [cargar, rango])

  const elegirPeriodo = (clave: string) => {
    const opcion = PERIODOS.find(p => p.clave === clave)
    setPeriodo(clave)
    if (opcion) setRango(opcion.rango())
  }

  const saldo = datos?.saldo
  const p = datos?.periodo
  const conPeriodo = Boolean(rango.desde || rango.hasta)
  // Lo más reciente arriba (el saldo de cada fila es el que quedó después de ese movimiento)
  const movimientos = [...(datos?.movimientos ?? [])].reverse()

  return (
    <Dialog open onClose={onCerrar} className="relative z-50">
      <div className="fixed inset-0 bg-slate-900/30" aria-hidden="true" />

      <div className="fixed inset-y-0 right-0 flex w-full max-w-2xl">
        <DialogPanel className="flex w-full flex-col bg-slate-50 shadow-2xl">

          {/* Encabezado */}
          <div className="border-b border-slate-200 bg-white px-6 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Estado de cuenta · {datos?.bolsa.nombre ?? "…"}</p>
                <DialogTitle className="mt-0.5 truncate text-base font-semibold text-slate-800">{datos?.cliente.nombre ?? "Cargando…"}</DialogTitle>
                {datos && (
                  <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-slate-500">
                    <span>{datos.cliente.tipoIdentificacion === "CC" ? "Cédula" : datos.cliente.tipoIdentificacion} {datos.cliente.identificacion}</span>
                    {datos.cliente.telefono && <span className="inline-flex items-center gap-1"><Phone size={11} />{datos.cliente.telefono}</span>}
                    {datos.cliente.direccion && <span className="inline-flex items-center gap-1"><MapPin size={11} />{datos.cliente.direccion}</span>}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {/* Excel del estado de cuenta, con el período elegido */}
                <a
                  href={`/descargas/arqueo?${new URLSearchParams({ bolsaId: String(bolsaId), clienteId: String(clienteId), ...(rango.desde && { desde: rango.desde }), ...(rango.hasta && { hasta: rango.hasta }) })}`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  <Download size={14} />
                  Excel
                </a>
                <button type="button" onClick={onCerrar} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Cerrar">
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Resumen del cliente (siempre total, sin importar el período) */}
            {saldo && (
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ["Pagó", saldo.ingresado, "text-slate-800"],
                  ["Gastos pagados", saldo.pagado, "text-slate-800"],
                  ["Por pagar", saldo.comprometido, "text-slate-800"],
                  ["Disponible", saldo.disponible, saldo.disponible < 0 ? "text-red-600" : "text-emerald-700"]
                ].map(([nombre, valor, clase]) => (
                  <div key={nombre as string} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">{nombre}</p>
                    <p className={`text-sm font-semibold ${clase}`}>{formatoMoneda(valor as number)}</p>
                  </div>
                ))}
              </div>
            )}
            {saldo && saldo.disponible < 0 && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-600">
                <AlertTriangle size={13} /> Sus gastos superan lo que pagó: faltan {formatoMoneda(-saldo.disponible)}.
              </p>
            )}
            {saldo && saldo.disponible > 0 && saldo.comprometido === 0 && (
              <p className="mt-2 text-xs font-medium text-emerald-700">Sobrante a favor del cliente: {formatoMoneda(saldo.disponible)}.</p>
            )}
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">

            {/* Período */}
            <div className="flex flex-wrap items-end gap-2">
              {PERIODOS.map(o => (
                <button
                  key={o.clave}
                  type="button"
                  onClick={() => elegirPeriodo(o.clave)}
                  className={clsx("rounded-full border px-3 py-1 text-xs font-semibold",
                    periodo === o.clave ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50")}
                >
                  {o.nombre}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-1.5">
                <input
                  type="date" value={rango.desde} aria-label="Desde"
                  onChange={e => { setPeriodo("otro"); setRango(r => ({ ...r, desde: e.target.value })) }}
                  className={`${claseInput} h-8 w-36`}
                />
                <span className="text-xs text-slate-400">a</span>
                <input
                  type="date" value={rango.hasta} aria-label="Hasta"
                  onChange={e => { setPeriodo("otro"); setRango(r => ({ ...r, hasta: e.target.value })) }}
                  className={`${claseInput} h-8 w-36`}
                />
              </div>
            </div>

            {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

            {/* Movimientos */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700">Movimientos</h3>
                {cargando && <Loader2 size={15} className="animate-spin text-slate-400" />}
              </div>

              {p && (
                <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <p className="rounded-md bg-white px-3 py-2 text-slate-500">Saldo inicial<b className="block text-slate-800">{formatoMoneda(p.saldoInicial)}</b></p>
                  <p className="rounded-md bg-white px-3 py-2 text-slate-500">Entradas<b className="block text-emerald-700">+{formatoMoneda(p.entradas)}</b></p>
                  <p className="rounded-md bg-white px-3 py-2 text-slate-500">Salidas<b className="block text-red-600">{formatoMoneda(p.salidas)}</b></p>
                  <p className="rounded-md bg-white px-3 py-2 text-slate-500">Saldo final<b className="block text-slate-800">{formatoMoneda(p.saldoFinal)}</b></p>
                </div>
              )}

              <ol className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
                {movimientos.map(m => {
                  const d = detalle(m)
                  const entra = m.valor > 0
                  return (
                    <li key={m.id} className="flex items-start gap-3 px-4 py-3">
                      <span className={clsx("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                        entra ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500")}>
                        {entra ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-slate-700">
                          {d.titulo}
                          {d.enlace && <Link href={d.enlace.href} className="ml-1.5 font-semibold text-emerald-700 hover:underline">{d.enlace.texto}</Link>}
                        </p>
                        {d.extra && <p className="truncate text-[11px] text-slate-500">{d.extra}</p>}
                        <p className="text-[11px] text-slate-400">{formatoFechaHora(m.fecha)}{m.usuario && ` · ${m.usuario}`}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={clsx("text-xs font-semibold whitespace-nowrap", entra ? "text-emerald-700" : "text-red-600")}>
                          {entra && "+"}{formatoMoneda(m.valor)}
                        </p>
                        <p className="text-[11px] text-slate-400 whitespace-nowrap">saldo {formatoMoneda(m.saldo)}</p>
                      </div>
                    </li>
                  )
                })}
                {!cargando && movimientos.length === 0 && (
                  <li className="py-8 text-center text-xs text-slate-400">{conPeriodo ? "Sin movimientos en este período." : "Sin movimientos."}</li>
                )}
              </ol>
            </section>

            {/* Por pagar */}
            {datos && datos.porPagar.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-700">Gastos por pagar <span className="font-normal text-slate-400">· comprometen su saldo</span></h3>
                <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
                  {datos.porPagar.map(g => (
                    <li key={g.id} className="flex items-center justify-between gap-3 px-4 py-3 text-xs">
                      <div className="min-w-0">
                        <Link href={`/solicitudes/${g.id}`} className="font-semibold text-emerald-700 hover:underline">{g.codigo}</Link>
                        <p className="truncate text-slate-500">{g.concepto}{g.anticipoCodigo && ` · ${g.anticipoCodigo}`}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <EstadoGasto codigo={g.estadoCodigo} nombre={g.estado} />
                        <b className="text-slate-800">{formatoMoneda(g.valor)}</b>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Anticipos */}
            {datos && datos.anticipos.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-700">Anticipos del cliente en esta bolsa</h3>
                <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
                  {datos.anticipos.map(a => (
                    <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3 text-xs">
                      <div className="min-w-0">
                        <Link href={`/anticipos/${a.id}`} className="font-semibold text-emerald-700 hover:underline">{a.codigo}</Link>
                        <p className="truncate text-slate-500">
                          {a.concepto} · {a.placa ?? a.matriculaInmobiliaria} · consignó el {formatoFecha(a.fechaConsignacion)}
                          {a.reciboCaja && ` · RC ${a.reciboCaja}`}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <EstadoAnticipo estado={a.estado} />
                        <b className="text-slate-800">{formatoMoneda(a.valorRecibido ?? a.valorConsignado)}</b>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
