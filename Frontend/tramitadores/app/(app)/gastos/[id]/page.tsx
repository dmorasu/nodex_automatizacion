import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, FileText } from "lucide-react"
import { obtenerDatos } from "@/src/lib/api"
import { formatoFecha, formatoFechaHora, formatoMoneda } from "@/src/lib/formato"
import { GastoSchema, type Soporte } from "@/src/schemas"
import SubirSoporte from "@/components/gastos/SubirSoporte"
import { pendienteDelGasto } from "@/components/gastos/TarjetaGasto"
import Etiqueta, { type Tono } from "@/components/ui/Etiqueta"
import Seccion, { Dato } from "@/components/ui/Seccion"
import { nombreTipoSoporte } from "@/src/tiposDocumento"

const ESTADO_SOPORTE: Record<Soporte["estado"], { tono: Tono, texto: string }> = {
  PENDIENTE: { tono: "indigo", texto: "En revisión" },
  APROBADO: { tono: "verde", texto: "Aprobado" },
  RECHAZADO: { tono: "rojo", texto: "Rechazado" }
}

export default async function DetalleGastoPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const gasto = await obtenerDatos(`/gastos/${Number(params.id)}`, GastoSchema)
  if (!gasto) notFound()

  const pendiente = pendienteDelGasto(gasto)
  const reintegrosPendientes = gasto.reintegros
    .filter(r => gasto.reintegrosPorSoportar.includes(r.id))
    .map(r => ({ id: r.id, valor: r.valorReintegro }))
  // La factura de un gasto con trámite se sube en el trámite (llega sola aquí)
  const facturaAqui = gasto.puedeSubirFactura && !gasto.solicitudTramiteId
  const subir = { gastoId: gasto.id, puedeSubirFactura: facturaAqui, reintegros: reintegrosPendientes }

  return (
    <div className="space-y-4">
      <Link href="/gastos" className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600">
        <ArrowLeft size={16} /> Reintegros
      </Link>

      <div>
        <p className="text-xs font-semibold text-indigo-600">{gasto.codigo}</p>
        <h1 className="text-xl font-semibold text-slate-800">{gasto.conceptoPago}</h1>
        <div className="mt-2 flex flex-wrap gap-2">
          <Etiqueta tono={pendiente.tono}>{pendiente.texto}</Etiqueta>
          <Etiqueta>{gasto.estado.nombre}</Etiqueta>
        </div>
      </div>

      {/* LO QUE DEBE HACER (abre la subida con el tipo ya elegido) */}
      {reintegrosPendientes.length > 0 && (
        <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-900">
            La factura fue menor a lo pagado. Debe devolver{" "}
            <b>{formatoMoneda(reintegrosPendientes.reduce((s, r) => s + Number(r.valor), 0))}</b> y subir el comprobante.
          </p>
          <SubirSoporte {...subir} tipoInicial="REINTEGRO" texto="Subir comprobante de reintegro" principal />
        </div>
      )}

      {gasto.puedeSubirFactura && (
        <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          {facturaAqui ? (
            <>
              <p className="text-sm text-amber-900">Suba la factura de este pago para legalizarlo.</p>
              <SubirSoporte {...subir} tipoInicial="FACTURA" texto="Subir factura" principal />
            </>
          ) : (
            <p className="text-sm text-amber-900">
              Falta la factura. Súbala en el{" "}
              <Link href={`/tramites/${gasto.solicitudTramiteId}`} className="font-semibold underline">trámite N° {gasto.solicitudTramiteId}</Link>{" "}
              (tipo Factura): llega sola a este gasto.
            </p>
          )}
        </div>
      )}

      {/* DATOS */}
      <Seccion titulo="Datos del gasto">
        <dl className="divide-y divide-slate-100">
          <Dato etiqueta="Valor pagado">{formatoMoneda(gasto.valorRealmentePagado)}</Dato>
          <Dato etiqueta="Fecha de pago">{formatoFecha(gasto.fechaPago)}</Dato>
          <Dato etiqueta="Beneficiario">{gasto.beneficiario?.nombre}</Dato>
          <Dato etiqueta="Trámite">{gasto.solicitudTramiteId && (
            <Link href={`/tramites/${gasto.solicitudTramiteId}`} className="font-semibold text-indigo-600">N° {gasto.solicitudTramiteId}</Link>
          )}</Dato>
          <Dato etiqueta="Placa / matrícula">{gasto.placa ?? gasto.matriculaInmobiliaria}</Dato>
          <Dato etiqueta="Factura registrada">
            {gasto.factura && `${gasto.factura.numeroFactura ?? "Sin número"} · ${formatoMoneda(gasto.factura.valorFactura)}`}
          </Dato>
        </dl>
      </Seccion>

      {/* REINTEGROS */}
      {gasto.reintegros.length > 0 && (
        <Seccion titulo="Reintegros">
          <ul className="divide-y divide-slate-100">
            {gasto.reintegros.map(r => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-semibold tabular-nums text-slate-800">{formatoMoneda(r.valorReintegro)}</p>
                  <p className="text-[11px] text-slate-400">
                    {r.estado.codigo === "REINTEGRADO" ? `Recibido el ${formatoFecha(r.fechaReintegro)}` : `Generado el ${formatoFecha(r.createdAt)}`}
                  </p>
                </div>
                <Etiqueta tono={r.estado.codigo === "REINTEGRADO" ? "verde" : "ambar"}>{r.estado.nombre}</Etiqueta>
              </li>
            ))}
          </ul>
        </Seccion>
      )}

      {/* DOCUMENTOS ENVIADOS */}
      <Seccion titulo="Documentos enviados">
        {gasto.estado.codigo !== "CONTABILIZADO" && (
          <div className="mb-3">
            <SubirSoporte {...subir} />
          </div>
        )}

        {gasto.soportes.length === 0 ? (
          <p className="text-sm text-slate-400">Aún no ha enviado documentos para este gasto.</p>
        ) : (
          <ul className="space-y-3">
            {gasto.soportes.map(s => (
              <li key={s.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-700">{nombreTipoSoporte(s.tipo)}</p>
                    <p className="text-[11px] text-slate-400">Enviado {formatoFechaHora(s.createdAt)}</p>
                  </div>
                  <Etiqueta tono={ESTADO_SOPORTE[s.estado].tono}>{ESTADO_SOPORTE[s.estado].texto}</Etiqueta>
                </div>

                {s.estado === "RECHAZADO" && s.motivoRechazo && (
                  <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                    <b>Motivo:</b> {s.motivoRechazo}
                  </p>
                )}
                {s.observacion && <p className="mt-2 whitespace-pre-line text-xs text-slate-500">{s.observacion}</p>}

                <ul className="mt-2 space-y-1">
                  {s.archivos.map(a => (
                    <li key={a.id}>
                      <a href={`/soportes/archivos/${a.id}`} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1.5 text-xs font-semibold text-indigo-600">
                        <FileText size={14} className="shrink-0" />
                        <span className="truncate">{a.nombreOriginal}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Seccion>
    </div>
  )
}
