"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "react-toastify"
import { Link2, X, Save, Loader2 } from "lucide-react"
import { consultarTramite, guardarGasto } from "@/actions/gastos/gastos"
import type {
  BolsaApoyo,
  Catalogos,
  DatosGasto,
  GastoDetalle,
  Operacion,
  Tercero,
  TramiteApoyo,
  Tramitador
} from "@/src/schemas/gastos"
import { formatoMoneda } from "@/src/lib/formato"
import BuscadorBeneficiario from "./BuscadorBeneficiario"
import Seccion from "../ui/Seccion"
import {
  claseBotonPrimario,
  claseBotonSecundario,
  claseInput,
  claseLabel,
  claseTextarea
} from "../ui/estilos"


// =====================================
// ESTADO INICIAL
// =====================================

const BENEFICIARIO_VACIO = {
  tipoIdentificacion: "NIT",
  identificacion: "",
  nombre: "",
  banco: "",
  tipoCuenta: "",
  numeroCuenta: "",
  correo: ""
}

// "0.110000" → "11"
const aPorcentaje = (fraccion: string) => String(Math.round(Number(fraccion) * 1e6) / 1e4)

const centavos = (valor: string | null) => Math.round(Number(valor || 0) * 100)

const datosIniciales = (porcentajeRetencion: number, gasto?: GastoDetalle): DatosGasto => ({
  operacionId: gasto?.operacionId ?? null,
  bolsaId: gasto?.bolsaId ?? null,
  solicitudTramiteId: gasto?.solicitudTramiteId ?? null,
  tramitadorId: gasto?.tramitadorId ?? null,
  tipoGastoId: gasto?.tipoGastoId ?? null,
  formaPagoId: gasto?.formaPagoId ?? null,
  // Por defecto reembolsable (se le cobra al cliente)
  reembolsable: gasto?.reembolsable ?? true,
  numeroFactura: gasto?.numeroFactura ?? "",
  conceptoPago: gasto?.conceptoPago ?? "",
  matriculaInmobiliaria: gasto?.matriculaInmobiliaria ?? "",
  placa: gasto?.placa ?? "",
  transito: gasto?.transito ?? "",
  contrato: gasto?.contrato ?? "",
  nombreClienteBanco: gasto?.nombreClienteBanco ?? "",
  identificacionClienteBanco: gasto?.identificacionClienteBanco ?? "",
  codigoBpr: gasto?.codigoBpr ?? "",
  valorSolicitado: gasto?.valorSolicitadoPago ? String(Number(gasto.valorSolicitadoPago)) : "",
  // Retención (solo inmuebles): base por defecto 0 y porcentaje por defecto el parámetro (11 %)
  baseRetencion: gasto?.retencionBase ? String(Number(gasto.retencionBase)) : "0",
  porcentajeRetencion: gasto?.retencionPorcentaje ? aPorcentaje(gasto.retencionPorcentaje) : String(porcentajeRetencion),
  observacion: gasto?.observacion ?? "",
  beneficiarioId: gasto?.beneficiarioId ?? null,
  beneficiario: null
})


// =====================================
// COMPONENTES PEQUEÑOS
// =====================================

function Campo({ etiqueta, obligatorio, children, className }: {
  etiqueta: string
  obligatorio?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className={claseLabel}>
        {etiqueta} {obligatorio && <span className="text-red-400">*</span>}
      </span>
      {children}
    </label>
  )
}

function Selector({ valor, opciones, onChange, vacio = "Seleccione una opción" }: {
  valor: number | null
  opciones: { id: number, nombre: string }[]
  onChange: (id: number | null) => void
  vacio?: string
}) {
  return (
    <select
      value={valor ?? ""}
      onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}
      className={claseInput}
    >
      <option value="">{vacio}</option>
      {opciones.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
    </select>
  )
}


// =====================================
// FORMULARIO
// =====================================

export default function FormularioGasto({
  catalogos,
  operaciones,
  tramitadores,
  bolsas,
  porcentajeRetencion,
  gasto
}: {
  catalogos: Catalogos
  operaciones: Operacion[]
  tramitadores: Tramitador[]
  bolsas: BolsaApoyo[]
  porcentajeRetencion: number
  gasto?: GastoDetalle
}) {
  const router = useRouter()
  const [guardando, startGuardar] = useTransition()
  const [consultando, startConsultar] = useTransition()

  const [datos, setDatos] = useState<DatosGasto>(() => datosIniciales(porcentajeRetencion, gasto))

  // Trámite asociado (opcional)
  const [numeroTramite, setNumeroTramite] = useState(gasto?.solicitudTramiteId ? String(gasto.solicitudTramiteId) : "")
  const [tramite, setTramite] = useState<TramiteApoyo | null>(null)

  // Beneficiario: uno existente o los datos de uno nuevo
  const [beneficiario, setBeneficiario] = useState<Tercero | null>(gasto?.beneficiario ?? null)
  const [beneficiarioNuevo, setBeneficiarioNuevo] = useState<typeof BENEFICIARIO_VACIO | null>(null)

  const cambiar = <K extends keyof DatosGasto>(campo: K, valor: DatosGasto[K]) =>
    setDatos(actuales => ({ ...actuales, [campo]: valor }))

  const codigoTipo = catalogos.tiposGasto.find(t => t.id === datos.tipoGastoId)?.codigo
  const llevaRetencion = codigoTipo === "INMUEBLE"

  // Vista previa de la retención (el cálculo definitivo lo hace el backend), en centavos
  const baseC = centavos(datos.baseRetencion)
  const retencionC = Math.round(baseC * Number(datos.porcentajeRetencion || 0) / 100)

  // ── Trámite ─────────────────────────────

  const cargarTramite = () => {
    const id = Number(numeroTramite)
    if (!id) return toast.error("Escriba el número del trámite")

    startConsultar(async () => {
      const resultado = await consultarTramite(id)

      if (!resultado.ok) {
        resultado.errores.forEach(e => toast.error(e))
        return
      }

      const t = resultado.datos
      setTramite(t)

      // Se completa solo lo que esté vacío para no borrar lo ya digitado
      setDatos(actuales => ({
        ...actuales,
        solicitudTramiteId: t.id,
        operacionId: actuales.operacionId ?? t.operacionesId,
        tramitadorId: actuales.tramitadorId ?? t.tramitadorId,
        placa: actuales.placa || (t.placa ?? ""),
        matriculaInmobiliaria: actuales.matriculaInmobiliaria || (t.matriculaInmobiliaria ?? ""),
        nombreClienteBanco: actuales.nombreClienteBanco || (t.clientes?.nombreCliente ?? ""),
        identificacionClienteBanco: actuales.identificacionClienteBanco || (t.clientes?.identificacionCliente ?? "")
      }))

      toast.success(`Datos del trámite ${t.id} cargados`)
    })
  }

  const quitarTramite = () => {
    setTramite(null)
    setNumeroTramite("")
    cambiar("solicitudTramiteId", null)
  }


  // ── Guardar ─────────────────────────────

  const guardar = (e: React.FormEvent) => {
    e.preventDefault()

    if (!beneficiario && !beneficiarioNuevo) {
      toast.error("Debe seleccionar o registrar el beneficiario del pago")
      return
    }

    if (llevaRetencion) {
      const porcentaje = Number(datos.porcentajeRetencion)
      if (datos.porcentajeRetencion === "" || !(porcentaje >= 0 && porcentaje <= 100)) {
        toast.error("El porcentaje de retención debe estar entre 0 y 100")
        return
      }
      if (baseC < 0) {
        toast.error("La base de retención no puede ser negativa")
        return
      }
    }

    const payload = {
      ...datos,
      // La retención solo se envía en gastos de inmueble
      baseRetencion: llevaRetencion ? datos.baseRetencion : null,
      porcentajeRetencion: llevaRetencion ? datos.porcentajeRetencion : null,
      beneficiarioId: beneficiario?.id ?? null,
      beneficiario: beneficiario ? null : beneficiarioNuevo
    }

    startGuardar(async () => {
      const resultado = await guardarGasto(payload, gasto?.id)

      if (!resultado.ok) {
        resultado.errores.forEach(error => toast.error(error))
        return
      }

      toast.success(gasto ? "Gasto actualizado" : "Gasto creado")
      router.push(`/solicitudes/${resultado.datos.id}`)
      router.refresh()
    })
  }


  return (
    <form onSubmit={guardar} className="space-y-6" noValidate>

      {/* ── TRÁMITE ── */}
      <Seccion
        titulo="Trámite asociado"
        descripcion="Opcional. Si el gasto es de un trámite, cárguelo para completar los datos automáticamente."
      >
        {datos.solicitudTramiteId ? (
          <div className="flex items-start justify-between gap-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3">
            <div className="text-xs text-slate-600">
              <p className="font-semibold text-emerald-800">Trámite #{datos.solicitudTramiteId}</p>
              {tramite && (
                <p className="mt-0.5">
                  {tramite.tramite?.nombreTramite} · {tramite.clientes?.nombreCliente} · {tramite.operaciones?.nombreOperacion}
                </p>
              )}
            </div>
            <button type="button" onClick={quitarTramite} className="text-slate-400 hover:text-red-500" aria-label="Quitar trámite">
              <X size={16} />
            </button>
          </div>
        ) : (
          <div className="flex gap-2 max-w-md">
            <input
              type="number"
              min={1}
              value={numeroTramite}
              onChange={e => setNumeroTramite(e.target.value)}
              placeholder="Número del trámite"
              className={claseInput}
              aria-label="Número del trámite"
            />
            <button type="button" onClick={cargarTramite} disabled={consultando} className={claseBotonSecundario}>
              {consultando ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />}
              Cargar
            </button>
          </div>
        )}
      </Seccion>


      {/* ── DATOS GENERALES ── */}
      <Seccion titulo="Datos del gasto">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Campo etiqueta="Operación" obligatorio>
            <Selector
              valor={datos.operacionId}
              opciones={operaciones.map(o => ({
                id: o.id,
                nombre: o.centroDeCostos ? `${o.nombreOperacion} (${o.centroDeCostos})` : o.nombreOperacion
              }))}
              onChange={v => cambiar("operacionId", v)}
            />
          </Campo>

          <Campo etiqueta="Bolsa" obligatorio>
            <Selector
              valor={datos.bolsaId}
              opciones={bolsas.map(b => ({
                id: b.id,
                nombre: b.lineaNegocio ? `${b.nombre} · ${b.lineaNegocio}` : b.nombre
              }))}
              onChange={v => cambiar("bolsaId", v)}
              vacio={bolsas.length ? "Seleccione la bolsa" : "No hay bolsas activas"}
            />
          </Campo>

          <Campo etiqueta="Tipo de gasto" obligatorio>
            <Selector valor={datos.tipoGastoId} opciones={catalogos.tiposGasto} onChange={v => cambiar("tipoGastoId", v)} />
          </Campo>

          <Campo etiqueta="Forma de pago" obligatorio>
            <Selector valor={datos.formaPagoId} opciones={catalogos.formasPago} onChange={v => cambiar("formaPagoId", v)} />
          </Campo>

          <Campo etiqueta="Concepto del pago" obligatorio className="sm:col-span-2">
            <input
              value={datos.conceptoPago}
              onChange={e => cambiar("conceptoPago", e.target.value)}
              maxLength={200}
              placeholder="Ej: Pago derechos de tránsito"
              className={claseInput}
            />
          </Campo>

          <Campo etiqueta="Número de factura">
            <input value={datos.numeroFactura} onChange={e => cambiar("numeroFactura", e.target.value)} maxLength={50} className={claseInput} />
          </Campo>

          <Campo etiqueta="Tramitador">
            <Selector
              valor={datos.tramitadorId}
              opciones={tramitadores.map(t => ({ id: t.id, nombre: t.nombreTramitador }))}
              onChange={v => cambiar("tramitadorId", v)}
              vacio="Sin tramitador"
            />
          </Campo>

          <label className="flex items-center gap-2 self-end h-10 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={datos.reembolsable}
              onChange={e => cambiar("reembolsable", e.target.checked)}
              className="h-4 w-4 accent-emerald-600"
            />
            Reembolsable (se le cobra al cliente)
          </label>
        </div>

        {/* Campos según el tipo de gasto */}
        {codigoTipo === "VEHICULO" && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Campo etiqueta="Placa" obligatorio>
              <input value={datos.placa} onChange={e => cambiar("placa", e.target.value.toUpperCase())} maxLength={20} className={claseInput} />
            </Campo>
            <Campo etiqueta="Tránsito" obligatorio>
              <input value={datos.transito} onChange={e => cambiar("transito", e.target.value)} maxLength={100} placeholder="Ej: Tránsito de Bogotá" className={claseInput} />
            </Campo>
          </div>
        )}

        {codigoTipo === "INMUEBLE" && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Campo etiqueta="Matrícula inmobiliaria" obligatorio>
              <input value={datos.matriculaInmobiliaria} onChange={e => cambiar("matriculaInmobiliaria", e.target.value)} maxLength={50} className={claseInput} />
            </Campo>
          </div>
        )}

        {/* CTL: puede ser de un vehículo o de un inmueble (ambos opcionales). Lo paga Tesorería - Certificados */}
        {codigoTipo === "CTL" && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Campo etiqueta="Placa (si es de un vehículo)">
              <input value={datos.placa} onChange={e => cambiar("placa", e.target.value.toUpperCase())} maxLength={20} className={claseInput} />
            </Campo>
            <Campo etiqueta="Matrícula inmobiliaria (si es de un inmueble)">
              <input value={datos.matriculaInmobiliaria} onChange={e => cambiar("matriculaInmobiliaria", e.target.value)} maxLength={50} className={claseInput} />
            </Campo>
          </div>
        )}

        {(codigoTipo === "CTL" || codigoTipo === "CAMARA_COMERCIO") && (
          <p className="mt-3 rounded-md bg-sky-50 px-3 py-2 text-xs text-sky-800">
            Compra de certificados: la paga Tesorería - Certificados (no sale en el &quot;Por pagar&quot; general).
          </p>
        )}
      </Seccion>


      {/* ── CLIENTE / BANCO ── */}
      <Seccion titulo="Cliente / banco">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Campo etiqueta="Nombre del cliente">
            <input value={datos.nombreClienteBanco} onChange={e => cambiar("nombreClienteBanco", e.target.value)} maxLength={200} className={claseInput} />
          </Campo>
          <Campo etiqueta="Identificación del cliente">
            <input value={datos.identificacionClienteBanco} onChange={e => cambiar("identificacionClienteBanco", e.target.value)} maxLength={30} className={claseInput} />
          </Campo>
          <Campo etiqueta="Contrato">
            <input value={datos.contrato} onChange={e => cambiar("contrato", e.target.value)} maxLength={50} className={claseInput} />
          </Campo>
          <Campo etiqueta="Código BPR">
            <input value={datos.codigoBpr} onChange={e => cambiar("codigoBpr", e.target.value)} maxLength={50} className={claseInput} />
          </Campo>
        </div>
      </Seccion>


      {/* ── BENEFICIARIO ── */}
      <Seccion titulo="Beneficiario del pago" descripcion="A quién se le paga. Se guarda para reutilizarlo en otros gastos.">
        {beneficiario ? (
          <div className="flex items-start justify-between gap-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-xs text-slate-600">
              <p className="font-semibold text-slate-700">{beneficiario.nombre}</p>
              <p className="mt-0.5">{beneficiario.tipoIdentificacion} {beneficiario.identificacion}</p>
              {beneficiario.banco && (
                <p className="mt-0.5">{beneficiario.banco} · {beneficiario.tipoCuenta} · {beneficiario.numeroCuenta}</p>
              )}
            </div>
            <button type="button" onClick={() => setBeneficiario(null)} className="text-xs font-medium text-emerald-700 hover:underline">
              Cambiar
            </button>
          </div>
        ) : beneficiarioNuevo ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Campo etiqueta="Tipo de identificación" obligatorio>
                <select
                  value={beneficiarioNuevo.tipoIdentificacion}
                  onChange={e => setBeneficiarioNuevo({ ...beneficiarioNuevo, tipoIdentificacion: e.target.value })}
                  className={claseInput}
                >
                  {["NIT", "CC", "CE", "PAS"].map(t => <option key={t}>{t}</option>)}
                </select>
              </Campo>
              <Campo etiqueta="Identificación" obligatorio>
                <input value={beneficiarioNuevo.identificacion} onChange={e => setBeneficiarioNuevo({ ...beneficiarioNuevo, identificacion: e.target.value })} maxLength={30} className={claseInput} />
              </Campo>
              <Campo etiqueta="Nombre o razón social" obligatorio className="sm:col-span-2">
                <input value={beneficiarioNuevo.nombre} onChange={e => setBeneficiarioNuevo({ ...beneficiarioNuevo, nombre: e.target.value })} maxLength={200} className={claseInput} />
              </Campo>
              <Campo etiqueta="Banco">
                <input value={beneficiarioNuevo.banco} onChange={e => setBeneficiarioNuevo({ ...beneficiarioNuevo, banco: e.target.value })} maxLength={100} className={claseInput} />
              </Campo>
              <Campo etiqueta="Tipo de cuenta">
                <select
                  value={beneficiarioNuevo.tipoCuenta}
                  onChange={e => setBeneficiarioNuevo({ ...beneficiarioNuevo, tipoCuenta: e.target.value })}
                  className={claseInput}
                >
                  <option value="">Sin cuenta</option>
                  <option value="AHORROS">Ahorros</option>
                  <option value="CORRIENTE">Corriente</option>
                </select>
              </Campo>
              <Campo etiqueta="Número de cuenta">
                <input value={beneficiarioNuevo.numeroCuenta} onChange={e => setBeneficiarioNuevo({ ...beneficiarioNuevo, numeroCuenta: e.target.value })} maxLength={30} className={claseInput} />
              </Campo>
              <Campo etiqueta="Correo">
                <input type="email" value={beneficiarioNuevo.correo} onChange={e => setBeneficiarioNuevo({ ...beneficiarioNuevo, correo: e.target.value })} maxLength={100} className={claseInput} />
              </Campo>
            </div>
            <button type="button" onClick={() => setBeneficiarioNuevo(null)} className="text-xs font-medium text-slate-500 hover:underline">
              Volver a buscar un beneficiario existente
            </button>
          </div>
        ) : (
          <BuscadorBeneficiario
            onSeleccionar={setBeneficiario}
            onNuevo={identificacion => setBeneficiarioNuevo({ ...BENEFICIARIO_VACIO, identificacion })}
          />
        )}
      </Seccion>


      {/* ── VALOR ── */}
      <Seccion
        titulo="Valor"
        descripcion={llevaRetencion
          ? "Tesorería paga el valor solicitado sin deducción; la retención es informativa. El 4x1000 se calcula cuando Legalización registre la factura real."
          : "Valor del gasto. El 4x1000 se calcula cuando Legalización registre la factura real."}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo etiqueta="Valor solicitado" obligatorio>
            <input
              type="number"
              min={0}
              step="0.01"
              value={datos.valorSolicitado}
              onChange={e => cambiar("valorSolicitado", e.target.value)}
              placeholder="0"
              className={claseInput}
            />
          </Campo>

          {/* Retención: solo gastos de inmueble */}
          {llevaRetencion && (
            <>
              <Campo etiqueta="Base de retención">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={datos.baseRetencion ?? ""}
                  onChange={e => cambiar("baseRetencion", e.target.value)}
                  placeholder="0 si no aplica"
                  className={claseInput}
                />
              </Campo>
              <Campo etiqueta="Porcentaje de retención (%)" obligatorio>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={datos.porcentajeRetencion ?? ""}
                  onChange={e => cambiar("porcentajeRetencion", e.target.value)}
                  className={claseInput}
                />
              </Campo>
            </>
          )}
        </div>

        {llevaRetencion && (
          <div className="mt-4 grid gap-x-6 gap-y-2 rounded-md bg-slate-50 px-4 py-3 text-xs sm:grid-cols-2">
            <p className="flex justify-between">
              <span className="text-slate-500">Retención ({datos.porcentajeRetencion || 0} % de la base)</span>
              <b>{formatoMoneda(retencionC / 100)}</b>
            </p>
            <p className="flex justify-between">
              <span className="text-slate-500">Total a pagar (base − retención)</span>
              <b className="text-slate-800">{formatoMoneda((baseC - retencionC) / 100)}</b>
            </p>
          </div>
        )}
      </Seccion>


      {/* ── OBSERVACIÓN ── */}
      <Seccion titulo="Observación">
        <textarea
          value={datos.observacion}
          onChange={e => cambiar("observacion", e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Información adicional para Tesorería (opcional)"
          className={claseTextarea}
        />
      </Seccion>


      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => router.back()} className={claseBotonSecundario}>Cancelar</button>
        <button type="submit" disabled={guardando} className={claseBotonPrimario}>
          {guardando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {gasto ? "Guardar cambios" : "Crear gasto"}
        </button>
      </div>

    </form>
  )
}
