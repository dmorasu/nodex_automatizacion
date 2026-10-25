"use client"

import { useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import clsx from "clsx"
import { toast } from "react-toastify"
import { AlertTriangle, BadgeCheck, ChevronLeft, ChevronRight, FilePlus2, Loader2, Search } from "lucide-react"
import { llamarApi } from "@/src/lib/apiCliente"
import { claseBotonPrimario, claseBotonSecundario, claseInput } from "@/components/ui/estilos"
import {
  ESTADOS_CUENTA,
  fechaCorta,
  fechaHora,
  nombreSemana,
  pesos,
  type ClavePestana,
  type CuentaResumen,
  type ListadoCuentas,
  type PorGenerar
} from "@/src/cuentasCobro"
import DetalleCuenta from "./DetalleCuenta"

export default function PanelCuentasCobro({ pestana, porGenerar, listado, busqueda, pagina, cuentaInicial }: {
  pestana: ClavePestana
  porGenerar: PorGenerar[]
  listado: ListadoCuentas
  busqueda: string
  pagina: number
  cuentaInicial: number | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const parametros = useSearchParams()
  const [abierta, setAbierta] = useState<number | null>(cuentaInicial)

  // La cuenta abierta queda en la dirección (?cuenta=12) para poder compartirla; sin router.push
  // para no volver a pedir la página
  const abrir = (id: number | null) => {
    setAbierta(id)
    const nuevos = new URLSearchParams(parametros.toString())
    if (id) nuevos.set("cuenta", String(id))
    else nuevos.delete("cuenta")
    window.history.replaceState(null, "", `${pathname}${nuevos.size ? `?${nuevos}` : ""}`)
  }

  return (
    <>
      {pestana === "porGenerar" && <TablaPorGenerar filas={porGenerar} onGenerada={id => { router.refresh(); if (id) abrir(id) }} />}
      {pestana === "vistoBueno" && <VistoBuenoPorSemana cuentas={listado.cuentas} onAbrir={abrir} onHecho={() => router.refresh()} />}
      {pestana !== "porGenerar" && pestana !== "vistoBueno" && (
        <TablaCuentas pestana={pestana} listado={listado} busqueda={busqueda} pagina={pagina} onAbrir={abrir} />
      )}

      {abierta && <DetalleCuenta id={abierta} onCerrar={() => abrir(null)} onCambio={() => router.refresh()} />}
    </>
  )
}

const Vacio = ({ texto }: { texto: string }) => (
  <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-xs text-slate-500">{texto}</div>
)

const Estado = ({ estado }: { estado: CuentaResumen["estado"] }) => (
  <span className={clsx("inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold", ESTADOS_CUENTA[estado].clase)}>
    {ESTADOS_CUENTA[estado].nombre}
  </span>
)

// ── Por generar: trámites finalizados sin cuenta de cobro, por semana y tramitador ──
const clave = (semana: string, tramitadorId: number) => `${semana}|${tramitadorId}`

function TablaPorGenerar({ filas, onGenerada }: { filas: PorGenerar[], onGenerada: (cuentaId: number | null) => void }) {
  const [elegidos, setElegidos] = useState<string[]>([])
  const [generando, setGenerando] = useState<string | null>(null)

  const generar = async (claves: string[], quien: string) => {
    setGenerando(quien)
    const precuentas = claves.map(c => {
      const [semana, tramitadorId] = c.split("|")
      return { semana, tramitadorId: Number(tramitadorId) }
    })
    const r = await llamarApi<{ cuentaId: number, numero: string, tramites: number, nueva: boolean }[]>("/cuentas-cobro-tramitadores/generar", "POST", { precuentas })
    setGenerando(null)
    if (!r.ok) return toast.error(r.error)
    if (r.datos.length === 0) return toast.info("No había trámites por cobrar")
    toast.success(r.datos.length === 1
      ? `${r.datos[0].numero}: ${r.datos[0].tramites} trámite(s) ${r.datos[0].nueva ? "en la precuenta" : "agregados"}`
      : `${r.datos.length} precuentas generadas`)
    setElegidos(e => e.filter(x => !claves.includes(x)))
    onGenerada(r.datos.length === 1 ? r.datos[0].cuentaId : null)
  }

  if (filas.length === 0) return <Vacio texto="No hay trámites finalizados por cobrar." />

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button type="button" disabled={!elegidos.length || Boolean(generando)} onClick={() => generar(elegidos, "elegidos")} className={claseBotonPrimario}>
          {generando === "elegidos" ? <Loader2 size={15} className="animate-spin" /> : <FilePlus2 size={15} />}
          Generar precuenta{elegidos.length > 1 ? `s (${elegidos.length})` : ""}
        </button>
      </div>

      {filas.map(({ semana, tramitadores }) => {
        const claves = tramitadores.map(f => clave(semana, f.tramitador.id))
        const todos = claves.every(c => elegidos.includes(c))
        const cantidad = tramitadores.reduce((s, f) => s + f.cantidad, 0)
        return (
          <section key={semana} className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-700">Semana del {nombreSemana(semana)}</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {tramitadores.length} tramitador(es) · {cantidad} trámite(s) · {pesos(tramitadores.reduce((s, f) => s + f.total, 0))}
                </p>
              </div>
              <button type="button" disabled={Boolean(generando)} onClick={() => generar(claves, semana)} className={claseBotonSecundario}>
                {generando === semana ? <Loader2 size={15} className="animate-spin" /> : <FilePlus2 size={15} />}
                Generar las de la semana
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="w-10 px-4 py-3">
                      <input type="checkbox" checked={todos} className="h-4 w-4 accent-sky-600" aria-label="Elegir todos los de la semana"
                        onChange={() => setElegidos(e => todos ? e.filter(c => !claves.includes(c)) : [...new Set([...e, ...claves])])} />
                    </th>
                    <th className="px-4 py-3 font-semibold">Tramitador</th>
                    <th className="px-4 py-3 text-right font-semibold">Trámites</th>
                    <th className="px-4 py-3 font-semibold">Finalizados</th>
                    <th className="px-4 py-3 text-right font-semibold">Total</th>
                    <th className="px-4 py-3 font-semibold" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tramitadores.map(f => {
                    const c = clave(semana, f.tramitador.id)
                    const elegido = elegidos.includes(c)
                    return (
                      <tr key={c} className={clsx("hover:bg-slate-50", elegido && "bg-sky-50/40")}>
                        <td className="px-4 py-3">
                          <input type="checkbox" checked={elegido} className="h-4 w-4 accent-sky-600" aria-label={`Elegir a ${f.tramitador.nombre}`}
                            onChange={() => setElegidos(e => elegido ? e.filter(x => x !== c) : [...e, c])} />
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-700">{f.tramitador.nombre}</p>
                          <p className="text-[11px] text-slate-400">{f.tramitador.identificacion}{f.cuentaAbierta && ` · se agregan a ${f.cuentaAbierta.numero}`}</p>
                          {f.faltantes.length > 0 && (
                            <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-amber-700"><AlertTriangle size={12} /> Falta: {f.faltantes.join(", ")}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                          {f.cantidad}
                          {f.sinValor > 0 && <p className="text-[11px] font-medium text-amber-700">{f.sinValor} sin valor</p>}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">{f.desde === f.hasta ? fechaCorta(f.desde) : `${fechaCorta(f.desde)} – ${fechaCorta(f.hasta)}`}</td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-700">{pesos(f.total)}</td>
                        <td className="px-4 py-3 text-right">
                          <button type="button" disabled={Boolean(generando)} onClick={() => generar([c], c)} className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-sky-700 hover:bg-sky-50 disabled:opacity-50">
                            {generando === c ? <Loader2 size={14} className="animate-spin" /> : <FilePlus2 size={14} />}
                            Generar precuenta
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}
    </div>
  )
}

// ── Listado de cuentas (borradores, con el tramitador, Tesorería, pagadas, anuladas) ──
function TablaCuentas({ pestana, listado, busqueda, pagina, onAbrir }: {
  pestana: ClavePestana
  listado: ListadoCuentas
  busqueda: string
  pagina: number
  onAbrir: (id: number) => void
}) {
  const paginas = Math.max(1, Math.ceil(listado.total / listado.porPagina))
  const enlace = (p: number) => `/center/cuentasCobro?pestana=${pestana}${busqueda ? `&q=${encodeURIComponent(busqueda)}` : ""}&pagina=${p}`
  const columnaFecha = { borradores: "Actualizada", tramitador: "Enviada", tesoreria: "Radicada", pagadas: "Pagada", anuladas: "Actualizada" }[pestana as string] ?? "Fecha"
  const fecha = (c: CuentaResumen) => ({
    tramitador: fechaHora(c.enviadaEn),
    tesoreria: fechaCorta(c.fechaRadicacion),
    pagadas: fechaCorta(c.fechaPago)
  }[pestana as string] ?? fechaHora(c.actualizadaEn))

  return (
    <div className="space-y-3">
      <form className="flex max-w-md gap-2" action="/center/cuentasCobro">
        <input type="hidden" name="pestana" value={pestana} />
        <input name="q" defaultValue={busqueda} placeholder="Número o tramitador" className={claseInput} />
        <button type="submit" className={claseBotonSecundario} aria-label="Buscar"><Search size={15} /></button>
      </form>

      {listado.cuentas.length === 0 ? <Vacio texto={busqueda ? "No hay cuentas con esa búsqueda." : "No hay cuentas en esta pestaña."} /> : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Número</th>
                <th className="px-4 py-3 font-semibold">Tramitador</th>
                <th className="px-4 py-3 font-semibold">Semana</th>
                <th className="px-4 py-3 text-right font-semibold">Trámites</th>
                <th className="px-4 py-3 text-right font-semibold">Total</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold">{columnaFecha}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {listado.cuentas.map(c => (
                <tr key={c.id} onClick={() => onAbrir(c.id)} className="cursor-pointer hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <button type="button" onClick={e => { e.stopPropagation(); onAbrir(c.id) }} className="font-semibold text-sky-700 hover:underline">{c.numero}</button>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{c.tramitador.nombre}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{nombreSemana(c.semana)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">{c.tramites}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-700">{pesos(c.total)}</td>
                  <td className="px-4 py-3"><Estado estado={c.estado} /></td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">{fecha(c)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {paginas > 1 && (
        <div className="flex items-center justify-end gap-2 text-xs text-slate-500">
          Página {pagina} de {paginas}
          <a href={enlace(pagina - 1)} className={clsx(claseBotonSecundario, "!h-8 !px-2", pagina <= 1 && "pointer-events-none opacity-40")} aria-label="Anterior"><ChevronLeft size={15} /></a>
          <a href={enlace(pagina + 1)} className={clsx(claseBotonSecundario, "!h-8 !px-2", pagina >= paginas && "pointer-events-none opacity-40")} aria-label="Siguiente"><ChevronRight size={15} /></a>
        </div>
      )}
    </div>
  )
}

// ── Por visto bueno: las aprobadas por el tramitador, agrupadas por semana ──
function VistoBuenoPorSemana({ cuentas, onAbrir, onHecho }: { cuentas: CuentaResumen[], onAbrir: (id: number) => void, onHecho: () => void }) {
  const [elegidas, setElegidas] = useState<number[]>([])
  const [enviando, setEnviando] = useState<string | null>(null)

  if (cuentas.length === 0) return <Vacio texto="No hay cuentas aprobadas por los tramitadores esperando el visto bueno." />

  const semanas = [...new Set(cuentas.map(c => c.semana))].sort().reverse()

  const darVistoBueno = async (semana: string, ids: number[]) => {
    if (!confirm(`¿Dar el visto bueno a ${ids.length} cuenta(s)? Pasan a Tesorería para el pago y quedan radicadas hoy.`)) return
    setEnviando(semana)
    const r = await llamarApi<{ mensaje: string }>("/cuentas-cobro-tramitadores/visto-bueno", "POST", { cuentaIds: ids })
    setEnviando(null)
    if (!r.ok) return toast.error(r.error)
    toast.success(r.datos.mensaje)
    setElegidas(e => e.filter(id => !ids.includes(id)))
    onHecho()
  }

  return (
    <div className="space-y-5">
      {semanas.map(semana => {
        const deLaSemana = cuentas.filter(c => c.semana === semana)
        const elegidasSemana = deLaSemana.filter(c => elegidas.includes(c.id)).map(c => c.id)
        const ids = elegidasSemana.length ? elegidasSemana : deLaSemana.map(c => c.id)
        const total = deLaSemana.filter(c => ids.includes(c.id)).reduce((s, c) => s + c.total, 0)
        const todas = elegidasSemana.length === deLaSemana.length
        return (
          <section key={semana} className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-700">Semana del {nombreSemana(semana)}</h2>
                <p className="mt-0.5 text-xs text-slate-500">{deLaSemana.length} cuenta(s) · {pesos(deLaSemana.reduce((s, c) => s + c.total, 0))}</p>
              </div>
              <button type="button" disabled={Boolean(enviando)} onClick={() => darVistoBueno(semana, ids)} className={claseBotonPrimario}>
                {enviando === semana ? <Loader2 size={15} className="animate-spin" /> : <BadgeCheck size={15} />}
                {elegidasSemana.length ? `Visto bueno a ${elegidasSemana.length} · ${pesos(total)}` : "Dar visto bueno a la semana"}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="w-10 px-4 py-3">
                      <input type="checkbox" checked={todas} onChange={() => setElegidas(e => todas ? e.filter(id => !deLaSemana.some(c => c.id === id)) : [...new Set([...e, ...deLaSemana.map(c => c.id)])])} className="h-4 w-4 accent-sky-600" aria-label="Elegir todas" />
                    </th>
                    <th className="px-4 py-3 font-semibold">Número</th>
                    <th className="px-4 py-3 font-semibold">Tramitador</th>
                    <th className="px-4 py-3 text-right font-semibold">Trámites</th>
                    <th className="px-4 py-3 text-right font-semibold">Total</th>
                    <th className="px-4 py-3 font-semibold">Aprobada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {deLaSemana.map(c => {
                    const elegida = elegidas.includes(c.id)
                    return (
                      <tr key={c.id} className={clsx("hover:bg-slate-50", elegida && "bg-sky-50/40")}>
                        <td className="px-4 py-3">
                          <input type="checkbox" checked={elegida} onChange={() => setElegidas(e => elegida ? e.filter(x => x !== c.id) : [...e, c.id])} className="h-4 w-4 accent-sky-600" aria-label={`Elegir ${c.numero}`} />
                        </td>
                        <td className="px-4 py-3"><button type="button" onClick={() => onAbrir(c.id)} className="font-semibold text-sky-700 hover:underline">{c.numero}</button></td>
                        <td className="px-4 py-3 text-slate-700">{c.tramitador.nombre}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-600">{c.tramites}</td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-700">{pesos(c.total)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-500">{fechaHora(c.aprobadaEn)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}
    </div>
  )
}
