import Link from "next/link"
import { ArrowLeft, Clock, Info } from "lucide-react"
import { obtenerSesion } from "@/src/auth/dal"
import { ROLES } from "@/src/auth/permisos"
import { obtenerLote } from "@/src/lib/datosTesoreria"
import { formatoFecha, formatoFechaHora, formatoMoneda } from "@/src/lib/formato"
import { ESTADOS_LOTE } from "@/src/schemas/gastos"
import SoportesLote from "./SoportesLote"
import GastosLote from "./GastosLote"
import ConfirmarPagoLote from "./ConfirmarPagoLote"
import BotonEgreso from "../contabilidad/BotonEgreso"
import ListaDocumentos from "../gastos/ListaDocumentos"
import EstadoGasto from "../gastos/EstadoGasto"
import Seccion from "../ui/Seccion"
import Dato from "../ui/Dato"

// Qué ve cada quien según el estado del lote
const AVISOS: Record<string, Partial<Record<"tesoreria" | "direccion" | "contabilidad", string>>> = {
  PROGRAMADO: {
    tesoreria: "Esperando la aprobación de Dirección de Negocio. Puede quitar del pago los gastos que no se vayan a pagar.",
    direccion: "Apruebe los gastos que deben pagarse. Los que rechace vuelven a Tesorería como Por pagar."
  },
  APROBADO: {
    tesoreria: "Dirección de Negocio aprobó este pago. Cuando el banco lo procese, adjunte el soporte y confirme el pago.",
    direccion: "Aprobado. Tesorería confirmará el pago cuando adjunte el soporte del banco."
  },
  RECHAZADO: {
    tesoreria: "Todos los gastos de este lote se rechazaron o se quitaron: volvieron a Por pagar.",
    direccion: "Todos los gastos de este lote se rechazaron o se quitaron: volvieron a Por pagar."
  }
}

// Detalle de un lote de pago. Lo usan Tesorería (quita gastos, adjunta el soporte y confirma),
// Dirección de Negocio (aprueba o rechaza) y Contabilidad (registra el egreso de los pagados).
export default async function DetalleLote({
  id,
  rutaVolver,
  etiquetaVolver,
  modo
}: {
  id: number
  rutaVolver: string
  etiquetaVolver: string
  modo: "tesoreria" | "contabilidad" | "direccion"
}) {
  const [sesion, lote] = await Promise.all([obtenerSesion(), obtenerLote(id)])
  const pagado = lote.estado === "PAGADO"
  const aviso = AVISOS[lote.estado]?.[modo]

  const accionGastos =
    modo === "direccion" && lote.estado === "PROGRAMADO" ? "aprobar"
      : modo === "tesoreria" && (lote.estado === "PROGRAMADO" || lote.estado === "APROBADO") ? "quitar"
        : null

  return (
    <div className="space-y-6">
      <Link href={rutaVolver} className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
        <ArrowLeft size={14} />
        {etiquetaVolver}
      </Link>

      <Seccion
        titulo={`Lote de pago #${lote.id}`}
        descripcion={`Programado por ${lote.creador?.nombreUsuario} el ${formatoFechaHora(lote.createdAt)}`}
        acciones={<EstadoGasto codigo={lote.estado} nombre={ESTADOS_LOTE[lote.estado] ?? lote.estado} />}
      >
        <dl className="grid gap-5 sm:grid-cols-3">
          <Dato etiqueta={pagado ? "Fecha de pago" : "Fecha programada"} valor={formatoFecha(lote.fechaPago)} />
          <Dato etiqueta="Bolsa" valor={lote.bolsa.nombre} />
          <Dato etiqueta="Total" valor={<span className="text-base font-semibold text-slate-800">{formatoMoneda(lote.total)}</span>} />
          {lote.aprobador && (
            <Dato etiqueta="Aprobado por" valor={`${lote.aprobador.nombreUsuario}${lote.fechaAprobacion ? ` · ${formatoFechaHora(lote.fechaAprobacion)}` : ""}`} />
          )}
          {lote.confirmador && (
            <Dato etiqueta="Pago confirmado por" valor={`${lote.confirmador.nombreUsuario}${lote.fechaConfirmacion ? ` · ${formatoFechaHora(lote.fechaConfirmacion)}` : ""}`} />
          )}
          {pagado && (
            <Dato
              etiqueta="Número de egreso (Contabilidad)"
              valor={
                <span className="inline-flex items-center gap-2">
                  {lote.numeroEgreso ?? <span className="text-amber-600">Pendiente</span>}
                  {modo === "contabilidad" && (
                    <BotonEgreso loteId={lote.id} total={lote.total} cantidadGastos={lote.gastos.length} numeroActual={lote.numeroEgreso} />
                  )}
                </span>
              }
            />
          )}
          {lote.observacion && <div className="sm:col-span-3"><Dato etiqueta="Observación" valor={lote.observacion} /></div>}
        </dl>

        {aviso && (
          <div className="mt-5 flex gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            {lote.estado === "PROGRAMADO" ? <Clock size={15} className="mt-0.5 shrink-0 text-orange-500" /> : <Info size={15} className="mt-0.5 shrink-0 text-teal-600" />}
            <p>{aviso}</p>
          </div>
        )}
      </Seccion>

      <Seccion titulo={`Gastos (${lote.gastos.length})`}>
        <GastosLote loteId={lote.id} gastos={lote.gastos} accion={accionGastos} />
      </Seccion>

      {/* Soporte del banco: se adjunta cuando Dirección aprueba; con él se confirma el pago */}
      {modo === "tesoreria" && lote.estado === "APROBADO" ? (
        <Seccion titulo="Confirmar pago" descripcion="1. Adjunte el soporte del banco  ·  2. Indique la fecha del pago y confírmelo.">
          <div className="space-y-6">
            <SoportesLote
              loteId={lote.id}
              documentos={lote.documentos}
              usuarioId={sesion.id}
              esAdmin={sesion.roles.includes(ROLES.ADMIN)}
            />
            <div className="border-t border-slate-100 pt-5">
              <ConfirmarPagoLote loteId={lote.id} total={lote.total} haySoporte={lote.documentos.length > 0} />
            </div>
          </div>
        </Seccion>
      ) : (pagado || lote.documentos.length > 0) && (
        <Seccion titulo="Soporte de pago" descripcion="Lo ven también quienes crearon los gastos de este lote.">
          {modo === "tesoreria" && pagado ? <SoportesLote
            loteId={lote.id}
            documentos={lote.documentos}
            usuarioId={sesion.id}
            esAdmin={sesion.roles.includes(ROLES.ADMIN)}
          /> : <ListaDocumentos documentos={lote.documentos} vacio="Este lote no tiene soporte de pago." />}
        </Seccion>
      )}
    </div>
  )
}
