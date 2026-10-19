import Link from "next/link"
import { ArrowLeft, Pencil } from "lucide-react"
import { requiereAcceso } from "@/src/auth/dal"
import { ROLES, tieneAcceso } from "@/src/auth/permisos"
import ListaDocumentos from "@/components/gastos/ListaDocumentos"
import SeccionLegalizacionGasto from "@/components/legalizacion/SeccionLegalizacionGasto"
import { obtenerCatalogos, obtenerGasto, obtenerTasas } from "@/src/lib/datosGastos"
import { formatoFecha, formatoFechaHora, formatoMoneda, formatoPorcentaje } from "@/src/lib/formato"
import EstadoGasto from "@/components/gastos/EstadoGasto"
import AnularGasto from "@/components/gastos/AnularGasto"
import DocumentosGasto from "@/components/gastos/DocumentosGasto"
import LineaTiempo from "@/components/gastos/LineaTiempo"
import Seccion from "@/components/ui/Seccion"
import Dato from "@/components/ui/Dato"
import { claseBotonSecundario } from "@/components/ui/estilos"

export default async function DetalleGastoPage({ params }: { params: { id: string } }) {
  const sesion = await requiereAcceso([])

  const [gasto, catalogos, tasas] = await Promise.all([
    obtenerGasto(Number(params.id)),
    obtenerCatalogos(),
    obtenerTasas()
  ])

  const pagado = gasto.valorRealmentePagado !== null
  // Los gastos de caja menor no pasan por Legalización: los legaliza Tesorería en la caja
  const deCaja = gasto.formaPago.codigo === "CAJA_MENOR"
  const esTesoreria = tieneAcceso(sesion.roles, [ROLES.TESORERIA])

  return (
    <div className="space-y-6">

      {/* ENCABEZADO */}
      <div>
        <Link href="/solicitudes" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
          <ArrowLeft size={14} />
          Volver a gastos
        </Link>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-slate-800">{gasto.codigo}</h1>
              <EstadoGasto codigo={gasto.estado.codigo} nombre={gasto.estado.nombre} />
            </div>
            <p className="mt-1 text-sm text-slate-500">{gasto.conceptoPago}</p>
            <p className="mt-1 text-xs text-slate-400">
              Creado por {gasto.creador?.nombreUsuario} el {formatoFechaHora(gasto.createdAt)}
            </p>
          </div>

          <div className="flex gap-3">
            {gasto.permisos.editar && (
              <Link href={`/solicitudes/${gasto.id}/editar`} className={claseBotonSecundario}>
                <Pencil size={15} />
                Editar
              </Link>
            )}
            {gasto.permisos.anular && <AnularGasto gastoId={gasto.id} codigo={gasto.codigo} />}
          </div>
        </div>

        {gasto.motivoAnulacion && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
            <span className="font-semibold">Motivo de anulación:</span> {gasto.motivoAnulacion}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">

        {/* COLUMNA PRINCIPAL */}
        <div className="space-y-6 lg:col-span-2">

          <Seccion titulo="Datos del gasto">
            <dl className="grid gap-5 sm:grid-cols-3">
              <Dato etiqueta="Operación" valor={gasto.operacion.nombreOperacion} />
              <Dato etiqueta="Bolsa" valor={gasto.bolsa?.nombre} />
              <Dato etiqueta="Tipo de gasto" valor={gasto.tipoGasto.nombre} />
              <Dato etiqueta="Forma de pago" valor={gasto.formaPago.nombre} />
              <Dato etiqueta="Trámite" valor={gasto.solicitudTramiteId && `#${gasto.solicitudTramiteId}`} />
              <Dato etiqueta="Tramitador" valor={gasto.tramitador?.nombreTramitador} />
              <Dato etiqueta="Número de factura" valor={gasto.numeroFactura} />
              {gasto.placa && <Dato etiqueta="Placa" valor={gasto.placa} />}
              {gasto.transito && <Dato etiqueta="Tránsito" valor={gasto.transito} />}
              {gasto.matriculaInmobiliaria && <Dato etiqueta="Matrícula inmobiliaria" valor={gasto.matriculaInmobiliaria} />}
              <Dato etiqueta="Reembolsable" valor={gasto.reembolsable ? "Sí" : "No"} />
            </dl>
          </Seccion>

          <Seccion titulo="Cliente / banco">
            <dl className="grid gap-5 sm:grid-cols-4">
              <Dato etiqueta="Cliente" valor={gasto.nombreClienteBanco} />
              <Dato etiqueta="Identificación" valor={gasto.identificacionClienteBanco} />
              <Dato etiqueta="Contrato" valor={gasto.contrato} />
              <Dato etiqueta="Código BPR/FTF" valor={gasto.codigoBpr} />
            </dl>
          </Seccion>

          <Seccion titulo="Beneficiario">
            <dl className="grid gap-5 sm:grid-cols-3">
              <Dato etiqueta="Nombre" valor={gasto.beneficiario.nombre} />
              <Dato etiqueta="Identificación" valor={`${gasto.beneficiario.tipoIdentificacion} ${gasto.beneficiario.identificacion}`} />
              <Dato etiqueta="Correo" valor={gasto.beneficiario.correo} />
              <Dato etiqueta="Banco" valor={gasto.beneficiario.banco} />
              <Dato etiqueta="Tipo de cuenta" valor={gasto.beneficiario.tipoCuenta} />
              <Dato etiqueta="Número de cuenta" valor={gasto.beneficiario.numeroCuenta} />
            </dl>
          </Seccion>

          {gasto.observacion && (
            <Seccion titulo="Observación">
              <p className="text-xs leading-5 text-slate-600 whitespace-pre-line">{gasto.observacion}</p>
            </Seccion>
          )}

          <Seccion titulo="Documentos">
            <DocumentosGasto
              gastoId={gasto.id}
              documentos={gasto.documentos}
              tiposDocumento={catalogos.tiposDocumento}
              puedeSubir={gasto.permisos.subirDocumentos}
              usuarioId={sesion.id}
              esAdmin={sesion.roles.includes(ROLES.ADMIN)}
            />
          </Seccion>

          {deCaja && gasto.legalizacionCaja && (
            <Seccion titulo="Legalización en caja menor">
              <dl className="grid gap-5 sm:grid-cols-3">
                <Dato etiqueta="Factura" valor={`${gasto.legalizacionCaja.numeroFactura} · ${formatoFecha(gasto.legalizacionCaja.fechaFactura)}`} />
                <Dato etiqueta="Beneficiario" valor={`${gasto.legalizacionCaja.beneficiario} · ${gasto.legalizacionCaja.tipoIdentificacion} ${gasto.legalizacionCaja.identificacion}`} />
                <Dato etiqueta="Valor del soporte" valor={formatoMoneda(gasto.legalizacionCaja.valorSoporte)} />
                {(gasto.legalizacionCaja.placa || gasto.legalizacionCaja.matriculaInmobiliaria) && (
                  <Dato etiqueta={gasto.legalizacionCaja.placa ? "Placa" : "Matrícula inmobiliaria"} valor={gasto.legalizacionCaja.placa ?? gasto.legalizacionCaja.matriculaInmobiliaria} />
                )}
                <Dato etiqueta="Legalizó" valor={gasto.legalizacionCaja.quienLegaliza} />
                {Number(gasto.legalizacionCaja.diferencia) !== 0 && (
                  <Dato
                    etiqueta="Diferencia con lo entregado"
                    valor={Number(gasto.legalizacionCaja.diferencia) < 0
                      ? `Devolvió ${formatoMoneda(-Number(gasto.legalizacionCaja.diferencia))} a la caja`
                      : `La caja pagó ${formatoMoneda(gasto.legalizacionCaja.diferencia)} más`}
                  />
                )}
                <Dato etiqueta="Registró" valor={`${gasto.legalizacionCaja.registrador?.nombreUsuario ?? ""} · ${formatoFechaHora(gasto.legalizacionCaja.createdAt)}`} />
                {gasto.legalizacionCaja.reembolso && (
                  <Dato etiqueta="Reembolso" valor={gasto.legalizacionCaja.reembolso.codigo} />
                )}
                {gasto.legalizacionCaja.observacion && <Dato etiqueta="Observación" valor={gasto.legalizacionCaja.observacion} />}
              </dl>
            </Seccion>
          )}

          {pagado && !deCaja && (
            <SeccionLegalizacionGasto
              gasto={gasto}
              esLegalizacion={tieneAcceso(sesion.roles, [ROLES.LEGALIZACION])}
              rutaCuentas={
                tieneAcceso(sesion.roles, [ROLES.LEGALIZACION]) ? "/legalizacion/cuentas"
                  : tieneAcceso(sesion.roles, [ROLES.TESORERIA]) ? "/tesoreria/cuentas"
                    : null
              }
              tasas={tasas}
              tipoDocumentoFacturaId={catalogos.tiposDocumento.find(t => t.codigo === "FACTURA")?.id ?? null}
            />
          )}
        </div>

        {/* COLUMNA LATERAL */}
        <div className="space-y-6">

          <Seccion titulo="Valores">
            <dl className="space-y-4">
              <Dato etiqueta="Valor solicitado" valor={<span className="text-base font-semibold text-slate-800">{formatoMoneda(gasto.valorSolicitadoPago)}</span>} />
              {pagado && <Dato etiqueta="Valor pagado" valor={formatoMoneda(gasto.valorRealmentePagado)} />}
              {gasto.factura && <Dato etiqueta="Valor de la factura" valor={formatoMoneda(gasto.factura.valorFactura)} />}
            </dl>

            {/* Retención: solo gastos de inmueble */}
            {gasto.retencionBase !== null && gasto.retencionBase !== undefined && (
              <dl className="mt-4 space-y-4 border-t border-slate-100 pt-4">
                <Dato etiqueta="Base de retención" valor={formatoMoneda(gasto.retencionBase)} />
                <Dato etiqueta={`Retención (${formatoPorcentaje(gasto.retencionPorcentaje ?? 0)})`} valor={formatoMoneda(gasto.retencionValor)} />
                <Dato etiqueta="Total a pagar (base − retención)" valor={formatoMoneda(gasto.retencionTotalPagar)} />
              </dl>
            )}
          </Seccion>

          {gasto.anticipo && (
            <Seccion titulo="Anticipo del cliente">
              <dl className="space-y-4">
                <Dato
                  etiqueta="Anticipo"
                  valor={gasto.permisos.soloLectura
                    ? gasto.anticipo.codigo
                    : <Link href={`/anticipos/${gasto.anticipo.id}`} className="font-semibold text-emerald-700 hover:underline">{gasto.anticipo.codigo}</Link>}
                />
                <Dato etiqueta="Cliente" valor={`${gasto.anticipo.cliente.nombre} · ${gasto.anticipo.cliente.identificacion}`} />
                <Dato etiqueta="Recibo de caja" valor={gasto.anticipo.reciboCaja} />
                {gasto.saldoAnticipo && (
                  <>
                    <Dato etiqueta="Saldo del cliente" valor={formatoMoneda(gasto.saldoAnticipo.saldo)} />
                    <Dato etiqueta="Gastos por pagar del cliente" valor={formatoMoneda(gasto.saldoAnticipo.comprometido)} />
                    <Dato
                      etiqueta="Disponible"
                      valor={<span className={gasto.saldoAnticipo.disponible < 0 ? "font-semibold text-red-600" : "font-semibold text-emerald-700"}>{formatoMoneda(gasto.saldoAnticipo.disponible)}</span>}
                    />
                  </>
                )}
              </dl>
              {gasto.saldoAnticipo && gasto.saldoAnticipo.disponible < 0 && (
                <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                  Los gastos del cliente superan lo que pagó: faltan {formatoMoneda(-gasto.saldoAnticipo.disponible)}.
                </p>
              )}
            </Seccion>
          )}

          <Seccion titulo="Pago (Tesorería)">
            {pagado ? (
              <dl className="space-y-4">
                <Dato etiqueta="Valor pagado" valor={formatoMoneda(gasto.valorRealmentePagado)} />
                <Dato etiqueta="Fecha de pago" valor={formatoFecha(gasto.fechaPago)} />
                <Dato etiqueta="Número de egreso" valor={gasto.numeroEgreso ?? <span className="text-slate-400">Pendiente (Contabilidad)</span>} />
                <Dato
                  etiqueta="Lote de pago"
                  valor={gasto.lotePagoId && (esTesoreria
                    ? <Link href={`/tesoreria/lotes/${gasto.lotePagoId}`} className="text-emerald-700 hover:underline">#{gasto.lotePagoId}</Link>
                    : `#${gasto.lotePagoId}`)}
                />
                {!gasto.permisos.soloLectura && (
                  <div>
                    <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">Soporte de pago</p>
                    <ListaDocumentos documentos={gasto.documentosPago} vacio="Sin soporte cargado." />
                  </div>
                )}
              </dl>
            ) : (
              <p className="text-xs text-slate-400">Pendiente de pago.</p>
            )}
          </Seccion>

          <Seccion titulo="Historial">
            <LineaTiempo eventos={gasto.trazabilidad} />
          </Seccion>
        </div>

      </div>
    </div>
  )
}
