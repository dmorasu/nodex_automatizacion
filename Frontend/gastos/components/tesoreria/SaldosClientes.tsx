"use client"

import { useEffect, useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import clsx from "clsx"
import { AlertTriangle, CheckCircle2, ChevronRight, Download, Loader2, Search, SlidersHorizontal } from "lucide-react"
import { formatoFechaHora, formatoMoneda } from "@/src/lib/formato"
import { FILTROS_ARQUEO, ORDENES_ARQUEO, type Arqueo, type SaldoCliente } from "@/src/schemas/gastos"
import ModalSaldoBolsa from "./ModalSaldoBolsa"
import EstadoCuentaCliente from "./EstadoCuentaCliente"
import Paginacion from "../ui/Paginacion"
import { claseBotonSecundario, claseInput } from "../ui/estilos"

// Arqueo de una bolsa de anticipos: saldo de cada cliente (lo que pagó menos sus gastos) y el
// cuadre contra el saldo de la bolsa. Disponible = saldo − gastos creados que aún no se pagan:
// positivo es sobrante, negativo es faltante. Los totales y el cuadre son de todos los clientes;
// la tabla se busca, filtra, ordena y pagina en el servidor (los parámetros van en la URL).
// Al tocar un cliente se abre su estado de cuenta.
export default function SaldosClientes({ arqueo, esAdmin }: { arqueo: Arqueo, esAdmin: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const parametros = useSearchParams()
  const [navegando, startNavegar] = useTransition()

  const [ajuste, setAjuste] = useState<SaldoCliente | null>(null)
  const [abierto, setAbierto] = useState<number | null>(null)
  const [busqueda, setBusqueda] = useState(parametros.get("busqueda") ?? "")

  const { bolsa, totales, conteos } = arqueo
  const filtro = parametros.get("filtro") ?? ""
  const orden = parametros.get("orden") ?? "faltante"
  const cuadra = totales.diferencia === 0

  // Cambia parámetros de la URL (vuelve a la página 1 salvo que se cambie la página)
  const ir = (cambios: Record<string, string>) => {
    const nuevos = new URLSearchParams(parametros)
    Object.entries(cambios).forEach(([clave, valor]) => (valor ? nuevos.set(clave, valor) : nuevos.delete(clave)))
    if (!("pagina" in cambios)) nuevos.delete("pagina")
    startNavegar(() => router.replace(`${pathname}?${nuevos}`, { scroll: false }))
  }

  // Busca mientras se escribe (espera a que deje de escribir)
  useEffect(() => {
    if (busqueda === (parametros.get("busqueda") ?? "")) return
    const espera = setTimeout(() => ir({ busqueda: busqueda.trim() }), 400)
    return () => clearTimeout(espera)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda])

  const urlPagina = (p: number) => {
    const nuevos = new URLSearchParams(parametros)
    nuevos.set("pagina", String(p))
    return `${pathname}?${nuevos}`
  }

  const excel = new URLSearchParams({ bolsaId: String(bolsa.id) })
  if (parametros.get("busqueda")) excel.set("busqueda", parametros.get("busqueda")!)
  if (filtro) excel.set("filtro", filtro)
  excel.set("orden", orden)

  return (
    <section className="space-y-4">

      {/* Totales y cuadre: siempre de todos los clientes */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={clsx("inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium",
          cuadra ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700")}>
          {cuadra ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          {cuadra
            ? `Arqueo: los ${totales.clientes} clientes cuadran con la bolsa (${formatoMoneda(bolsa.saldoActual)})`
            : `Arqueo: diferencia de ${formatoMoneda(totales.diferencia)} entre la bolsa y sus clientes`}
        </p>
        <a href={`/descargas/arqueo?${excel}`} className={claseBotonSecundario}>
          <Download size={15} />
          Exportar a Excel
        </a>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Saldo de los clientes", totales.saldo, "text-slate-800"],
          ["Gastos por pagar", totales.comprometido, "text-slate-800"],
          ["Sobrantes", totales.sobrantes, "text-emerald-700"],
          ["Faltantes", totales.faltantes, totales.faltantes < 0 ? "text-red-600" : "text-slate-800"]
        ].map(([nombre, valor, clase]) => (
          <div key={nombre as string} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">{nombre}</p>
            <p className={`mt-1 text-base font-semibold ${clase}`}>{formatoMoneda(valor as number)}</p>
          </div>
        ))}
      </div>

      {/* Búsqueda, filtros rápidos y orden */}
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
            <input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar cliente por nombre o identificación"
              className={`${claseInput} pl-9`}
              aria-label="Buscar cliente"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            Ordenar por
            <select value={orden} onChange={e => ir({ orden: e.target.value })} className={`${claseInput} w-auto`}>
              {Object.entries(ORDENES_ARQUEO).map(([clave, nombre]) => <option key={clave} value={clave}>{nombre}</option>)}
            </select>
          </label>
          {navegando && <Loader2 size={16} className="animate-spin text-slate-400" />}
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            onClick={() => ir({ filtro: "" })}
            className={clsx("rounded-full border px-3 py-1 font-semibold", !filtro ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500 hover:bg-slate-50")}
          >
            Todos · {totales.clientes}
          </button>
          {(Object.keys(FILTROS_ARQUEO) as (keyof typeof FILTROS_ARQUEO)[]).map(clave => (
            <button
              key={clave}
              type="button"
              onClick={() => ir({ filtro: filtro === clave ? "" : clave })}
              className={clsx("rounded-full border px-3 py-1 font-semibold",
                filtro === clave
                  ? clave === "faltante" ? "border-red-300 bg-red-50 text-red-700" : "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 text-slate-500 hover:bg-slate-50")}
            >
              {FILTROS_ARQUEO[clave]} · {conteos[clave]}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-400">
        {arqueo.total} cliente(s){filtro || parametros.get("busqueda") ? " con estos filtros" : ""} · toque uno para ver su estado de cuenta
      </p>

      {/* Tabla con encabezado fijo al desplazarse */}
      <div className="max-h-[65vh] overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 shadow-[0_1px_0_0_rgb(226,232,240)]">
            <tr>
              <th className="px-4 py-3 font-semibold">Cliente</th>
              <th className="px-4 py-3 font-semibold text-right">Pagó</th>
              <th className="px-4 py-3 font-semibold text-right">Gastos pagados</th>
              <th className="px-4 py-3 font-semibold text-right">Saldo</th>
              <th className="px-4 py-3 font-semibold text-right">Por pagar</th>
              <th className="px-4 py-3 font-semibold text-right">Disponible</th>
              <th className="px-4 py-3 font-semibold">Último movimiento</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className={clsx("divide-y divide-slate-100", navegando && "opacity-60")}>
            {arqueo.clientes.map(cliente => (
              <tr key={cliente.clienteId} onClick={() => setAbierto(cliente.clienteId)} className="cursor-pointer hover:bg-emerald-50/40">
                <td className="px-4 py-3">
                  <button type="button" onClick={() => setAbierto(cliente.clienteId)} className="text-left font-medium text-emerald-700 hover:underline">
                    {cliente.nombre}
                  </button>
                  <p className="text-[11px] text-slate-400">{cliente.tipoIdentificacion} {cliente.identificacion}</p>
                </td>
                <td className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">{formatoMoneda(cliente.ingresado)}</td>
                <td className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">{formatoMoneda(cliente.pagado)}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-800 whitespace-nowrap">{formatoMoneda(cliente.saldo)}</td>
                <td className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">{formatoMoneda(cliente.comprometido)}</td>
                <td className={clsx("px-4 py-3 text-right font-semibold whitespace-nowrap",
                  cliente.disponible < 0 ? "text-red-600" : cliente.disponible > 0 ? "text-emerald-700" : "text-slate-500")}>
                  {formatoMoneda(cliente.disponible)}
                  {cliente.disponible < 0 && <span className="block text-[10px] font-medium">faltante</span>}
                  {cliente.disponible > 0 && cliente.comprometido === 0 && <span className="block text-[10px] font-medium">sobrante</span>}
                </td>
                <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{cliente.ultimoMovimiento ? formatoFechaHora(cliente.ultimoMovimiento) : "—"}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {esAdmin && (
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setAjuste(cliente) }}
                      className="p-2 text-slate-400 hover:text-amber-600"
                      title="Ajustar saldo del cliente"
                      aria-label={`Ajustar saldo de ${cliente.nombre}`}
                    >
                      <SlidersHorizontal size={15} />
                    </button>
                  )}
                  <ChevronRight size={15} className="inline text-slate-300" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {arqueo.clientes.length === 0 && (
          <p className="py-10 text-center text-sm text-slate-400">
            {totales.clientes === 0 ? "Aún no hay anticipos confirmados en esta bolsa." : "Ningún cliente coincide con la búsqueda o el filtro."}
          </p>
        )}
      </div>

      <Paginacion pagina={arqueo.pagina} total={arqueo.total} tamano={arqueo.tamano} url={urlPagina} />

      {abierto !== null && (
        <EstadoCuentaCliente bolsaId={bolsa.id} clienteId={abierto} onCerrar={() => setAbierto(null)} />
      )}

      {ajuste && (
        <ModalSaldoBolsa
          bolsa={bolsa}
          tipo="AJUSTE"
          cliente={{ id: ajuste.clienteId, nombre: ajuste.nombre, saldo: ajuste.saldo }}
          onCerrar={() => setAjuste(null)}
        />
      )}
    </section>
  )
}
