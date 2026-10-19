"use client"

import { useState } from "react"
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { Download, ExternalLink, Eye, FileText } from "lucide-react"
import clsx from "clsx"
import type { DocumentoRevision, RevisionPdfPago, SegundoDocumento } from "@/actions/gastos/legalizacion"
import { claseBotonPrimario, claseBotonSecundario } from "../ui/estilos"

const OPCIONES: { valor: SegundoDocumento, texto: string }[] = [
  { valor: "SOPORTE", texto: "Soporte de pago" },
  { valor: "FACTURA", texto: "Factura" },
  { valor: "AMBOS", texto: "Ambos" }
]

// Archivos que lleva cada opción (para ver qué saldrá y no elegir algo que no existe)
const archivosDe = (gasto: RevisionPdfPago, opcion: SegundoDocumento) =>
  opcion === "SOPORTE" ? gasto.soportes : opcion === "FACTURA" ? gasto.facturas : [...gasto.soportes, ...gasto.facturas]

// Botón con el nombre de un documento: lo muestra en la vista previa
function Documento({ documento, etiqueta, activo, onVer }: {
  documento: DocumentoRevision
  etiqueta: string
  activo: boolean
  onVer: (documento: DocumentoRevision) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onVer(documento)}
      className={clsx(
        "flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left transition",
        activo ? "bg-emerald-50 text-emerald-800" : "text-slate-600 hover:bg-slate-50"
      )}
    >
      <Eye size={12} className="shrink-0 text-slate-400" />
      <span className="shrink-0 text-slate-400">{etiqueta}:</span>
      <span className="truncate">{documento.nombre}</span>
    </button>
  )
}

// Antes de descargar: para cada gasto con PDF de pago unificado (ej: 1301) se revisa qué va
// después de la liquidación: el soporte de pago, la factura registrada o ambos. Viene marcado lo
// sugerido (la factura si el gasto la tiene; si no, el soporte). Cada documento se puede ver a la
// derecha antes de decidir.
export default function ModalPdfsDePago({ gastos, onDescargar, onCerrar }: {
  gastos: RevisionPdfPago[]
  onDescargar: (eleccion: Record<number, SegundoDocumento>) => void
  onCerrar: () => void
}) {
  const [eleccion, setEleccion] = useState<Record<number, SegundoDocumento>>(() => Object.fromEntries(gastos.map(g => [g.id, g.sugerido])))
  // Arranca mostrando el primer documento que tenga el primer gasto
  const [viendo, setViendo] = useState<DocumentoRevision | null>(() => {
    const g = gastos[0]
    return g ? (g.liquidaciones[0] ?? g.soportes[0] ?? g.facturas[0] ?? null) : null
  })

  return (
    <Dialog open onClose={onCerrar} className="relative z-50">
      <div className="fixed inset-0 bg-slate-900/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="flex h-[90vh] w-full max-w-6xl flex-col rounded-xl bg-white shadow-xl">
          <div className="border-b border-slate-100 px-6 py-4">
            <DialogTitle className="text-sm font-semibold text-slate-800">Revisar los PDF de pago ({gastos.length})</DialogTitle>
            <p className="mt-0.5 text-xs text-slate-400">Cada uno lleva la liquidación y, después, lo que elija. Toque un documento para verlo.</p>
          </div>

          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            {/* GASTOS Y LO QUE LLEVA CADA PDF */}
            <ul className="min-h-0 shrink-0 divide-y divide-slate-100 overflow-y-auto px-5 lg:w-[26rem] lg:border-r lg:border-slate-100 max-lg:max-h-[40%]">
              {gastos.map(g => {
                const actual = eleccion[g.id]
                return (
                  <li key={g.id} className="space-y-2 py-3 text-xs">
                    <div>
                      <p className="font-semibold text-slate-700">{g.codigo}</p>
                      <p className="flex items-center gap-1 truncate text-[11px] text-slate-400"><FileText size={12} className="shrink-0" /> {g.archivo}</p>
                    </div>

                    <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={`Qué va después de la liquidación en ${g.codigo}`}>
                      {OPCIONES.map(o => {
                        const vacia = archivosDe(g, o.valor).length === 0
                        return (
                          <button
                            key={o.valor}
                            type="button"
                            role="radio"
                            aria-checked={actual === o.valor}
                            disabled={vacia}
                            title={vacia ? "El gasto no tiene este documento" : undefined}
                            onClick={() => setEleccion(e => ({ ...e, [g.id]: o.valor }))}
                            className={clsx(
                              "rounded-full border px-2.5 py-1 font-medium transition disabled:cursor-not-allowed disabled:opacity-35",
                              actual === o.valor ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"
                            )}
                          >
                            {o.texto}
                          </button>
                        )
                      })}
                    </div>

                    {/* Todos los documentos del gasto, para verlos; lo que no entra en el PDF se ve más tenue */}
                    <div className="space-y-0.5">
                      {g.liquidaciones.length === 0 && <p className="px-1.5 text-[11px] text-amber-700">Sin liquidación</p>}
                      {g.liquidaciones.map(d => <Documento key={d.id} documento={d} etiqueta="Liquidación" activo={viendo?.id === d.id} onVer={setViendo} />)}
                      {[...g.soportes.map(d => ({ d, etiqueta: "Soporte", entra: actual !== "FACTURA" })), ...g.facturas.map(d => ({ d, etiqueta: "Factura", entra: actual !== "SOPORTE" }))].map(({ d, etiqueta, entra }) => (
                        <div key={d.id} className={entra ? "" : "opacity-50"} title={entra ? undefined : "No va en el PDF con la opción elegida"}>
                          <Documento documento={d} etiqueta={etiqueta} activo={viendo?.id === d.id} onVer={setViendo} />
                        </div>
                      ))}
                      {archivosDe(g, actual).length === 0 && <p className="px-1.5 text-[11px] text-amber-700">Después de la liquidación: no tiene</p>}
                    </div>
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
