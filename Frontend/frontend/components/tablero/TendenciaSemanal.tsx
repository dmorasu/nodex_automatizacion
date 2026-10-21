"use client"

import { useState } from "react"
import { fechaCorta, type Tablero } from "@/src/tablero"

// Paleta validada (validate_palette.js, modo claro): contraste ≥ 3:1 y separación para daltonismo.
// "Fuera de plazo" es parte de los finalizados (va apilada encima de su barra), no una serie aparte
const COLOR_CREADOS = "#0284c7"
const COLOR_FINALIZADOS = "#7c3aed"
const COLOR_FUERA_DE_PLAZO = "#d9682f"
const LEYENDA = [
  { nombre: "Creados", color: COLOR_CREADOS },
  { nombre: "Finalizados", color: COLOR_FINALIZADOS },
  { nombre: "Finalizados fuera de plazo", color: COLOR_FUERA_DE_PLAZO, ayuda: "El analista lo marcó Finalizado después del día hábil siguiente al reporte \"realizado\" del tramitador" }
]

const ALTO = 160

// Escala "redonda" para las líneas de guía (ej: máximo 237 → 250)
const techo = (valor: number) => {
  if (valor <= 5) return 5
  const potencia = 10 ** Math.floor(Math.log10(valor))
  const paso = [1, 2, 2.5, 5, 10].map(m => m * potencia).find(p => p * 4 >= valor) ?? potencia * 10
  return paso * 4
}

// Creados vs finalizados por semana: si se crean más de los que se cierran, el atraso crece
export default function TendenciaSemanal({ tendencia }: { tendencia: Tablero["tendencia"] }) {
  const [activa, setActiva] = useState<number | null>(null)
  const [verTabla, setVerTabla] = useState(false)

  const maximo = techo(Math.max(1, ...tendencia.flatMap(s => [s.creados, s.finalizados])))
  const guias = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(maximo * f))
  const totalCreados = tendencia.reduce((s, x) => s + x.creados, 0)
  const totalFinalizados = tendencia.reduce((s, x) => s + x.finalizados, 0)
  const balance = totalCreados - totalFinalizados

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Creados vs. finalizados por semana</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Últimas {tendencia.length} semanas · {balance > 0
              ? `el atraso creció en ${balance.toLocaleString("es-CO")}`
              : balance < 0 ? `el atraso bajó en ${(-balance).toLocaleString("es-CO")}` : "sin cambio en el atraso"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {/* Leyenda: rectángulo, como las barras */}
          {LEYENDA.map(s => (
            <span key={s.nombre} title={s.ayuda} className="inline-flex items-center gap-1.5 text-[11px] text-slate-600">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} aria-hidden="true" />
              {s.nombre}
            </span>
          ))}
          <button type="button" onClick={() => setVerTabla(v => !v)} className="text-[11px] font-medium text-sky-600 hover:underline">
            {verTabla ? "Ver gráfica" : "Ver tabla"}
          </button>
        </div>
      </div>

      <div className="px-5 py-4">
        {verTabla ? (
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] uppercase tracking-wide text-slate-500">
              <tr><th className="py-1.5 font-semibold">Semana del</th><th className="py-1.5 text-right font-semibold">Creados</th><th className="py-1.5 text-right font-semibold">Finalizados</th><th className="py-1.5 text-right font-semibold">Fuera de plazo</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tendencia.map(s => (
                <tr key={s.semana}><td className="py-1.5 text-slate-600">{fechaCorta(s.semana)}</td><td className="py-1.5 text-right text-slate-700">{s.creados}</td><td className="py-1.5 text-right text-slate-700">{s.finalizados}</td><td className="py-1.5 text-right text-slate-700">{s.finalizadosFueraDePlazo}</td></tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="flex gap-2">
            {/* Eje Y */}
            <div className="relative w-8 shrink-0 text-right text-[10px] text-slate-400" style={{ height: ALTO }}>
              {guias.map(g => (
                // Anclada por abajo: se baja media altura para quedar centrada en su línea
                <span key={g} className="absolute right-0 translate-y-1/2 leading-none" style={{ bottom: `${(g / maximo) * 100}%` }}>{g}</span>
              ))}
            </div>

            <div className="min-w-0 flex-1">
              <div className="relative" style={{ height: ALTO }}>
                {/* Guías recesivas */}
                {guias.map(g => (
                  <span key={g} className="absolute inset-x-0 border-t border-slate-100" style={{ bottom: `${(g / maximo) * 100}%` }} aria-hidden="true" />
                ))}

                <div className="absolute inset-0 flex">
                  {tendencia.map((s, i) => (
                    // Toda la columna de la semana es el área de hover (más grande que las barras)
                    <button
                      key={s.semana}
                      type="button"
                      onMouseEnter={() => setActiva(i)}
                      onMouseLeave={() => setActiva(null)}
                      onFocus={() => setActiva(i)}
                      onBlur={() => setActiva(null)}
                      aria-label={`Semana del ${fechaCorta(s.semana)}: ${s.creados} creados, ${s.finalizados} finalizados, ${s.finalizadosFueraDePlazo} fuera de plazo`}
                      className={`relative flex flex-1 items-end justify-center gap-0.5 outline-none ${activa === i ? "bg-slate-50" : ""}`}
                    >
                      {/* Creados */}
                      <span
                        className="w-2.5 rounded-t sm:w-3"
                        style={{
                          height: `${(s.creados / maximo) * 100}%`,
                          minHeight: s.creados > 0 ? 2 : 0,
                          backgroundColor: COLOR_CREADOS,
                          opacity: activa === null || activa === i ? 1 : 0.55
                        }}
                      />
                      {/* Finalizados: a tiempo abajo y fuera de plazo encima, separados 2 px; solo el tope va redondeado */}
                      <span
                        className="flex w-2.5 flex-col-reverse gap-[2px] sm:w-3"
                        style={{ height: `${(s.finalizados / maximo) * 100}%`, minHeight: s.finalizados > 0 ? 2 : 0, opacity: activa === null || activa === i ? 1 : 0.55 }}
                      >
                        {s.finalizados - s.finalizadosFueraDePlazo > 0 && (
                          <span
                            className={s.finalizadosFueraDePlazo > 0 ? "" : "rounded-t"}
                            style={{ flexGrow: s.finalizados - s.finalizadosFueraDePlazo, backgroundColor: COLOR_FINALIZADOS }}
                          />
                        )}
                        {s.finalizadosFueraDePlazo > 0 && (
                          <span className="rounded-t" style={{ flexGrow: s.finalizadosFueraDePlazo, minHeight: 2, backgroundColor: COLOR_FUERA_DE_PLAZO }} />
                        )}
                      </span>

                      {/* Tooltip: el valor manda, el nombre de la serie acompaña */}
                      {activa === i && (
                        <span className={`pointer-events-none absolute bottom-full z-10 mb-2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-left shadow-lg ${i > tendencia.length / 2 ? "right-0" : "left-0"}`}>
                          <span className="block text-[11px] text-slate-400">Semana del {fechaCorta(s.semana)}</span>
                          {[
                            { nombre: "Creados", valor: s.creados, color: COLOR_CREADOS },
                            { nombre: "Finalizados", valor: s.finalizados, color: COLOR_FINALIZADOS },
                            { nombre: "de ellos, fuera de plazo", valor: s.finalizadosFueraDePlazo, color: COLOR_FUERA_DE_PLAZO }
                          ].map(fila => (
                            <span key={fila.nombre} className="mt-1 flex items-center gap-2 text-xs">
                              <span className="h-0.5 w-3 rounded" style={{ backgroundColor: fila.color }} aria-hidden="true" />
                              <b className="text-slate-800">{fila.valor}</b>
                              <span className="text-slate-500">{fila.nombre}</span>
                            </span>
                          ))}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Eje X: algunas semanas, para que no se monten las etiquetas */}
              <div className="mt-1.5 flex text-[10px] text-slate-400">
                {tendencia.map((s, i) => (
                  <span key={s.semana} className="flex-1 text-center">{i % 2 === 0 ? fechaCorta(s.semana) : ""}</span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
