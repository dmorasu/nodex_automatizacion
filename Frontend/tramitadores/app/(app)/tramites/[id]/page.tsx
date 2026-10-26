import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, CircleCheckBig, FileText, Image as ImageIcon, Phone, Undo2 } from "lucide-react"
import { obtenerDatos } from "@/src/lib/api"
import { formatoFecha, formatoFechaHora, formatoHoraCita } from "@/src/lib/formato"
import { DetalleTramiteSchema } from "@/src/schemas"
import Comentarios from "@/components/tramites/Comentarios"
import ReportarRealizado from "@/components/tramites/ReportarRealizado"
import SubirDocumentos from "@/components/tramites/SubirDocumentos"
import GastosDelTramite from "@/components/tramites/GastosDelTramite"
import { nombreTipoDocumento } from "@/src/tiposDocumento"
import Etiqueta, { tonoEstadoTramite } from "@/components/ui/Etiqueta"
import Seccion, { Dato } from "@/components/ui/Seccion"

const ESTADOS_CERRADOS = ["Finalizado", "Desistido"]

export default async function DetalleTramitePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const datos = await obtenerDatos(`/tramites/${Number(params.id)}`, DetalleTramiteSchema)
  if (!datos) notFound()

  const { tramite, comentarios, reportes, gastos } = datos
  const estado = tramite.estadoActual?.nombreEstado ?? "Sin Iniciar"
  const cerrado = ESTADOS_CERRADOS.includes(estado)
  const reportePendiente = reportes.find(r => r.estado === "PENDIENTE")
  // Los reportes vienen del más reciente al más antiguo: si el último se devolvió, se muestra el motivo
  const devuelto = !reportePendiente && reportes[0]?.estado === "DEVUELTO" ? reportes[0] : null
  const programacion = tramite.programacion
  const telefonos = [tramite.clientes?.telefonoMovil, tramite.clientes?.telefono].filter(Boolean) as string[]

  // Historial: estados, subestados y trazabilidad en una sola línea de tiempo
  const historial = [
    ...tramite.estadosTramites.map(e => ({ clave: `e${e.id}`, fecha: e.createdAt, titulo: `Estado: ${e.estado?.nombreEstado ?? "—"}`, texto: null as string | null })),
    ...tramite.subEstadosSolicitud.map(s => ({ clave: `s${s.id}`, fecha: s.createdAt, titulo: s.subEstado?.nombre ?? "Subestado", texto: s.observacion ?? null })),
    ...tramite.trazabilidad.map(t => ({ clave: `t${t.id}`, fecha: t.createdAt, titulo: t.nombreUsuario ?? "Observación", texto: t.observacionTrazabilidad ?? null }))
  ].sort((a, b) => b.fecha.localeCompare(a.fecha))

  return (
    <div className="space-y-4">
      <Link href="/tramites" className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600">
        <ArrowLeft size={16} /> Mis trámites
      </Link>

      {/* ENCABEZADO */}
      <div>
        <p className="text-xs font-semibold text-indigo-600">Trámite N° {tramite.id}</p>
        <h1 className="text-xl font-semibold text-slate-800">{tramite.tramite?.nombreTramite ?? "Trámite"}</h1>
        {(tramite.placa || tramite.matriculaInmobiliaria) && (
          <p className="text-sm text-slate-600">{tramite.placa ?? `Matrícula ${tramite.matriculaInmobiliaria}`}</p>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <Etiqueta tono={tonoEstadoTramite(estado)}>{estado}</Etiqueta>
        </div>
      </div>

      {/* REPORTE DE REALIZADO */}
      {reportePendiente ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="flex items-center gap-2 font-semibold"><CircleCheckBig size={17} /> Reportado como realizado</p>
          <p className="mt-1 text-xs">Enviado el {formatoFechaHora(reportePendiente.fecha)}. El equipo lo está revisando.</p>
          <p className="mt-2 whitespace-pre-line text-xs text-amber-800">{reportePendiente.observacion}</p>
        </div>
      ) : !cerrado && (
        <>
          {devuelto && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              <p className="flex items-center gap-2 font-semibold"><Undo2 size={17} /> Trámite devuelto</p>
              <p className="mt-1 text-xs">
                {devuelto.revisor ?? "El equipo"}{devuelto.fechaRevision && ` · ${formatoFechaHora(devuelto.fechaRevision)}`}
              </p>
              {devuelto.notaRevision && <p className="mt-2 whitespace-pre-line text-sm text-red-800">{devuelto.notaRevision}</p>}
              <p className="mt-2 text-xs text-red-700">Corrija lo indicado y vuelva a marcarlo como realizado.</p>
            </div>
          )}
          <ReportarRealizado tramiteId={tramite.id} />
        </>
      )}

      {/* GASTOS DEL TRÁMITE: la factura y la boleta de reintegro se suben aquí y llegan al gasto */}
      <GastosDelTramite tramiteId={tramite.id} gastos={gastos} />

      {/* DOCUMENTOS: los del equipo y los que sube el tramitador (se ven en Nodex Trámites) */}
      <Seccion titulo="Documentos del trámite">
        <SubirDocumentos tramiteId={tramite.id} gastos={gastos} />

        {tramite.documentos.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">Aún no hay documentos en este trámite.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {tramite.documentos.map(d => (
              <li key={d.id}>
                <a
                  href={`/documentos/${tramite.id}/${d.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 py-2.5 active:bg-slate-50"
                >
                  {d.tipoArchivo.startsWith("image/")
                    ? <ImageIcon size={18} className="shrink-0 text-indigo-400" />
                    : <FileText size={18} className="shrink-0 text-indigo-400" />}
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="min-w-0 truncate text-sm font-medium text-slate-700">{d.nombreOriginal}</span>
                      {d.tipoDocumento && (
                        <Etiqueta tono={d.tipoDocumento === "FACTURA" ? "ambar" : "indigo"}>
                          {nombreTipoDocumento(d.tipoDocumento)}
                        </Etiqueta>
                      )}
                    </span>
                    <span className="block text-[11px] text-slate-400">
                      {d.tramitadorId ? "Subido por usted" : `Del equipo${d.usuario ? ` · ${d.usuario.nombreUsuario}` : ""}`} · {formatoFechaHora(d.createdAt)}
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </Seccion>

      {/* DATOS DEL TRÁMITE */}
      <Seccion titulo="Datos del trámite">
        <dl className="divide-y divide-slate-100">
          <Dato etiqueta="Cliente">{tramite.clientes?.nombreCliente}</Dato>
          {telefonos.length > 0 && (
            <Dato etiqueta="Teléfono del cliente">
              <span className="flex flex-wrap gap-2">
                {telefonos.map(t => (
                  <a key={t} href={`tel:${t}`} className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700">
                    <Phone size={14} /> {t}
                  </a>
                ))}
              </span>
            </Dato>
          )}
          <Dato etiqueta="Detalle">{tramite.detalleSolicitud}</Dato>
          <Dato etiqueta="Descripción">{tramite.descripcionTramite}</Dato>
          <Dato etiqueta="Entidad">{tramite.entidad?.nombreEntidad}</Dato>
          <Dato etiqueta="Ciudad">{tramite.municipios && `${tramite.municipios.nombreMunicipio}${tramite.municipios.departamento ? `, ${tramite.municipios.departamento}` : ""}`}</Dato>
          <Dato etiqueta="Dirección">{tramite.direccionTramite}</Dato>
          <Dato etiqueta="Documentos aportados">{tramite.documentosAportados}</Dato>
          <Dato etiqueta="Operación">{tramite.operaciones?.nombreOperacion}</Dato>
        </dl>
      </Seccion>

      {/* PROGRAMACIÓN */}
      {(programacion || tramite.fechaEntregaResultado) && (
        <Seccion titulo="Fechas">
          <dl className="divide-y divide-slate-100">
            <Dato etiqueta="Diligencia">{programacion?.fechaRealizacionDiligencia && formatoFecha(programacion.fechaRealizacionDiligencia)}</Dato>
            <Dato etiqueta="Cita">
              {programacion?.requiereCita && (programacion.fechaCita ? `${formatoFecha(programacion.fechaCita)}${programacion.horaCita ? ` · ${formatoHoraCita(programacion.horaCita, programacion.horaFinCita)}` : ""}` : "Requiere cita (sin fecha)")}
            </Dato>
            <Dato etiqueta="Entrega probable">{programacion?.fechaProbableEntrega && formatoFecha(programacion.fechaProbableEntrega)}</Dato>
            <Dato etiqueta="Entrega del resultado">{tramite.fechaEntregaResultado && formatoFecha(tramite.fechaEntregaResultado)}</Dato>
          </dl>
        </Seccion>
      )}

      {/* LOGÍSTICA */}
      {tramite.logistica && (
        <Seccion titulo="Envío">
          <dl className="divide-y divide-slate-100">
            <Dato etiqueta="Transportadora">{tramite.logistica.transportadora?.nombreTransportadora}</Dato>
            <Dato etiqueta="Guía">{tramite.logistica.numeroGuia}</Dato>
            <Dato etiqueta="Destinatario">{tramite.logistica.destinatario}</Dato>
          </dl>
        </Seccion>
      )}

      {/* COMENTARIOS */}
      <Seccion titulo="Comentarios con el equipo">
        <Comentarios tramiteId={tramite.id} comentarios={comentarios} />
      </Seccion>

      {/* HISTORIAL */}
      <Seccion titulo="Historial">
        {historial.length === 0 ? (
          <p className="text-sm text-slate-400">Sin movimientos todavía.</p>
        ) : (
          <ol className="relative space-y-4 border-l border-slate-200 pl-4">
            {historial.map(h => (
              <li key={h.clave}>
                <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-indigo-400" aria-hidden="true" />
                <p className="text-[11px] text-slate-400">{formatoFechaHora(h.fecha)}</p>
                <p className="text-sm font-medium text-slate-700">{h.titulo}</p>
                {h.texto && <p className="whitespace-pre-line text-xs text-slate-500">{h.texto}</p>}
              </li>
            ))}
          </ol>
        )}
      </Seccion>
    </div>
  )
}
