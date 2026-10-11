"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "react-toastify"
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { ArrowLeft, Ban, CheckCircle2, FileCheck2, Loader2, Paperclip, Send, Undo2 } from "lucide-react"
import {
  anularReembolso, aprobarReembolso, enviarReembolso, legalizarReembolso, quitarDelReembolso, rechazarReembolso
} from "@/actions/gastos/cajaMenor"
import { formatoFecha, formatoFechaHora, formatoMoneda } from "@/src/lib/formato"
import { ACCIONES_REEMBOLSO, ESTADOS_REEMBOLSO, type ReembolsoDetalle } from "@/src/schemas/gastos"
import BotonConMotivo from "../ui/BotonConMotivo"
import ListaDocumentos from "../gastos/ListaDocumentos"
import EstadoGasto from "../gastos/EstadoGasto"
import Seccion from "../ui/Seccion"
import Dato from "../ui/Dato"
import { claseBotonPrimario, claseBotonSecundario, claseInput, claseLabel } from "../ui/estilos"

const hoyEnBogota = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })

// Detalle del reembolso de caja menor. Las acciones dependen de los permisos que manda el backend:
//  · Tesorería (borrador): quitar gastos, enviar a Dirección o anular;
//  · Dirección de Negocio (por aprobar): aprobar o devolver con motivo;
//  · Tesorería (aprobado): legalizar con la fecha en que llegó el dinero y el soporte.
export default function DetalleReembolso({ reembolso, volver }: { reembolso: ReembolsoDetalle, volver: { href: string, texto: string } }) {
  const router = useRouter()
  const [seleccion, setSeleccion] = useState<number[]>([])
  const [legalizando, setLegalizando] = useState(false)
  const [fecha, setFecha] = useState(hoyEnBogota())
  const [observacion, setObservacion] = useState("")
  const [archivos, setArchivos] = useState<File[]>([])
  const [procesando, startProcesar] = useTransition()
  const { permisos } = reembolso

  const ejecutar = (accion: () => Promise<{ ok: true } | { ok: false, errores: string[] }>, exito: string, despues?: () => void) =>
    startProcesar(async () => {
      const resultado = await accion()
      if (!resultado.ok) return resultado.errores.forEach(e => toast.error(e))
      toast.success(exito)
      despues?.()
      router.refresh()
    })

  const quitar = () => ejecutar(() => quitarDelReembolso(reembolso.id, seleccion), "Gastos quitados del reembolso", () => setSeleccion([]))
  const anular = () => confirm(`¿Anular ${reembolso.codigo}? Sus gastos vuelven a pendientes por reembolso.`) &&
    ejecutar(() => anularReembolso(reembolso.id), "Reembolso anulado")

  const legalizar = () => {
    if (!fecha) return toast.error("Indique la fecha en que se recibió el dinero")
    if (!archivos.length) return toast.error("Adjunte el soporte del reembolso")
    const formData = new FormData()
    formData.append("datos", JSON.stringify({ fechaLegalizacion: fecha, observacion: observacion.trim() || null }))
    archivos.forEach(a => formData.append("archivos", a))
    ejecutar(() => legalizarReembolso(reembolso.id, formData), "Reembolso legalizado: la caja se repuso", () => setLegalizando(false))
  }

  const alternar = (id: number) => setSeleccion(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])

  return (
    <div className="space-y-6">
      <div>
        <Link href={volver.href} className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
          <ArrowLeft size={14} /> {volver.texto}
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-slate-800">{reembolso.codigo}</h2>
              <EstadoGasto codigo={reembolso.estado} nombre={ESTADOS_REEMBOLSO[reembolso.estado] ?? reembolso.estado} />
            </div>
            <p className="mt-1 text-sm text-slate-500">{reembolso.bolsa.nombre} · {reembolso.legalizaciones.length} gasto(s) · <b className="text-slate-800">{formatoMoneda(reembolso.total)}</b></p>
          </div>

          <div className="flex flex-wrap gap-3">
            {permisos.editar && (
              <>
                {seleccion.length > 0 && (
                  <button type="button" onClick={quitar} disabled={procesando} className={claseBotonSecundario}>
                    <Undo2 size={15} /> Quitar {seleccion.length}
                  </button>
                )}
                <button type="button" onClick={anular} disabled={procesando} className={claseBotonSecundario}>
                  <Ban size={15} /> Anular
                </button>
                <button type="button" onClick={() => ejecutar(() => enviarReembolso(reembolso.id), "Enviado a Dirección de Negocio")} disabled={procesando} className={claseBotonPrimario}>
                  {procesando ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Enviar a aprobación
                </button>
              </>
            )}
            {permisos.aprobar && (
              <>
                <BotonConMotivo
                  etiqueta="Devolver"
                  titulo={`Devolver ${reembolso.codigo}`}
                  descripcion="El reembolso vuelve a Tesorería en borrador para que lo corrija. Explique qué debe revisar."
                  mensajeExito="Reembolso devuelto a Tesorería"
                  onConfirmar={motivo => rechazarReembolso(reembolso.id, motivo)}
                />
                <button type="button" onClick={() => ejecutar(() => aprobarReembolso(reembolso.id), "Reembolso aprobado")} disabled={procesando} className={claseBotonPrimario}>
                  {procesando ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Aprobar
                </button>
              </>
            )}
            {permisos.legalizar && (
              <button type="button" onClick={() => setLegalizando(true)} className={claseBotonPrimario}>
                <FileCheck2 size={15} /> Legalizar reembolso
              </button>
            )}
          </div>
        </div>

        {reembolso.estado === "BORRADOR" && reembolso.motivoRechazo && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
            <span className="font-semibold">Devuelto por Dirección de Negocio:</span> {reembolso.motivoRechazo}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        <div className="lg:col-span-3">
          <Seccion titulo="Gastos del reembolso">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    {permisos.editar && <th className="w-8 py-2 pr-2" />}
                    <th className="py-2 pr-3 font-semibold">Gasto</th>
                    <th className="py-2 pr-3 font-semibold">Factura</th>
                    <th className="py-2 pr-3 font-semibold">Legalizó</th>
                    <th className="py-2 pr-3 text-right font-semibold">Entregado</th>
                    <th className="py-2 pr-3 text-right font-semibold">Soporte</th>
                    <th className="py-2 font-semibold">Soportes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 align-top">
                  {reembolso.legalizaciones.map(l => (
                    <tr key={l.id}>
                      {permisos.editar && (
                        <td className="py-3 pr-2">
                          <input type="checkbox" checked={seleccion.includes(l.solicitudGastoId)} onChange={() => alternar(l.solicitudGastoId)} className="h-4 w-4 accent-emerald-600" aria-label={`Seleccionar ${l.solicitudGasto.codigo}`} />
                        </td>
                      )}
                      <td className="py-3 pr-3">
                        <Link href={`/solicitudes/${l.solicitudGasto.id}`} className="font-semibold text-emerald-700 hover:underline">{l.solicitudGasto.codigo}</Link>
                        <p className="text-[11px] text-slate-400">{l.solicitudGasto.conceptoPago}</p>
                        <p className="text-[11px] text-slate-400">{l.solicitudGasto.creador?.nombreUsuario}</p>
                      </td>
                      <td className="py-3 pr-3 text-slate-600">
                        <p className="font-medium">{l.numeroFactura} · {formatoFecha(l.fechaFactura)}</p>
                        <p className="text-[11px] text-slate-400">{l.beneficiario} · {l.tipoIdentificacion} {l.identificacion}</p>
                        {(l.placa || l.matriculaInmobiliaria) && <p className="text-[11px] text-slate-400">{l.placa ?? l.matriculaInmobiliaria}</p>}
                      </td>
                      <td className="py-3 pr-3 text-slate-600">{l.quienLegaliza}</td>
                      <td className="py-3 pr-3 text-right text-slate-600 whitespace-nowrap">{formatoMoneda(l.solicitudGasto.valorRealmentePagado)}</td>
                      <td className="py-3 pr-3 text-right font-semibold text-slate-800 whitespace-nowrap">{formatoMoneda(l.valorSoporte)}</td>
                      <td className="py-3 min-w-[200px]"><ListaDocumentos documentos={l.documentos} vacio="Sin soportes." /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {reembolso.legalizaciones.length === 0 && <p className="py-8 text-center text-xs text-slate-400">El reembolso no tiene gastos.</p>}
            </div>
          </Seccion>
        </div>

        <div className="space-y-6">
          <Seccion titulo="Seguimiento">
            <dl className="space-y-4">
              <Dato etiqueta="Creado por" valor={`${reembolso.creador?.nombreUsuario ?? ""} · ${formatoFechaHora(reembolso.createdAt)}`} />
              {reembolso.fechaEnvio && <Dato etiqueta="Enviado a Dirección" valor={formatoFechaHora(reembolso.fechaEnvio)} />}
              {reembolso.fechaAprobacion && <Dato etiqueta="Aprobado por" valor={`${reembolso.aprobador?.nombreUsuario ?? ""} · ${formatoFechaHora(reembolso.fechaAprobacion)}`} />}
              {reembolso.fechaLegalizacion && <Dato etiqueta="Legalizado" valor={`${formatoFecha(reembolso.fechaLegalizacion)} · ${reembolso.legalizador?.nombreUsuario ?? ""}`} />}
              {reembolso.observacion && <Dato etiqueta="Observación" valor={reembolso.observacion} />}
            </dl>
          </Seccion>
          {reembolso.historial.length > 0 && (
            <Seccion titulo="Historial">
              <ol className="relative ml-2 border-l border-slate-200">
                {reembolso.historial.map(h => {
                  const accion = ACCIONES_REEMBOLSO[h.accion] ?? { nombre: h.accion, color: "bg-slate-400" }
                  return (
                    <li key={h.id} className="mb-5 ml-5 last:mb-0">
                      <span className={`absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full border-2 border-white ${accion.color}`} />
                      <p className="text-xs font-semibold text-slate-700">{accion.nombre}</p>
                      <p className="text-[11px] text-slate-400">{formatoFechaHora(h.createdAt)} · {h.usuario?.nombreUsuario}</p>
                      {h.detalle && <p className="mt-1 text-xs text-slate-600">{h.detalle}</p>}
                    </li>
                  )
                })}
              </ol>
            </Seccion>
          )}
          {reembolso.documentos.length > 0 && (
            <Seccion titulo="Soporte del reembolso">
              <ListaDocumentos documentos={reembolso.documentos} />
            </Seccion>
          )}
        </div>
      </div>

      {legalizando && (
        <Dialog open onClose={() => !procesando && setLegalizando(false)} className="relative z-50">
          <div className="fixed inset-0 bg-slate-900/30" aria-hidden="true" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <DialogPanel className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
              <DialogTitle className="text-sm font-semibold text-slate-800">Legalizar {reembolso.codigo}</DialogTitle>
              <p className="mt-1 text-xs text-slate-500">
                La caja {reembolso.bolsa.nombre} se repone por {formatoMoneda(reembolso.total)} y sus gastos quedan legalizados.
              </p>
              <div className="mt-4 space-y-4">
                <label className="block">
                  <span className={claseLabel}>Fecha en que se recibió el dinero <span className="text-red-400">*</span></span>
                  <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={claseInput} />
                </label>
                <label className="block">
                  <span className={claseLabel}>Observación</span>
                  <input value={observacion} onChange={e => setObservacion(e.target.value)} maxLength={1000} placeholder="Opcional" className={claseInput} />
                </label>
                <div>
                  <span className={claseLabel}>Soporte <span className="text-red-400">*</span></span>
                  <label className={`${claseBotonSecundario} cursor-pointer`}>
                    <Paperclip size={15} /> Seleccionar archivos
                    <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" className="sr-only" onChange={e => setArchivos(Array.from(e.target.files ?? []))} />
                  </label>
                  {archivos.length > 0 && <ul className="mt-2 space-y-1 text-xs text-slate-600">{archivos.map(a => <li key={a.name}>· {a.name}</li>)}</ul>}
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setLegalizando(false)} disabled={procesando} className={claseBotonSecundario}>Cancelar</button>
                <button type="button" onClick={legalizar} disabled={procesando} className={claseBotonPrimario}>
                  {procesando ? <Loader2 size={15} className="animate-spin" /> : <FileCheck2 size={15} />} Legalizar
                </button>
              </div>
            </DialogPanel>
          </div>
        </Dialog>
      )}
    </div>
  )
}
