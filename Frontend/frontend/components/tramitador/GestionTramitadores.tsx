"use client"

import { useMemo, useState, useTransition } from "react"
import { toast } from "react-toastify"
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { KeyRound, Loader2, Pencil, Plus, Search, X } from "lucide-react"
import { guardarTramitador, type DatosTramitador } from "@/actions/tramitadores-action"
import ModalAccesoApp, { EtiquetaAccesoApp, type EstadoAccesoApp } from "./ModalAccesoApp"

export type Tramitador = DatosTramitador & { id: number, acceso?: EstadoAccesoApp }
export type SedeOpcion = { id: number, nombre: string }

const claseInput = `
  w-full h-10 px-3 rounded-md border border-slate-200 bg-white
  text-xs text-slate-700 placeholder:text-slate-300 outline-none transition
  focus:border-sky-400 focus:ring-2 focus:ring-sky-100
`
const claseLabel = "block mb-1.5 text-xs font-medium text-slate-600"

const VACIO: DatosTramitador = {
  nombreTramitador: "",
  identificacion: "",
  correoTramitador: "",
  numeroTramitador: "",
  region: "",
  activo: true,
  esMensajero: false,
  sedeId: null
}

// Ventana para crear o editar un tramitador
function ModalTramitador({ tramitador, sedes, onCerrar }: { tramitador: Tramitador | null, sedes: SedeOpcion[], onCerrar: () => void }) {
  const [datos, setDatos] = useState<DatosTramitador>(tramitador ?? VACIO)
  const [guardando, startGuardar] = useTransition()

  const cambiar = <K extends keyof DatosTramitador>(campo: K, valor: DatosTramitador[K]) =>
    setDatos(actuales => ({ ...actuales, [campo]: valor }))

  const guardar = () => {
    if (datos.esMensajero && !datos.sedeId) return toast.error("Elija la sede de la que sale el mensajero")
    startGuardar(async () => {
      const resultado = await guardarTramitador(datos, tramitador?.id)

      if (!resultado.ok) {
        resultado.errores.forEach(error => toast.error(error))
        return
      }

      toast.success(tramitador ? "Tramitador actualizado" : `Tramitador ${datos.nombreTramitador} creado`)
      onCerrar()
    })
  }

  return (
    <Dialog open onClose={() => !guardando && onCerrar()} className="relative z-50">
      <div className="fixed inset-0 bg-slate-900/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-lg rounded-xl bg-white shadow-xl">
          <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100">
            <DialogTitle className="text-sm font-semibold text-slate-800">
              {tramitador ? `Editar ${tramitador.nombreTramitador}` : "Nuevo tramitador"}
            </DialogTitle>
            <button type="button" onClick={onCerrar} className="text-slate-400 hover:text-slate-600" aria-label="Cerrar"><X size={18} /></button>
          </div>

          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className={claseLabel}>Nombre <span className="text-red-400">*</span></span>
              <input value={datos.nombreTramitador} onChange={e => cambiar("nombreTramitador", e.target.value)} maxLength={200} className={claseInput} autoFocus />
            </label>
            <label className="block">
              <span className={claseLabel}>Identificación <span className="text-red-400">*</span></span>
              <input value={datos.identificacion} onChange={e => cambiar("identificacion", e.target.value)} maxLength={50} className={claseInput} />
            </label>
            <label className="block">
              <span className={claseLabel}>Región <span className="text-red-400">*</span></span>
              <input value={datos.region ?? ""} onChange={e => cambiar("region", e.target.value)} maxLength={100} className={claseInput} />
            </label>
            <label className="block">
              <span className={claseLabel}>Correo <span className="text-red-400">*</span></span>
              <input type="email" value={datos.correoTramitador} onChange={e => cambiar("correoTramitador", e.target.value)} maxLength={150} className={claseInput} />
            </label>
            <label className="block">
              <span className={claseLabel}>WhatsApp <span className="text-red-400">*</span></span>
              <input
                value={datos.numeroTramitador ?? ""}
                onChange={e => cambiar("numeroTramitador", e.target.value)}
                maxLength={20}
                placeholder="573001234567"
                className={claseInput}
              />
              <span className="mt-1 block text-[11px] text-slate-400">Con indicativo del país, solo números. Se usa para las notificaciones.</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-600 sm:col-span-2">
              <input type="checkbox" checked={datos.activo} onChange={e => cambiar("activo", e.target.checked)} className="h-4 w-4 accent-sky-500" />
              Activo (puede asignarse a trámites)
            </label>

            {/* Mensajería: ruta diaria con mapa y "Mi ruta" en la app */}
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 sm:col-span-2">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={Boolean(datos.esMensajero)}
                  onChange={e => setDatos(a => ({ ...a, esMensajero: e.target.checked, sedeId: e.target.checked ? a.sedeId : null }))}
                  className="h-4 w-4 accent-sky-500"
                />
                Es mensajero (tiene ruta diaria de visitas)
              </label>
              {datos.esMensajero && (
                <label className="mt-3 block">
                  <span className={claseLabel}>Sede de salida <span className="text-red-400">*</span></span>
                  <select value={datos.sedeId ?? ""} onChange={e => cambiar("sedeId", e.target.value ? Number(e.target.value) : null)} className={claseInput}>
                    <option value="">{sedes.length ? "Seleccione la sede" : "No hay sedes: créelas en Rutas de mensajeros"}</option>
                    {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                </label>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
            <button type="button" onClick={onCerrar} disabled={guardando} className="h-10 px-4 rounded-md border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50">
              Cancelar
            </button>
            <button type="button" onClick={guardar} disabled={guardando} className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-sky-500 text-white text-xs font-semibold hover:bg-sky-600 disabled:opacity-50">
              {guardando && <Loader2 size={15} className="animate-spin" />}
              {tramitador ? "Guardar cambios" : "Crear tramitador"}
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}

export default function GestionTramitadores({ tramitadores, sedes }: { tramitadores: Tramitador[], sedes: SedeOpcion[] }) {
  const [busqueda, setBusqueda] = useState("")
  // undefined = cerrado | null = nuevo | Tramitador = editando
  const [edicion, setEdicion] = useState<Tramitador | null | undefined>(undefined)
  const [cambiando, startCambiar] = useTransition()
  const [accesoDe, setAccesoDe] = useState<Tramitador | null>(null)

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    if (!texto) return tramitadores
    return tramitadores.filter(t =>
      [t.nombreTramitador, t.identificacion, t.region, t.correoTramitador].some(v => v?.toLowerCase().includes(texto))
    )
  }, [tramitadores, busqueda])

  const alternarActivo = (t: Tramitador) =>
    startCambiar(async () => {
      const resultado = await guardarTramitador({ ...t, activo: !t.activo }, t.id)
      if (resultado.ok) toast.success(`${t.nombreTramitador} ${t.activo ? "desactivado" : "activado"}`)
      else resultado.errores.forEach(error => toast.error(error))
    })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, identificación, región o correo"
            className={`${claseInput} pl-9`}
            aria-label="Buscar tramitador"
          />
        </div>
        <button type="button" onClick={() => setEdicion(null)} className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-sky-500 text-white text-xs font-semibold shadow-sm hover:bg-sky-600">
          <Plus size={15} />
          Nuevo tramitador
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Tramitador</th>
              <th className="px-4 py-3 font-semibold">Identificación</th>
              <th className="px-4 py-3 font-semibold">Región</th>
              <th className="px-4 py-3 font-semibold">Correo</th>
              <th className="px-4 py-3 font-semibold">WhatsApp</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 font-semibold">App</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtrados.map(t => (
              <tr key={t.id} className={t.activo ? "" : "text-slate-400"}>
                <td className="px-4 py-3 font-medium text-slate-700">{t.nombreTramitador}</td>
                <td className="px-4 py-3">{t.identificacion}</td>
                <td className="px-4 py-3">
                  {t.region ?? "—"}
                  {t.esMensajero && (
                    <span className="ml-2 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                      Mensajero{t.sedeId ? ` · ${sedes.find(s => s.id === t.sedeId)?.nombre ?? ""}` : ""}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">{t.correoTramitador}</td>
                <td className="px-4 py-3">{t.numeroTramitador ?? "—"}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => alternarActivo(t)}
                    disabled={cambiando}
                    title={t.activo ? "Clic para desactivar" : "Clic para activar"}
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${t.activo ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}
                  >
                    {t.activo ? "Activo" : "Inactivo"}
                  </button>
                </td>
                <td className="px-4 py-3"><EtiquetaAccesoApp acceso={t.acceso ?? null} /></td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button type="button" onClick={() => setAccesoDe(t)} className="p-1.5 text-slate-400 hover:text-sky-600" aria-label={`Acceso a la app de ${t.nombreTramitador}`} title="Acceso a la app">
                    <KeyRound size={15} />
                  </button>
                  <button type="button" onClick={() => setEdicion(t)} className="p-1.5 text-slate-400 hover:text-sky-600" aria-label={`Editar ${t.nombreTramitador}`}>
                    <Pencil size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtrados.length === 0 && <p className="py-12 text-center text-sm text-slate-400">No hay tramitadores que coincidan.</p>}
      </div>

      {edicion !== undefined && (
        <ModalTramitador key={edicion?.id ?? "nuevo"} tramitador={edicion} sedes={sedes} onCerrar={() => setEdicion(undefined)} />
      )}

      {accesoDe && <ModalAccesoApp key={accesoDe.id} tramitador={accesoDe} onCerrar={() => setAccesoDe(null)} />}
    </div>
  )
}
