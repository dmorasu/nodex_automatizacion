"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { toast } from "react-toastify"
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { CheckCheck, Loader2, Undo2, XCircle } from "lucide-react"
import { aprobarGastosLote, rechazarGastosLote } from "@/actions/gastos/direccion"
import { quitarDelLote } from "@/actions/gastos/tesoreria"
import { formatoMoneda } from "@/src/lib/formato"
import type { LoteDetalle } from "@/src/schemas/gastos"
import EstadoGasto from "../gastos/EstadoGasto"
import AvisoSaldoAnticipo from "../anticipos/AvisoSaldoAnticipo"
import { claseBotonPeligro, claseBotonPrimario, claseBotonSecundario, claseLabel, claseTextarea } from "../ui/estilos"

type Gasto = LoteDetalle["gastos"][number]
type Resultado = { ok: true } | { ok: false, errores: string[] }

// Ventana para escribir el motivo al rechazar o quitar gastos del lote
function ModalMotivo({ titulo, descripcion, boton, onCerrar, onConfirmar }: {
  titulo: string
  descripcion: string
  boton: string
  onCerrar: () => void
  onConfirmar: (motivo: string) => Promise<boolean>
}) {
  const [motivo, setMotivo] = useState("")
  const [enviando, start] = useTransition()

  const confirmar = () => {
    if (motivo.trim().length < 3) return toast.error("Indique el motivo")
    start(async () => { if (await onConfirmar(motivo.trim())) onCerrar() })
  }

  return (
    <Dialog open onClose={() => !enviando && onCerrar()} className="relative z-50">
      <div className="fixed inset-0 bg-slate-900/30" aria-hidden="true" />
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <DialogPanel className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="px-6 py-4 border-b border-slate-100">
              <DialogTitle className="text-sm font-semibold text-slate-800">{titulo}</DialogTitle>
              <p className="mt-0.5 text-xs text-slate-400">{descripcion}</p>
            </div>
            <div className="px-6 py-5">
              <label className="block">
                <span className={claseLabel}>Motivo <span className="text-red-400">*</span></span>
                <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={3} maxLength={500} className={claseTextarea} autoFocus />
              </label>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button type="button" onClick={onCerrar} disabled={enviando} className={claseBotonSecundario}>Cancelar</button>
              <button type="button" onClick={confirmar} disabled={enviando} className={claseBotonPeligro}>
                {enviando && <Loader2 size={15} className="animate-spin" />}
                {boton}
              </button>
            </div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  )
}

// Gastos del lote. Según quién mira y el estado del lote:
//  - Dirección (lote por aprobar): aprueba o rechaza los gastos pendientes
//  - Tesorería (lote programado o aprobado): quita gastos del pago
//  - Resto: solo lectura
export default function GastosLote({ loteId, gastos, accion }: {
  loteId: number
  gastos: Gasto[]
  accion: "aprobar" | "quitar" | null
}) {
  // Dirección solo decide sobre lo que aún está programado
  const seleccionables = useMemo(
    () => accion === "aprobar" ? gastos.filter(g => g.estado.codigo === "PROGRAMADO") : accion === "quitar" ? gastos : [],
    [accion, gastos]
  )
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set())
  const [motivo, setMotivo] = useState(false)
  const [procesando, start] = useTransition()

  const seleccionados = seleccionables.filter(g => seleccion.has(g.id))
  const todosMarcados = seleccionables.length > 0 && seleccionados.length === seleccionables.length
  const valor = (g: Gasto) => g.valorRealmentePagado ?? g.valorProgramado

  const alternar = (id: number) => setSeleccion(actual => {
    const nueva = new Set(actual)
    if (nueva.has(id)) nueva.delete(id)
    else nueva.add(id)
    return nueva
  })

  const mostrar = (resultado: Resultado, exito: string) => {
    if (!resultado.ok) {
      resultado.errores.forEach(error => toast.error(error))
      return false
    }
    toast.success(exito)
    setSeleccion(new Set())
    return true
  }

  const aprobar = (ids: number[] | null) => start(async () => {
    const resultado = await aprobarGastosLote(loteId, ids)
    mostrar(resultado, resultado.ok && resultado.datos.estado === "APROBADO"
      ? "Lote aprobado. Tesorería ya puede confirmar el pago con el soporte del banco."
      : "Gastos aprobados")
  })

  return (
    <div className="space-y-3">
      {accion && seleccionables.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs text-slate-600">
            {seleccionados.length === 0
              ? (accion === "aprobar" ? "Seleccione los gastos o apruebe todos" : "Seleccione los gastos que no se van a pagar")
              : <><b>{seleccionados.length}</b> seleccionado(s) · {formatoMoneda(seleccionados.reduce((s, g) => s + Number(valor(g) ?? 0), 0))}</>}
          </p>
          <div className="flex flex-wrap gap-2">
            {accion === "aprobar" ? (
              <>
                <button type="button" onClick={() => setMotivo(true)} disabled={procesando || seleccionados.length === 0} className={claseBotonSecundario}>
                  <XCircle size={15} />
                  Rechazar
                </button>
                <button type="button" onClick={() => aprobar(seleccionados.map(g => g.id))} disabled={procesando || seleccionados.length === 0} className={claseBotonSecundario}>
                  Aprobar seleccionados
                </button>
                <button type="button" onClick={() => aprobar(null)} disabled={procesando} className={claseBotonPrimario}>
                  {procesando ? <Loader2 size={15} className="animate-spin" /> : <CheckCheck size={15} />}
                  Aprobar todos ({seleccionables.length})
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setMotivo(true)} disabled={procesando || seleccionados.length === 0} className={claseBotonSecundario}>
                <Undo2 size={15} />
                Quitar del pago
              </button>
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-md border border-slate-200">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              {accion && seleccionables.length > 0 && (
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={todosMarcados}
                    onChange={() => setSeleccion(todosMarcados ? new Set() : new Set(seleccionables.map(g => g.id)))}
                    className="h-4 w-4 accent-emerald-600"
                    aria-label="Seleccionar todos"
                  />
                </th>
              )}
              <th className="px-4 py-3 font-semibold">Gasto</th>
              <th className="px-4 py-3 font-semibold">Beneficiario</th>
              <th className="px-4 py-3 font-semibold">Solicitante</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 font-semibold text-right">Valor solicitado</th>
              <th className="px-4 py-3 font-semibold text-right">{gastos.some(g => g.valorRealmentePagado) ? "Valor pagado" : "Valor a pagar"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {gastos.map(gasto => {
              const puedeMarcar = seleccionables.some(g => g.id === gasto.id)
              return (
                <tr key={gasto.id} className={seleccion.has(gasto.id) ? "bg-emerald-50/50" : undefined}>
                  {accion && seleccionables.length > 0 && (
                    <td className="px-4 py-3">
                      {puedeMarcar && (
                        <input
                          type="checkbox"
                          checked={seleccion.has(gasto.id)}
                          onChange={() => alternar(gasto.id)}
                          className="h-4 w-4 accent-emerald-600"
                          aria-label={`Seleccionar ${gasto.codigo}`}
                        />
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <Link href={`/solicitudes/${gasto.id}`} className="font-semibold text-emerald-700 hover:underline">{gasto.codigo}</Link>
                    <p className="text-[11px] text-slate-400">{gasto.conceptoPago}</p>
                    <AvisoSaldoAnticipo gasto={gasto} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">{gasto.beneficiario.nombre}</td>
                  <td className="px-4 py-3 text-slate-600">{gasto.creador?.nombreUsuario}</td>
                  <td className="px-4 py-3"><EstadoGasto codigo={gasto.estado.codigo} nombre={gasto.estado.nombre} /></td>
                  <td className="px-4 py-3 text-right text-slate-600">{formatoMoneda(gasto.valorSolicitadoPago)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatoMoneda(valor(gasto))}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {gastos.length === 0 && <p className="py-10 text-center text-sm text-slate-400">Este lote ya no tiene gastos: volvieron a Por pagar.</p>}
      </div>

      {motivo && (
        <ModalMotivo
          titulo={accion === "aprobar" ? `Rechazar ${seleccionados.length} gasto(s)` : `Quitar ${seleccionados.length} gasto(s) del pago`}
          descripcion="Los gastos vuelven a Por pagar en Tesorería y el motivo queda en su historial."
          boton={accion === "aprobar" ? "Rechazar" : "Quitar del pago"}
          onCerrar={() => setMotivo(false)}
          onConfirmar={async texto => {
            const ids = seleccionados.map(g => g.id)
            const resultado = accion === "aprobar"
              ? await rechazarGastosLote(loteId, ids, texto)
              : await quitarDelLote(loteId, ids, texto)
            return mostrar(resultado, accion === "aprobar" ? "Gastos rechazados" : "Gastos quitados del pago")
          }}
        />
      )}
    </div>
  )
}
