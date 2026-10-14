import AddCuentaCobroBoton from '@/components/cuentacobro/AddCuentaCobroBoton';
import AddEstadosBoton from '@/components/estados/AddEstadosBoton';
import AddLogisticatoBoton from '@/components/logistica/AddLogistica';
import AddProgramacionBoton from '@/components/programacion/AddProgramacionBoton';
import AddTrazabilidadBoton from '@/components/trazabilidad/AddTrazabilitadBoton';
import AddTramitadorBoton from '@/components/tramitador/AddTramitadorBoton';
import AddSubEstadoBoton from '@/components/subEstados/AddSubEstadosBoton';

import { ArrowLeft, Pencil, Radar } from "lucide-react";
import dynamic from "next/dynamic";
import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { SolicitudAPIRespuestaSchema } from '@/src/schemas';
import { verificacionSesion } from '@/src/auth/dal';
import { obtenerGastosDeTramite, obtenerOpcionesGasto } from '@/src/gastos/datosGastos';
import { obtenerSeguimiento } from '@/src/seguimientoTramitador';
import { obtenerHistorial } from '@/src/historialTramite';
import { formatoFechaFinaizacion, formatoFechaSinZona, formatoMoneda } from '@/src/ultis';

import DetalleSolicitudTabs from '@/components/solicitudTramites/DetalleSolicitudTabs';
import EstadoTramite from '@/components/solicitudTramites/EstadoTramite';
import CrearGastoTramite from '@/components/gastos/CrearGastoTramite';
import CambiarAnalista from '@/components/analistas/CambiarAnalista';
import Seccion from '@/components/ui/Seccion';
import Dato from '@/components/ui/Dato';
import UbicacionTramite from '@/components/rutas/UbicacionTramite';
import SubsanarNovedad from '@/components/estados/SubsanarNovedad';


const ModalContainer = dynamic(
  () => import('@/components/ui/ModalContainer'),
  { ssr: false }
);


export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const { token } = await verificacionSesion();

  const res = await fetch(`${process.env.API_URL}/solicitudTramites/${params.id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store'
  });

  if (!res.ok) return { title: "Solicitud no encontrada" };

  const solicitud = SolicitudAPIRespuestaSchema.parse(await res.json());
  return { title: `Nodex - ${solicitud.id}`, description: solicitud.detalleSolicitud };
}


const claseBotonEnlace = "group flex items-center gap-2.5 h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 text-xs font-medium whitespace-nowrap transition hover:bg-slate-100 hover:border-slate-300 hover:text-slate-700"


export default async function DetalleSolicitudTramite({ params }: { params: { id: string } }) {

  const solicitudTramiteId = params.id;

  // Con la sesión: el backend responde 404 si Gestión de activos abre un trámite ajeno
  const { token, perfil, usuario } = await verificacionSesion();
  const esGestionActivos = perfil === 'GESTION_ACTIVOS';

  const req = await fetch(`${process.env.API_URL}/solicitudTramites/${solicitudTramiteId}`, {
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (req.status === 404) notFound();

  const json = await req.json();
  const solicitudTramite = SolicitudAPIRespuestaSchema.parse(json);

  // Gastos del trámite (Nodex Gastos) y, para Gestión de activos, opciones para crear uno
  // y lo que reporta el tramitador desde su app
  const [gastos, opcionesGasto, seguimiento, historial] = await Promise.all([
    obtenerGastosDeTramite(solicitudTramite.id, token),
    esGestionActivos ? obtenerOpcionesGasto(token) : Promise.resolve(null),
    obtenerSeguimiento(solicitudTramite.id),
    obtenerHistorial(solicitudTramite.id)
  ]);

  const botonCrearGasto = opcionesGasto && (
    <CrearGastoTramite
      tramite={{
        id: solicitudTramite.id,
        operacionId: Number((json as { operacionesId?: number }).operacionesId) || null,
        placa: solicitudTramite.placa,
        matriculaInmobiliaria: solicitudTramite.matriculaInmobiliaria
      }}
      opciones={opcionesGasto}
    />
  );

  // Historial de estados, del más reciente al más antiguo. El estado actual es el de la
  // solicitud; si no lo tiene (trámites viejos), el último del historial.
  const historialEstados = [...(solicitudTramite.estadosTramites ?? [])]
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  const estadoActual = solicitudTramite.estadoActual?.nombreEstado ?? historialEstados[0]?.estado.nombreEstado ?? null;
  const ultimoCambio = historialEstados[0]?.createdAt ?? null;

  // Quien creó el trámite lo puede marcar como subsanado cuando está en espera por novedad
  const novedadActual = historialEstados[0]?.estado.nombreEstado === "En espera por novedad" ? historialEstados[0] : null;
  const botonSubsanar = estadoActual === "En espera por novedad" && solicitudTramite.usuario?.id === usuario.id && (
    <SubsanarNovedad solicitudTramiteId={solicitudTramite.id} novedad={novedadActual?.tipoRechazo?.nombre ?? null} />
  );

  const programacion = solicitudTramite.programacion;
  const logistica = solicitudTramite.logistica;

  return (

    <div className="space-y-6 pt-2">

      {/* ================================================= */}
      {/* ENCABEZADO                                        */}
      {/* ================================================= */}

      <div>
        <Link href="/center/dashboard" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
          <ArrowLeft size={14} />
          Volver a trámites
        </Link>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-semibold text-slate-800">Trámite #{solicitudTramite.id}</h1>
              <EstadoTramite nombre={estadoActual} grande />
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {solicitudTramite.tramite?.nombreTramite ?? "Sin tipo de trámite"}
              {solicitudTramite.clientes?.nombreCliente && ` · ${solicitudTramite.clientes.nombreCliente}`}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Creado por {solicitudTramite.usuario?.nombreUsuario ?? "—"} el {formatoFechaFinaizacion(solicitudTramite.createdAt)}
            </p>
          </div>

          {/* ACCIONES */}
          <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3 lg:w-auto xl:grid-cols-4">
            {esGestionActivos ? (
              <>
                <Link
                  href={`/center/solicitudTramites/${solicitudTramite.id}/edit`}
                  className="flex items-center justify-center gap-2 h-10 px-3 rounded-lg bg-sky-500 text-white text-xs font-semibold transition hover:bg-sky-600"
                >
                  <Pencil size={15} />
                  Editar trámite
                </Link>
                {botonCrearGasto}
              </>
            ) : (
              <>
                <AddEstadosBoton />
                <AddTramitadorBoton />
                <AddProgramacionBoton />
                <AddLogisticatoBoton />
                {botonSubsanar}
                <AddSubEstadoBoton />
                <AddCuentaCobroBoton />
                <AddTrazabilidadBoton />
                <Link href="/center/torreControl" className={claseBotonEnlace}>
                {botonSubsanar}
                  <Radar size={16} className="text-emerald-500" />
                  Tablero de gestión
                </Link>
              </>
            )}
          </div>
        </div>
      </div>


      <div className="grid gap-6 lg:grid-cols-3">

        {/* ================================================= */}
        {/* COLUMNA PRINCIPAL                                 */}
        {/* ================================================= */}

        <div className="min-w-0 lg:col-span-2">
          <DetalleSolicitudTabs
            solicitudTramite={solicitudTramite}
            solicitudTramiteId={Number(solicitudTramiteId)}
            // Documentos y WhatsApp llaman desde el navegador: pasan por el proxy con la sesión
            apiUrl="/api/backend"
            gastos={gastos}
            urlGastos={process.env.GASTOS_URL ?? null}
            accionGasto={botonCrearGasto}
            seguimiento={seguimiento}
            historial={historial}
          />
        </div>


        {/* ================================================= */}
        {/* COLUMNA LATERAL                                   */}
        {/* ================================================= */}

        <div className="space-y-6">

          <Seccion titulo="Estado">
            <div className="flex flex-wrap items-center gap-2">
              <EstadoTramite nombre={estadoActual} grande />
              {ultimoCambio && <span className="text-[11px] text-slate-400">desde {formatoFechaFinaizacion(ultimoCambio)}</span>}
            </div>

            {historialEstados.length > 0 && (
              <div className="mt-5 border-t border-slate-100 pt-4">
                <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-slate-400">Historial de estados</p>
                <ol className="relative space-y-3 border-l border-slate-200 pl-4">
                  {historialEstados.map((registro, i) => (
                    <li key={registro.id} className="relative">
                      <span
                        className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white ring-1 ${i === 0 ? "bg-sky-500 ring-sky-200" : "bg-slate-300 ring-slate-200"}`}
                        aria-hidden="true"
                      />
                      <p className={`text-xs ${i === 0 ? "font-semibold text-slate-700" : "text-slate-600"}`}>{registro.estado.nombreEstado}</p>
                      {registro.tipoRechazo?.nombre && <p className="text-[11px] text-amber-700">{registro.tipoRechazo.nombre}</p>}
                      {registro.createdAt && <p className="text-[11px] text-slate-400">{formatoFechaFinaizacion(registro.createdAt)}</p>}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </Seccion>

          <Seccion titulo="Asignación">
            <dl className="space-y-4">
              <Dato
                etiqueta="Analista"
                valor={
                  <CambiarAnalista
                    solicitudId={solicitudTramite.id}
                    analistaId={solicitudTramite.analistaAsignado ?? null}
                    nombreAnalista={solicitudTramite.nombreAnalista ?? null}
                  />
                }
              />
              <Dato etiqueta="Tramitador" valor={solicitudTramite.tramitador?.nombreTramitador?.trim() || <span className="text-slate-400">Sin tramitador</span>} />
              <Dato etiqueta="Solicitante" valor={solicitudTramite.usuario?.nombreUsuario} />
            </dl>
          </Seccion>

          <Seccion titulo="Programación">
            <dl className="space-y-4">
              <Dato etiqueta="Fecha de diligencia" valor={programacion?.fechaProbableEntrega ? formatoFechaSinZona(programacion.fechaProbableEntrega) : null} />
              <Dato etiqueta="Entrega del resultado" valor={solicitudTramite.fechaEntregaResultado ? formatoFechaSinZona(solicitudTramite.fechaEntregaResultado) : null} />
              <Dato etiqueta="Finalización del servicio" valor={programacion?.fechaFinalizacionServicio ? formatoFechaFinaizacion(programacion.fechaFinalizacionServicio) : null} />
              <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                <Dato etiqueta="Valor trámite" valor={<span className="text-sm font-semibold text-slate-800">{formatoMoneda(programacion?.valorTramite)}</span>} />
                <Dato etiqueta="Viáticos" valor={formatoMoneda(programacion?.valorViaticos)} />
              </div>
            </dl>
          </Seccion>

          <Seccion titulo="Ubicación" descripcion="Para las rutas de mensajeros">
            <UbicacionTramite
              tramiteId={solicitudTramite.id}
              direccion={[solicitudTramite.direccionTramite, solicitudTramite.municipios?.nombreMunicipio].filter(Boolean).join(", ") || null}
              latitud={(json as { latitud?: number | null }).latitud ?? null}
              longitud={(json as { longitud?: number | null }).longitud ?? null}
              precisa={(json as { ubicacionPrecisa?: boolean | null }).ubicacionPrecisa ?? null}
              fuente={(json as { ubicacionFuente?: string | null }).ubicacionFuente ?? null}
              puedeEditar={!esGestionActivos}
            />
          </Seccion>

          {logistica && (
            <Seccion titulo="Logística">
              <dl className="space-y-4">
                <Dato etiqueta="Número de guía" valor={logistica.numeroGuia} />
                <Dato etiqueta="Destinatario" valor={logistica.destinatario} />
                <Dato etiqueta="Programación" valor={logistica.fechaProgramacionLogistica ? formatoFechaSinZona(logistica.fechaProgramacionLogistica) : null} />
                <Dato etiqueta="Entrega a transportadora" valor={logistica.fechaEntregaTransportadora ? formatoFechaSinZona(logistica.fechaEntregaTransportadora) : null} />
              </dl>
            </Seccion>
          )}
        </div>

      </div>


      {/* ================================================= */}
      {/* MODAL                                             */}
      {/* ================================================= */}

      <ModalContainer solicitudTramite={solicitudTramite} />

    </div>

  );

}
