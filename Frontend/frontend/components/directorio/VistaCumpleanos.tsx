"use client"

import { useState } from "react"
import clsx from "clsx"
import { Cake, ChevronLeft, ChevronRight } from "lucide-react"
import { MESES, celular, diasParaCumple, tituloMunicipio, type DatosDirectorio, type MunicipioDirectorio, type PersonaDirectorio } from "@/src/directorio"

const claseTarjeta = "rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const cuando = (d: number) => (d === 0 ? "¡Hoy!" : d === 1 ? "Mañana" : `En ${d} días`)

// Cumpleaños, como en el HTML de Torre de control: quién cumple hoy, los próximos 30 días,
// el mes (con flechas), el calendario del año y quién no tiene fecha
export default function VistaCumpleanos({ datos, municipios, verFicha }: {
  datos: DatosDirectorio
  municipios: Map<number, MunicipioDirectorio>
  verFicha: (p: PersonaDirectorio) => void
}) {
  const hoy = new Date()
  const mesActual = hoy.getMonth() + 1
  const [mes, setMes] = useState(mesActual)

  const conFecha = datos.tramitadores.filter(p => p.cumpleDia && p.cumpleMes)
  const sinFecha = datos.tramitadores.filter(p => !p.cumpleDia || !p.cumpleMes)
  const proximos = conFecha.map(p => ({ p, dias: diasParaCumple(p, hoy) ?? 999 })).sort((a, b) => a.dias - b.dias)
  const deHoy = proximos.filter(x => x.dias === 0)
  const en30 = proximos.filter(x => x.dias <= 30)
  const delMes = (m: number) => conFecha.filter(p => p.cumpleMes === m).sort((a, b) => a.cumpleDia! - b.cumpleDia!)

  const donde = (p: PersonaDirectorio) => {
    const r = p.residenciaId ? municipios.get(p.residenciaId) : undefined
    return r ? tituloMunicipio(r.nombre) : p.ciudad || "—"
  }

  const fila = (p: PersonaDirectorio, dias: number | null, pasado = false) => (
    <div key={p.id} className={clsx("flex items-center gap-3 border-b border-slate-100 py-2.5 last:border-0", pasado && "opacity-45")}>
      <span className={clsx("flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg border leading-none",
        dias === 0 ? "border-sky-600 bg-sky-600 text-white" : "border-slate-200 bg-slate-50 text-slate-700")}>
        <b className="text-lg">{p.cumpleDia}</b><span className="mt-0.5 text-[9px] uppercase tracking-wide">{MESES[p.cumpleMes! - 1].slice(0, 3)}</span>
      </span>
      <span className="min-w-0 flex-1">
        <button type="button" onClick={() => verFicha(p)} className="text-left text-sm font-medium text-slate-700 hover:text-sky-700 hover:underline">{p.nombre}</button>
        <span className="block text-[11px] text-slate-400">{p.esMensajero ? "Mensajero propio" : "Tramitador"} · {donde(p)}</span>
      </span>
      {dias !== null && (
        <span className={clsx("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
          dias === 0 ? "border-sky-200 bg-sky-50 text-sky-700" : dias <= 7 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-slate-50 text-slate-500")}>
          {cuando(dias)}
        </span>
      )}
    </div>
  )

  return (
    <div className="space-y-4">
      {deHoy.length > 0 && (
        <div className="flex items-center gap-4 rounded-xl border border-sky-200 bg-gradient-to-r from-sky-50 to-white px-5 py-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sky-600 text-white"><Cake size={24} /></span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-700">Hoy cumple{deHoy.length > 1 ? "n" : ""} años</p>
            {deHoy.map(x => (
              <p key={x.p.id} className="mt-0.5">
                <button type="button" onClick={() => verFicha(x.p)} className="text-lg font-semibold text-slate-800 hover:text-sky-700 hover:underline">{x.p.nombre}</button>
                <span className="ml-2 text-xs text-slate-500">{x.p.esMensajero ? "Mensajero propio" : "Tramitador"} · {donde(x.p)}{celular(x.p.whatsapp) ? ` · ${celular(x.p.whatsapp)}` : ""}</span>
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={claseTarjeta}>
          <h3 className="text-sm font-semibold text-slate-800">Próximos 30 días</h3>
          <p className="mb-1 text-[11px] text-slate-400">Ordenados por fecha.</p>
          {en30.length ? en30.map(x => fila(x.p, x.dias)) : <p className="mt-2 text-xs text-slate-400">Nadie cumple años en los próximos 30 días.</p>}
        </section>

        <section className={claseTarjeta}>
          <div className="mb-1 flex items-center gap-2">
            <button type="button" onClick={() => setMes(m => (m === 1 ? 12 : m - 1))} className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50" aria-label="Mes anterior"><ChevronLeft size={15} /></button>
            <h3 className="flex-1 text-center text-sm font-semibold tracking-wide text-slate-800">
              {MESES[mes - 1].toUpperCase()}{mes === mesActual && <span className="text-sky-600"> · ESTE MES</span>}
            </h3>
            <button type="button" onClick={() => setMes(m => (m === 12 ? 1 : m + 1))} className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50" aria-label="Mes siguiente"><ChevronRight size={15} /></button>
          </div>
          {delMes(mes).length ? delMes(mes).map(p => {
            const pasado = mes === mesActual && p.cumpleDia! < hoy.getDate()
            return fila(p, mes === mesActual && !pasado ? diasParaCumple(p, hoy) : null, pasado)
          }) : <p className="mt-2 text-xs text-slate-400">No hay cumpleaños registrados en {MESES[mes - 1]}.</p>}
        </section>
      </div>

      <section className={claseTarjeta}>
        <h3 className="text-sm font-semibold text-slate-800">Calendario del año</h3>
        <p className="mb-3 text-[11px] text-slate-400">Toque un mes para ver el detalle.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {MESES.map((nombre, i) => {
            const ps = delMes(i + 1)
            return (
              <button key={nombre} type="button" onClick={() => setMes(i + 1)} aria-pressed={mes === i + 1}
                className={clsx("flex min-h-28 flex-col rounded-lg border p-2.5 text-left transition hover:border-sky-300",
                  mes === i + 1 ? "border-sky-400 ring-2 ring-sky-100" : "border-slate-200",
                  i + 1 === mesActual ? "bg-sky-50" : "bg-white")}>
                <span className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">{mayuscula(nombre)}</span>
                  {ps.length > 0 && <b className="rounded-full bg-sky-600 px-1.5 text-[10px] text-white">{ps.length}</b>}
                </span>
                {ps.slice(0, 4).map(p => <span key={p.id} className="truncate text-[11px] text-slate-500">{p.cumpleDia} · {p.nombre.split(" ").slice(0, 2).join(" ")}</span>)}
                {ps.length > 4 && <span className="text-[11px] text-slate-400">+{ps.length - 4} más</span>}
                {!ps.length && <span className="text-[11px] text-slate-300">Sin cumpleaños</span>}
              </button>
            )
          })}
        </div>
      </section>

      {sinFecha.length > 0 && (
        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer">{sinFecha.length} de {datos.tramitadores.length} personas no tienen fecha de cumpleaños (se llena en Catálogos → Tramitadores)</summary>
          <div className="mt-2 flex flex-wrap gap-1">
            {sinFecha.map(p => <button key={p.id} type="button" onClick={() => verFicha(p)} className="rounded-full border border-slate-200 px-2 py-0.5 hover:border-sky-300 hover:text-sky-700">{p.nombre}</button>)}
          </div>
        </details>
      )}
    </div>
  )
}
