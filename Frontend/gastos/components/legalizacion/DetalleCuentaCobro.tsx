import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { obtenerSesion } from "@/src/auth/dal"
import { ROLES } from "@/src/auth/permisos"
import { obtenerCuenta } from "@/src/lib/datosLegalizacion"
import { formatoFecha, formatoFechaHora, formatoMoneda } from "@/src/lib/formato"
import EstadoGasto from "../gastos/EstadoGasto"
import LineasCuenta from "./LineasCuenta"
import BotonDescargarDocumentos from "./BotonDescargarDocumentos"
import DatosCuenta from "./DatosCuenta"
import { BotonesCuenta, DocumentosCuenta } from "./AccionesCuenta"
import Seccion from "../ui/Seccion"
import Dato from "../ui/Dato"

// Detalle de una cuenta de cobro. Se usa en Legalización y en Tesorería (cambia la ruta base);
// los botones que se muestran dependen de los permisos que envía el backend.
export default async function DetalleCuentaCobro({ id, rutaBase }: { id: number, rutaBase: string }) {
  const [sesion, cuenta] = await Promise.all([obtenerSesion(), obtenerCuenta(id)])

  return (
    <div className="space-y-6">
      <Link href={rutaBase} className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
        <ArrowLeft size={14} />
        Volver a cuentas de cobro
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-slate-800">{cuenta.numeroCuentaCobro}</h2>
            <EstadoGasto codigo={cuenta.estado.codigo} nombre={cuenta.estado.nombre} />
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Creada por {cuenta.creador?.nombreUsuario} el {formatoFechaHora(cuenta.createdAt)}
            {cuenta.fechaLegalizacion && ` · legalizada el ${formatoFechaHora(cuenta.fechaLegalizacion)}`}
          </p>
        </div>
        <BotonesCuenta cuenta={cuenta} />
      </div>

      {cuenta.motivoAnulacion && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          <b>Motivo de anulación:</b> {cuenta.motivoAnulacion}
        </div>
      )}

      {/* Totales */}
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Gastos", String(cuenta.lineas.length)],
          ["Total facturas", formatoMoneda(cuenta.totalFacturas)],
          ["4x1000", formatoMoneda(cuenta.totalCuatroXMil)],
          ["Total legalizado", formatoMoneda(cuenta.totalLegalizado)]
        ].map(([etiqueta, valor]) => (
          <div key={etiqueta} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{etiqueta}</p>
            <p className="mt-1 text-base font-semibold text-slate-800">{valor}</p>
          </div>
        ))}
      </div>

      <Seccion titulo="Datos de la cuenta de cobro">
        <DatosCuenta cuenta={cuenta} />
      </Seccion>

      <Seccion
        titulo="Gastos"
      >
        <LineasCuenta cuentaId={cuenta.id} lineas={cuenta.lineas} editable={cuenta.permisos.editar} />

        {/* Todos los documentos de los gastos de la cuenta en un ZIP (para radicarla) */}
        {cuenta.lineas.length > 0 && (
          <div className="mt-4 flex justify-end">
            <BotonDescargarDocumentos
              gastoIds={cuenta.lineas.map(l => l.solicitudGasto.id)}
              texto={`Descargar documentos de los ${cuenta.lineas.length} gasto(s)`}
            />
          </div>
        )}
      </Seccion>

      {cuenta.contabilizacion && (
        <Seccion titulo="Contabilidad">
          <dl className="grid gap-5 sm:grid-cols-3">
            <Dato etiqueta="Estado" valor={cuenta.contabilizacion.contabilizado ? "Contabilizado" : "Pendiente contabilizar"} />
            <Dato etiqueta="Documento contable" valor={cuenta.contabilizacion.documentoContable} />
            <Dato etiqueta="Fecha" valor={cuenta.contabilizacion.fechaContabilizacion && formatoFecha(cuenta.contabilizacion.fechaContabilizacion)} />
          </dl>
        </Seccion>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Seccion titulo="Documentos">
          <DocumentosCuenta cuenta={cuenta} usuarioId={sesion.id} esAdmin={sesion.roles.includes(ROLES.ADMIN)} />
        </Seccion>

        <Seccion titulo="Historial">
          <ol className="space-y-3">
            {cuenta.trazabilidad.map(evento => (
              <li key={evento.id} className="flex flex-wrap items-center gap-2 text-xs">
                <EstadoGasto codigo={evento.estadoNuevo.codigo} nombre={evento.estadoNuevo.nombre} />
                <span className="text-slate-400">{formatoFechaHora(evento.createdAt)} · {evento.usuario?.nombreUsuario}</span>
                {evento.observacion && <span className="w-full text-slate-600">{evento.observacion}</span>}
              </li>
            ))}
          </ol>
        </Seccion>
      </div>
    </div>
  )
}
