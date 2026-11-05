"use client"

import { useMemo, useState } from "react"
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { Check, Download, ExternalLink, Eye, FileText, Files, Minus } from "lucide-react"
import clsx from "clsx"
import type { DocumentoRevision, EleccionPdf, RevisionPdfPago } from "@/actions/gastos/legalizacion"
import { claseBotonPrimario, claseBotonSecundario } from "../ui/estilos"

type Tipo = { codigo: string, nombre: string }

// Tipos de documento que tienen los documentos, sin repetir, en el orden en que vienen (el del PDF)
const tiposDe = (documentos: DocumentoRevision[]): Tipo[] => {
  const vistos = new Map<string, string>()
  documentos.forEach(d => { if (!vistos.has(d.codigoTipo)) vistos.set(d.codigoTipo, d.nombreTipo) })
  return [...vistos].map(([codigo, nombre]) => ({ codigo, nombre }))
}

// Casilla de un tipo: marca o desmarca todos sus documentos (parcial si solo algunos)
function CasillaTipo({ tipo, marcados, total, onCambiar }: { tipo: Tipo, marcados: number, total: number, onCambiar: () => void }) {
  const todos = total > 0 && marcados === total
  const parcial = marcados > 0 && marcados < total
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={parcial ? "mixed" : todos}
      onClick={onCambiar}
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-medium transition",
        todos ? "border-emerald-300 bg-emerald-50 text-emerald-700"
          : parcial ? "border-emerald-200 bg-white text-emerald-700"
            : "border-slate-200 text-slate-500 hover:bg-slate-50"
      )}
    >
      {todos && <Check size={12} />}
      {parcial && <Minus size={12} />}
      {tipo.nombre}
    </button>
  )
}

// Antes de descargar: por cada gasto se marcan los documentos que se unen en un solo PDF (cada uno
// con su casilla; las de tipo marcan todos los de ese tipo). Van en el orden liquidación → soporte
// de pago → factura → los demás. Sin ninguno marcado, los documentos del gasto bajan sueltos. En las
// operaciones con PDF de pago (ej. 1301) viene marcada la liquidación y la factura si la tiene, o si
// no el soporte de pago. "Todos los gastos" marca o desmarca un tipo en cada gasto. Cada documento se
// puede ver a la derecha.
export default function ModalPdfsDePago({ gastos, onDescargar, onCerrar }: {
  gastos: RevisionPdfPago[]
  onDescargar: (eleccion: EleccionPdf) => void
  onCerrar: () => void
}) {
  // Por gasto, los ids de los documentos marcados (arranca con los de los tipos sugeridos)
  const [eleccion, setEleccion] = useState<EleccionPdf>(() => Object.fromEntries(
    gastos.map(g => [g.id, g.documentos.filter(d => g.sugerido.includes(d.codigoTipo)).map(d => d.id)])
  ))
  // Arranca mostrando el primer documento del primer gasto que tenga alguno
  const [viendo, setViendo] = useState<DocumentoRevision | null>(() => gastos.find(g => g.documentos.length)?.documentos[0] ?? null)

  const tipos = useMemo(() => tiposDe(gastos.flatMap(g => g.documentos)), [gastos])
  const marcado = (gastoId: number, documentoId: number) => (eleccion[gastoId] ?? []).includes(documentoId)

  const alternarDocumento = (gastoId: number, documentoId: number) =>
    setEleccion(e => {
      const actual = e[gastoId] ?? []
      return { ...e, [gastoId]: actual.includes(documentoId) ? actual.filter(id => id !== documentoId) : [...actual, documentoId] }
    })

  // Marca todos los documentos del tipo en los gastos indicados o, si ya estaban todos, los quita
  const alternarTipo = (codigo: string, enGastos: RevisionPdfPago[]) => {
    const delTipo = enGastos.flatMap(g => g.documentos.filter(d => d.codigoTipo === codigo).map(d => ({ gastoId: g.id, id: d.id })))
    const todos = delTipo.every(d => marcado(d.gastoId, d.id))
    setEleccion(e => {
      const nueva = { ...e }
      for (const g of enGastos) {
        const ids = g.documentos.filter(d => d.codigoTipo === codigo).map(d => d.id)
        if (!ids.length) continue
        const actual = nueva[g.id] ?? []
        nueva[g.id] = todos ? actual.filter(id => !ids.includes(id)) : [...new Set([...actual, ...ids])]
      }
      return nueva
    })
  }

  const contar = (codigo: string, enGastos: RevisionPdfPago[]) => {
    const delTipo = enGastos.flatMap(g => g.documentos.filter(d => d.codigoTipo === codigo).map(d => ({ gastoId: g.id, id: d.id })))
    return { total: delTipo.length, marcados: delTipo.filter(d => marcado(d.gastoId, d.id)).length }
  }

  const unificados = gastos.filter(g => (eleccion[g.id] ?? []).length > 0).length

  return (
    <Dialog open onClose={onCerrar} className="relative z-50">
      <div className="fixed inset-0 bg-slate-900/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="flex h-[90vh] w-full max-w-6xl flex-col rounded-xl bg-white shadow-xl">
          <div className="space-y-3 border-b border-slate-100 px-6 py-4">
            <div>
              <DialogTitle className="text-sm font-semibold text-slate-800">Documentos a unificar por gasto ({gastos.length})</DialogTitle>
              <p className="mt-0.5 text-xs text-slate-400">
                {unificados} con PDF unificado · {gastos.length - unificados} con los documentos sueltos
              </p>
            </div>
            {tipos.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="mr-1 font-medium text-slate-500">Todos los gastos:</span>
                {tipos.map(t => (
                  <CasillaTipo key={t.codigo} tipo={t} {...contar(t.codigo, gastos)} onCambiar={() => alternarTipo(t.codigo, gastos)} />
                ))}
              </div>
            )}
          </div>

          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            {/* GASTOS Y LO QUE LLEVA CADA PDF */}
            <ul className="min-h-0 shrink-0 divide-y divide-slate-100 overflow-y-auto px-5 lg:w-[30rem] lg:border-r lg:border-slate-100 max-lg:max-h-[40%]">
              {gastos.map(g => {
                const elegidos = eleccion[g.id] ?? []
                const unificado = elegidos.length > 0
                return (
                  <li key={g.id} className="space-y-2 py-3 text-xs">
                    <div>
                      <p className="font-semibold text-slate-700">{g.codigo}</p>
                      {(g.operacion || g.centroDeCostos) && (
                        <p className="text-[11px] text-slate-500">
                          {g.operacion}{g.centroDeCostos && <span className="text-slate-400"> · CC {g.centroDeCostos}</span>}
                        </p>
                      )}
                      <p className="flex items-center gap-1 truncate text-[11px] text-slate-400">
                        {unificado
                          ? <><FileText size={12} className="shrink-0" /> {g.archivo} · {elegidos.length} documento(s)</>
                          : <><Files size={12} className="shrink-0" /> Documentos sueltos</>}
                      </p>
                    </div>

                    {g.documentos.length === 0 ? (
                      <p className="text-[11px] text-amber-700">Sin documentos</p>
                    ) : (
                      <>
                        <div className="flex flex-wrap gap-1" aria-label={`Tipos de ${g.codigo}`}>
                          {tiposDe(g.documentos).map(t => (
                            <CasillaTipo key={t.codigo} tipo={t} {...contar(t.codigo, [g])} onCambiar={() => alternarTipo(t.codigo, [g])} />
                          ))}
                        </div>
                        {/* Cada documento: la casilla lo pone o lo quita del PDF; el nombre lo muestra a la derecha */}
                        <div className="space-y-0.5">
                          {g.documentos.map(d => {
                            const entra = marcado(g.id, d.id)
                            return (
                              <div
                                key={d.id}
                                className={clsx("flex items-center gap-1 rounded pl-1 transition", viendo?.id === d.id ? "bg-emerald-50" : "hover:bg-slate-50")}
                              >
                                <input
                                  type="checkbox"
                                  checked={entra}
                                  onChange={() => alternarDocumento(g.id, d.id)}
                                  className="h-3.5 w-3.5 shrink-0 accent-emerald-600"
                                  aria-label={`Unir ${d.nombre} en el PDF de ${g.codigo}`}
                                />
                                <button
                                  type="button"
                                  onClick={() => setViendo(d)}
                                  className={clsx(
                                    "flex min-w-0 flex-1 items-center gap-1.5 px-1 py-1 text-left",
                                    viendo?.id === d.id ? "text-emerald-800" : "text-slate-600",
                                    unificado && !entra && "opacity-50"
                                  )}
                                >
                                  <Eye size={12} className="shrink-0 text-slate-400" />
                                  <span className="shrink-0 text-slate-400">{d.nombreTipo}:</span>
                                  <span className="truncate">{d.nombre}</span>
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      </>
                    )}
                  </li>
                )
              })}
            </ul>

            {/* VISTA PREVIA */}
            <div className="flex min-h-0 flex-1 flex-col bg-slate-50">
              {viendo ? (
                <>
                  <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2 text-xs">
                    <span className="truncate font-medium text-slate-700">{viendo.nombre}</span>
                    <a href={`/documentos/${viendo.id}`} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 font-medium text-emerald-700 hover:underline">
                      <ExternalLink size={13} /> Abrir en otra pestaña
                    </a>
                  </div>
                  {viendo.tipo.startsWith("image/") ? (
                    <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
                      <img src={`/documentos/${viendo.id}`} alt={viendo.nombre} className="max-h-full max-w-full rounded shadow" />
                    </div>
                  ) : (
                    <iframe key={viendo.id} src={`/documentos/${viendo.id}`} title={viendo.nombre} className="min-h-0 w-full flex-1 border-0" />
                  )}
                </>
              ) : (
                <p className="m-auto text-xs text-slate-400">Toque un documento para verlo aquí.</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
            <button type="button" onClick={onCerrar} className={claseBotonSecundario}>Cancelar</button>
            <button type="button" onClick={() => onDescargar(eleccion)} className={claseBotonPrimario}>
              <Download size={15} /> Descargar
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
