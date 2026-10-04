import Link from "next/link"
import { formatoFecha, formatoFechaHora, formatoMoneda, formatoPorcentaje } from "@/src/lib/formato"
import type { GastoDetalle } from "@/src/schemas/gastos"
import EstadoGasto from "../gastos/EstadoGasto"
import ListaDocumentos from "../gastos/ListaDocumentos"
import Seccion from "../ui/Seccion"
import Dato from "../ui/Dato"
import BotonFactura from "./BotonFactura"
import { BotonMarcarReintegrado } from "./BotonReintegro"
import type { Tasas } from "./ModalFactura"

// Factura real, reintegros y cuenta de cobro de un gasto pagado
export default function SeccionLegalizacionGasto({
  gasto,
  esLegalizacion,
  rutaCuentas,
  tasas,
  tipoDocumentoFacturaId
}: {
  gasto: GastoDetalle
  esLegalizacion: boolean
  // Dónde abrir la cuenta de cobro según el rol (null = sin enlace)
  rutaCuentas: string | null
  tasas: Tasas
  tipoDocumentoFacturaId: number | null
}) {
  const { factura } = gasto
  // Solo una cuenta activa; las anuladas quedan como historial
  const linea = gasto.lineasCuentaCobro.find(l => l.cuentaCobro.estado.codigo !== "ANULADA")
  const retencionAnterior = factura && (gasto.retencionBase === null || gasto.retencionBase === undefined) && Number(factura.baseRetencion) > 0

  return (
    <Seccion
      titulo="Factura y legalización"
      acciones={gasto.permisos.registrarFactura && (
        <BotonFactura gasto={gasto} factura={factura} tasas={tasas} tipoDocumentoFacturaId={tipoDocumentoFacturaId} />
      )}
    >
      <div className="space-y-6">

        {/* Factura real */}
        {factura ? (
          <div>
            <dl className="grid gap-5 sm:grid-cols-4">
              <Dato etiqueta="Número de factura" valor={factura.numeroFactura} />
              <Dato etiqueta="Valor de la factura" valor={<b>{formatoMoneda(factura.valorFactura)}</b>} />
              <Dato etiqueta="Tercero" valor={factura.nombreTerceroReal && `${factura.nombreTerceroReal} (${factura.identificacionTerceroReal ?? "—"})`} />
              <Dato etiqueta="Factura real" valor={factura.tieneFacturaReal ? "Sí" : "No"} />
              {/* La retención ahora se define al crear el gasto; aquí solo se ve en facturas anteriores al cambio */}
              {retencionAnterior && (
                <>
                  <Dato etiqueta="Base de retención" valor={formatoMoneda(factura.baseRetencion)} />
                  <Dato etiqueta={`Retención (${formatoPorcentaje(factura.porcentajeRetencion)})`} valor={formatoMoneda(factura.retencionFuente)} />
                  <Dato etiqueta="Total a pagar" valor={formatoMoneda(factura.totalPagar)} />
                </>
              )}
              <Dato etiqueta="4x1000" valor={formatoMoneda(factura.cuatroXMil)} />
              <Dato etiqueta="Valor a legalizar" valor={<b className="text-slate-800">{formatoMoneda(factura.valorLegalizado)}</b>} />
            </dl>
            <p className="mt-3 text-[11px] text-slate-400">
              Registrada por {factura.registrador?.nombreUsuario} · {formatoFechaHora(factura.updatedAt)}
              {factura.observacion && ` · ${factura.observacion}`}
            </p>
          </div>
        ) : (
          <p className="text-xs text-slate-400">Aún no se ha registrado la factura real.</p>
        )}

        {/* Reintegros (se crean solos: pagado − factura) */}
        {gasto.reintegros.length > 0 && (
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">Reintegro</p>
            <ul className="space-y-3">
              {gasto.reintegros.map(reintegro => (
                <li key={reintegro.id} className="rounded-md border border-slate-200 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 text-xs">
                      <b className="text-slate-800">{formatoMoneda(reintegro.valorReintegro)}</b>
                      <EstadoGasto codigo={reintegro.estado.codigo} nombre={reintegro.estado.nombre} />
                      {reintegro.fechaReintegro && <span className="text-slate-400">recibido el {formatoFecha(reintegro.fechaReintegro)}</span>}
                    </div>
                    {esLegalizacion && reintegro.estado.codigo === "PENDIENTE" && (
                      <BotonMarcarReintegrado reintegroId={reintegro.id} codigo={gasto.codigo} valor={reintegro.valorReintegro} />
                    )}
                  </div>
                  {reintegro.observacion && <p className="mt-1 text-xs text-slate-500">{reintegro.observacion}</p>}
                  {reintegro.documentos.length > 0 && (
                    <div className="mt-2"><ListaDocumentos documentos={reintegro.documentos} /></div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Cuenta de cobro (reembolsables) o contabilización directa (no reembolsables) */}
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">
            {gasto.reembolsable || linea ? "Cuenta de cobro" : "No reembolsable"}
          </p>
          {!gasto.reembolsable && !linea ? (
            <div className="space-y-1 text-xs text-slate-600">
              <p>Lo asume la bolsa: no va a cuenta de cobro. Con la factura queda legalizado y pasa a Contabilidad.</p>
              {gasto.documentoContable && (
                <p>
                  Contabilizado con documento <b>{gasto.documentoContable}</b>
                  {gasto.fechaContabilizacion && ` el ${formatoFecha(gasto.fechaContabilizacion)}`}
                  {gasto.contabilizador && ` por ${gasto.contabilizador.nombreUsuario}`}
                </p>
              )}
            </div>
          ) : linea ? (
            <div className="flex flex-wrap items-center gap-3 text-xs">
              {rutaCuentas
                ? <Link href={`${rutaCuentas}/${linea.cuentaCobro.id}`} className="font-semibold text-emerald-700 hover:underline">{linea.cuentaCobro.numeroCuentaCobro}</Link>
                : <b>{linea.cuentaCobro.numeroCuentaCobro}</b>}
              <EstadoGasto codigo={linea.cuentaCobro.estado.codigo} nombre={linea.cuentaCobro.estado.nombre} />
              <span className="text-slate-500">legaliza {formatoMoneda(linea.valorLegalizado)}</span>
            </div>
          ) : (
            <p className="text-xs text-slate-400">Aún no está en una cuenta de cobro.</p>
          )}
          {gasto.observacionLegalizacion && (
            <p className="mt-2 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{gasto.observacionLegalizacion}</p>
          )}
        </div>
      </div>
    </Seccion>
  )
}
