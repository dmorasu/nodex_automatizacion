"use client"

import { useState } from "react"
import Link from "next/link"
import clsx from "clsx"
import { CheckCircle2, ChevronRight } from "lucide-react"
import EstadoTramite from "@/components/solicitudTramites/EstadoTramite"
import { fechaCorta, type ClaveAlerta, type Tablero, type TramiteAlerta } from "@/src/tablero"

type Definicion = {
  clave: ClaveAlerta
  nombre: string
  descripcion: (diasGracia: number) => string
  // Columna de días que se resalta en la lista
  dias?: (t: TramiteAlerta) => string
}

const ALERTAS: Definicion[] = [
  {
    clave: "vencidos",
    nombre: "Vencidos",
    descripcion: d => `Pasaron más de ${d} días desde la fecha de programación y no están finalizados.`,
    dias: t => `${t.diasAtraso} días de atraso`
  },
  {
    clave: "novedadSinMovimiento",
    nombre: "Novedad sin movimiento",
    descripcion: d => `En espera por novedad y más de ${d} días sin trazabilidad ni cambio de estado.`,
    dias: t => `${t.diasSinMovimiento} días sin movimiento`
  },
  {
    clave: "realizadoSinFinalizar",
    nombre: "Realizado sin finalizar",
    descripcion: () => "El tramitador lo reportó como realizado en su app, pero el trámite sigue abierto."
  },
  {
    clave: "sinTramitador",
    nombre: "Sin tramitador",
    descripcion: () => "Trámites abiertos sin tramitador asignado."
  },
  {
    clave: "sinProgramacion",
    nombre: "Sin programación",
    descripcion: () => "Trámites abiertos sin fecha de diligencia."
  },
  {
    clave: "sinMovimiento",
    nombre: "Sin movimiento",
    descripcion: d => `Abiertos (sin contar novedades) con más de ${d} días sin trazabilidad ni cambio de estado.`,
    dias: t => `${t.diasSinMovimiento} días sin movimiento`
  },
  {
    clave: "sinAnalista",
    nombre: "Sin analista",
    descripcion: () => "Trámites abiertos sin analista asignado."
  }
]

// Lo que hay que atender: cada alerta lista sus trámites con enlace al detalle
export default function RequiereAtencion({ tablero, mostrarSinAnalista }: { tablero: Tablero, mostrarSinAnalista: boolean }) {
  const alertas = ALERTAS.filter(a => mostrarSinAnalista || a.clave !== "sinAnalista")
  const [activa, setActiva] = useState<ClaveAlerta>(
    alertas.find(a => tablero.atencion[a.clave].total > 0)?.clave ?? "vencidos"
  )

  const definicion = alertas.find(a => a.clave === activa)!
  const lista = tablero.atencion[activa]

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-700">Requiere atención</h2>
        <p className="mt-0.5 text-xs text-slate-400">Trámites abiertos que necesitan acción. Clic en un trámite para abrirlo.</p>
      </div>

      {/* Una pestaña por alerta, con su cantidad */}
      <div className="flex flex-wrap gap-1.5 border-b border-slate-100 px-5 py-3">
        {alertas.map(a => {
          const total = tablero.atencion[a.clave].total
          return (
            <button
              key={a.clave}
              type="button"
              onClick={() => setActiva(a.clave)}
              aria-pressed={activa === a.clave}
              className={clsx(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition",
                activa === a.clave ? "border-sky-500 bg-sky-50 text-sky-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
              )}
            >
              {a.nombre}
              <span className={clsx(
                "rounded-full px-1.5 text-[10px]",
                total > 0 ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-400"
              )}>
                {total.toLocaleString("es-CO")}
              </span>
            </button>
          )
        })}
      </div>

      <div className="px-5 py-4">
        <p className="mb-3 text-xs text-slate-500">{definicion.descripcion(tablero.diasGracia)}</p>

        {lista.total === 0 ? (
          <p className="flex items-center gap-2 rounded-lg bg-slate-50 px-4 py-6 text-xs text-slate-500">
            <CheckCircle2 size={16} className="text-emerald-600" aria-hidden="true" />
            Nada pendiente en esta alerta.
          </p>
        ) : (
          <>
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
              {lista.items.map(t => (
                <li key={t.id}>
                  <Link
                    href={`/center/solicitudTramites/${t.id}`}
                    className="group flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-xs transition hover:bg-sky-50/50"
                  >
                    <span className="w-16 shrink-0 font-semibold text-slate-700">#{t.id}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-slate-700">{t.tipo ?? "Sin tipo"} · {t.cliente ?? "Sin cliente"}</span>
                      <span className="block truncate text-[11px] text-slate-400">
                        {t.placa ?? "—"} · Analista: {t.analista ?? "—"} · Tramitador: {t.tramitador ?? "—"}
                        {t.fechaProgramada && ` · Programado ${fechaCorta(t.fechaProgramada)}`}
                      </span>
                    </span>
                    <EstadoTramite nombre={t.estado} />
                    {definicion.dias && (
                      <span className="w-36 shrink-0 text-right font-semibold text-slate-700">{definicion.dias(t)}</span>
                    )}
                    <ChevronRight size={15} className="shrink-0 text-slate-300 group-hover:text-sky-500" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
            {lista.total > lista.items.length && (
              <p className="mt-2 text-[11px] text-slate-400">
                Se muestran los {lista.items.length} primeros de {lista.total.toLocaleString("es-CO")}. Use los filtros para acotar.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  )
}
