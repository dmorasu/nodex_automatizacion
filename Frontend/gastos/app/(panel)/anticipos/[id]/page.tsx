import Link from "next/link"
import clsx from "clsx"
import { AlertTriangle, ArrowLeft } from "lucide-react"
import { requiereAcceso } from "@/src/auth/dal"
import { ROLES } from "@/src/auth/permisos"
import { obtenerAnticipo } from "@/src/lib/datosAnticipos"
import { formatoFecha, formatoFechaHora, formatoMoneda } from "@/src/lib/formato"
import { esDocumentoFactura, TIPOS_ANTICIPO } from "@/src/schemas/gastos"
import AccionesAnticipo from "@/components/anticipos/AccionesAnticipo"
import EstadoAnticipo from "@/components/anticipos/EstadoAnticipo"
import SoportesAnticipo from "@/components/anticipos/SoportesAnticipo"
import EstadoGasto from "@/components/gastos/EstadoGasto"
import ListaDocumentos from "@/components/gastos/ListaDocumentos"
import Seccion from "@/components/ui/Seccion"
import Dato from "@/components/ui/Dato"

export default async function DetalleAnticipoPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const sesion = await requiereAcceso([])
  const anticipo = await obtenerAnticipo(Number(params.id))
  const saldo = anticipo.saldoCliente
  const diferencia = anticipo.valorRecibido !== null ? Number(anticipo.valorRecibido) - Number(anticipo.valorConsignado) : 0
  // Solicitud de factura: Contabilidad confirma el pago y factura en un solo paso; no genera gastos
  const esFactura = anticipo.clase === "FACTURA"
  const recibido = anticipo.estado === "CONFIRMADO" || anticipo.estado === "FACTURADO"
  const factura = anticipo.documentos.filter(esDocumentoFactura)

  return (
    <div className="space-y-6">

      <div>
        <Link href="/anticipos" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
          <ArrowLeft size={14} />
          Volver a anticipos
        </Link>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-slate-800">{anticipo.codigo}</h1>
              <EstadoAnticipo estado={anticipo.estado} />
            </div>
            {esFactura && <p className="mt-1 text-xs font-semibold text-sky-700">Solicitud de factura</p>}
            <p className="mt-1 text-sm text-slate-500">{anticipo.concepto}</p>
            <p className="mt-1 text-xs text-slate-400">
              Registrado por {anticipo.creador?.nombreUsuario} el {formatoFechaHora(anticipo.createdAt)}
            </p>
          </div>
          <AccionesAnticipo anticipo={anticipo} />
        </div>

        {anticipo.estado === "NOVEDAD" && anticipo.motivoNovedad && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
            <span className="font-semibold">Novedad de Contabilidad:</span> {anticipo.motivoNovedad}
            {anticipo.permisos.editar && (
              <span className="block text-red-600/80">
                {esFactura ? "Corríjala para que Contabilidad la revise de nuevo." : "Corríjalo para que Contabilidad lo revise de nuevo."}
              </span>
            )}
          </div>
        )}
        {anticipo.motivoAnulacion && (
          <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            <span className="font-semibold">Motivo de anulación:</span> {anticipo.motivoAnulacion}
          </div>
        )}
        {anticipo.permisos.crearGasto && anticipo.gastos.length === 0 && (
          <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
            Contabilidad confirmó el pago. Use <b>Crear gasto</b> para convertirlo en gasto: los datos del anticipo se cargan solos.
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">

          <Seccion titulo={esFactura ? "Datos de la solicitud" : "Datos del anticipo"}>
            <dl className="grid gap-5 sm:grid-cols-3">
              <Dato etiqueta="Tipo" valor={TIPOS_ANTICIPO[anticipo.tipo] ?? anticipo.tipo} />
              <Dato etiqueta={anticipo.placa ? "Placa" : "Matrícula inmobiliaria"} valor={anticipo.placa ?? anticipo.matriculaInmobiliaria} />
              <Dato etiqueta="Número de solicitud" valor={anticipo.codigo} />
              <Dato etiqueta="Operación" valor={anticipo.operacion.nombreOperacion} />
              <Dato etiqueta="Bolsa" valor={anticipo.bolsa.nombre} />
              <Dato etiqueta="Cliente empresarial" valor={anticipo.clienteEmpresarial.nombre} />
            </dl>
          </Seccion>

          <Seccion titulo="Cliente del banco">
            <dl className="grid gap-5 sm:grid-cols-3">
              <Dato etiqueta="Nombre" valor={anticipo.cliente.nombre} />
              <Dato etiqueta="Identificación" valor={`${anticipo.cliente.tipoIdentificacion === "CC" ? "Cédula" : "NIT"} ${anticipo.cliente.identificacion}`} />
              <Dato etiqueta="Teléfono" valor={anticipo.cliente.telefono} />
              <Dato etiqueta="Dirección" valor={anticipo.cliente.direccion} />
            </dl>
          </Seccion>

          {anticipo.observacion && (
            <Seccion titulo="Observación">
              <p className="text-xs leading-5 text-slate-600 whitespace-pre-line">{anticipo.observacion}</p>
            </Seccion>
          )}

          {esFactura && anticipo.estado === "FACTURADO" && (
            <Seccion titulo={`Factura ${anticipo.numeroFactura ?? ""}`}>
              <ListaDocumentos documentos={factura} vacio="Sin archivos de la factura." />
            </Seccion>
          )}

          <Seccion titulo="Soporte de la consignación">
            <SoportesAnticipo anticipo={anticipo} usuarioId={sesion.id} esAdmin={sesion.roles.includes(ROLES.ADMIN)} />
          </Seccion>

          {anticipo.estado === "CONFIRMADO" && (
            <Seccion titulo="Gastos creados del anticipo">
              {anticipo.gastos.length === 0 ? (
                <p className="py-4 text-center text-xs text-slate-400">Aún no se ha creado ningún gasto.</p>
              ) : (
                <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
                  {anticipo.gastos.map(gasto => (
                    <li key={gasto.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs">
                      <div>
                        <Link href={`/solicitudes/${gasto.id}`} className="font-semibold text-emerald-700 hover:underline">{gasto.codigo}</Link>
                        <p className="text-slate-500">{gasto.conceptoPago}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <EstadoGasto codigo={gasto.estado.codigo} nombre={gasto.estado.nombre} />
                        <b className="text-slate-800">{formatoMoneda(gasto.valorRealmentePagado ?? gasto.valorProgramado ?? gasto.valorSolicitadoPago)}</b>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Seccion>
          )}
        </div>

        <div className="space-y-6">
          <Seccion titulo="Valores">
            <dl className="space-y-4">
              <Dato etiqueta="Valor consignado (pagado)" valor={<span className="text-base font-semibold text-slate-800">{formatoMoneda(anticipo.valorConsignado)}</span>} />
              <Dato etiqueta="Fecha de consignación" valor={formatoFecha(anticipo.fechaConsignacion)} />
            </dl>
          </Seccion>

          <Seccion titulo="Contabilidad">
            {recibido ? (
              <dl className="space-y-4">
                <Dato etiqueta="Valor real ingresado" valor={<span className="text-base font-semibold text-slate-800">{formatoMoneda(anticipo.valorRecibido)}</span>} />
                {diferencia !== 0 && (
                  <p className={clsx("rounded-md px-3 py-2 text-xs", diferencia < 0 ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800")}>
                    Diferencia con lo consignado: {diferencia > 0 && "+"}{formatoMoneda(diferencia)}
                  </p>
                )}
                {esFactura ? (
                  <Dato etiqueta="Factura" valor={anticipo.numeroFactura} />
                ) : (
                  <Dato etiqueta="Recibo de caja" valor={anticipo.reciboCaja} />
                )}
                <Dato etiqueta={esFactura ? "Facturado por" : "Confirmado por"} valor={anticipo.confirmador && `${anticipo.confirmador.nombreUsuario} · ${formatoFechaHora(anticipo.fechaConfirmacion!)}`} />
                {anticipo.observacionContabilidad && <Dato etiqueta="Observación" valor={anticipo.observacionContabilidad} />}
              </dl>
            ) : (
              <p className="text-xs text-slate-400">
                {anticipo.estado === "POR_CONFIRMAR"
                  ? esFactura ? "Pendiente: Contabilidad debe confirmar el pago y hacer la factura." : "Pendiente: Contabilidad debe verificar que el dinero entró."
                  : anticipo.estado === "NOVEDAD" ? "Devuelto con novedad al creador." : "Anulado."}
              </p>
            )}
          </Seccion>

          {saldo && (
            <Seccion titulo="Saldo del cliente" descripcion={`En la bolsa ${anticipo.bolsa.nombre}, sumando todos sus ${esFactura ? "pagos facturados" : "anticipos"}`}>
              <dl className="space-y-3">
                <Dato etiqueta={esFactura ? "Pagó (solicitudes facturadas)" : "Pagó (anticipos confirmados)"} valor={formatoMoneda(saldo.ingresado)} />
                {!esFactura && <Dato etiqueta="Gastos pagados" valor={formatoMoneda(saldo.pagado)} />}
                {saldo.otros !== 0 && <Dato etiqueta="Reintegros y ajustes" valor={formatoMoneda(saldo.otros)} />}
                <Dato etiqueta="Saldo" valor={<b>{formatoMoneda(saldo.saldo)}</b>} />
                {/* Las solicitudes de factura no generan gastos: no hay nada por pagar */}
                {!esFactura && (
                  <>
                    <Dato etiqueta="Gastos por pagar" valor={formatoMoneda(saldo.comprometido)} />
                    <Dato
                      etiqueta="Disponible"
                      valor={<span className={clsx("text-base font-semibold", saldo.disponible < 0 ? "text-red-600" : "text-emerald-700")}>{formatoMoneda(saldo.disponible)}</span>}
                    />
                  </>
                )}
              </dl>
              {saldo.disponible < 0 && (
                <p className="mt-3 flex gap-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  Los gastos del cliente superan lo que pagó: faltan {formatoMoneda(-saldo.disponible)}.
                </p>
              )}
            </Seccion>
          )}

          <Seccion titulo="Historial">
            <ol className="relative ml-2 border-l border-slate-200">
              {anticipo.trazabilidad.map(evento => (
                <li key={evento.id} className="mb-6 ml-5 last:mb-0">
                  <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
                  <div className="flex flex-wrap items-center gap-2">
                    <EstadoAnticipo estado={evento.estadoNuevo} />
                    <span className="text-[11px] text-slate-400">{formatoFechaHora(evento.createdAt)} · {evento.usuario?.nombreUsuario}</span>
                  </div>
                  {evento.observacion && <p className="mt-1.5 text-xs text-slate-600">{evento.observacion}</p>}
                </li>
              ))}
            </ol>
          </Seccion>
        </div>
      </div>
    </div>
  )
}
