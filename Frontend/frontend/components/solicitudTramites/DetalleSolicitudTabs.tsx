"use client";

import { useState } from "react";
import clsx from "clsx";
import {
  Info,
  FileText,
  History,
  MessageCircle,
  Wallet,
  HardHat,
  Clock,
  type LucideIcon,
} from "lucide-react";

import DocumentosSolicitud from "@/components/documentos/DocumentosSolicitud";
import SeguimientoTramitador from "@/components/tramitador/SeguimientoTramitador"
import type { Seguimiento } from "@/src/seguimientoTramitador"
import NotificacionesWhatsApp from "@/components/solicitudTramites/NotificacionesWhatsApp"
import GastosTramite from "@/components/gastos/GastosTramite"
import HistorialTramite from "@/components/solicitudTramites/HistorialTramite"
import type { EventoHistorial } from "@/src/historialTramite"
import type { GastoTramite } from "@/src/gastos/datosGastos"
import Seccion from "@/components/ui/Seccion"
import Dato from "@/components/ui/Dato"
import { formatoFechaFinaizacion } from "@/src/ultis";


// Lo que usan las pestañas del detalle (viene de GET /solicitudTramites/:id)
type RegistroTrazabilidad = { id: number, observacionTrazabilidad: string | null, nombreUsuario?: string | null, createdAt: string }
type SolicitudDetalle = {
  placa?: string | null
  matriculaInmobiliaria?: string | null
  detalleSolicitud?: string | null
  direccionTramite?: string | null
  documentosAportados?: string | null
  tramite?: { nombreTramite?: string | null } | null
  entidad?: { nombreEntidad?: string | null } | null
  operaciones?: { nombreOperacion?: string | null, centroDeCostos?: string | null } | null
  clientes?: { nombreCliente?: string | null, identificacionCliente?: string | null } | null
  municipios?: { nombreMunicipio?: string | null } | null
  tramitador?: { nombreTramitador?: string | null } | null
  trazabilidad?: RegistroTrazabilidad[]
}

interface Props {
  solicitudTramite: SolicitudDetalle;
  solicitudTramiteId: number;
  apiUrl: string;
  // Pestaña Gastos (Nodex Gastos)
  gastos: GastoTramite[];
  urlGastos: string | null;
  // Botón "Crear gasto" (solo Gestión de activos)
  accionGasto?: React.ReactNode;
  // Pestaña Tramitador (app Nodex Tramitadores)
  seguimiento: Seguimiento;
  // Pestaña Historial (línea de tiempo); null = no se pudo cargar
  historial: EventoHistorial[] | null;
}

type ClavePestana = "informacion" | "historial" | "documentos" | "gastos" | "trazabilidad" | "tramitador" | "whatsapp"


// Columna principal del detalle del trámite: información general y pestañas.
// Estado, asignación, fechas y valores van en la columna lateral (page.tsx).
export default function DetalleSolicitudTabs({
  solicitudTramite,
  solicitudTramiteId,
  apiUrl,
  gastos,
  urlGastos,
  accionGasto,
  seguimiento,
  historial,
}: Props) {

  const [tabActiva, setTabActiva] = useState<ClavePestana>("informacion");

  const reportePendiente = seguimiento.reportes.some(r => r.estado === "PENDIENTE");
  const trazabilidad = solicitudTramite.trazabilidad ?? [];

  const pestanas: { clave: ClavePestana, nombre: string, Icono: LucideIcon, insignia?: React.ReactNode }[] = [
    { clave: "informacion", nombre: "Información", Icono: Info },
    { clave: "historial", nombre: "Historial", Icono: Clock },
    { clave: "documentos", nombre: "Documentos", Icono: FileText },
    { clave: "gastos", nombre: "Gastos", Icono: Wallet, insignia: gastos.length > 0 && gastos.length },
    { clave: "trazabilidad", nombre: "Trazabilidad", Icono: History, insignia: trazabilidad.length > 0 && trazabilidad.length },
    {
      clave: "tramitador",
      nombre: "Tramitador",
      Icono: HardHat,
      insignia: reportePendiente ? "Realizado" : seguimiento.comentarios.length > 0 && seguimiento.comentarios.length
    },
    { clave: "whatsapp", nombre: "WhatsApp", Icono: MessageCircle },
  ];

  return (

    <div className="space-y-6">

      {/* PESTAÑAS */}
      <nav className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm" aria-label="Secciones del trámite">
        {pestanas.map(({ clave, nombre, Icono, insignia }) => (
          <button
            key={clave}
            type="button"
            onClick={() => setTabActiva(clave)}
            aria-current={tabActiva === clave ? "page" : undefined}
            className={clsx(
              "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition",
              tabActiva === clave ? "bg-sky-50 text-sky-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            )}
          >
            <Icono size={15} />
            {nombre}
            {insignia ? (
              <span className={clsx(
                "rounded-full px-1.5 py-px text-[10px]",
                insignia === "Realizado" ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-600"
              )}>
                {insignia}
              </span>
            ) : null}
          </button>
        ))}
      </nav>


      {/* INFORMACIÓN */}
      {tabActiva === "informacion" && (
        <>
          <Seccion titulo="Datos del trámite">
            <dl className="grid gap-5 sm:grid-cols-3">
              <Dato etiqueta="Tipo de trámite" valor={solicitudTramite.tramite?.nombreTramite} />
              <Dato etiqueta="Entidad" valor={solicitudTramite.entidad?.nombreEntidad} />
              <Dato etiqueta="Operación" valor={solicitudTramite.operaciones?.nombreOperacion} />
              <Dato etiqueta="Centro de costos" valor={solicitudTramite.operaciones?.centroDeCostos} />
              {solicitudTramite.placa && <Dato etiqueta="Placa" valor={solicitudTramite.placa} />}
              {solicitudTramite.matriculaInmobiliaria && <Dato etiqueta="Matrícula inmobiliaria" valor={solicitudTramite.matriculaInmobiliaria} />}
              {!solicitudTramite.placa && !solicitudTramite.matriculaInmobiliaria && <Dato etiqueta="Placa / matrícula" valor={null} />}
            </dl>

            {solicitudTramite.detalleSolicitud && (
              <div className="mt-5 border-t border-slate-100 pt-4">
                <Dato
                  etiqueta="Detalle"
                  valor={<span className="whitespace-pre-line leading-5">{solicitudTramite.detalleSolicitud}</span>}
                />
              </div>
            )}
          </Seccion>

          <Seccion titulo="Cliente y ubicación">
            <dl className="grid gap-5 sm:grid-cols-3">
              <Dato etiqueta="Cliente" valor={solicitudTramite.clientes?.nombreCliente} />
              <Dato etiqueta="Identificación" valor={solicitudTramite.clientes?.identificacionCliente} />
              <Dato etiqueta="Ciudad" valor={solicitudTramite.municipios?.nombreMunicipio} />
              <Dato etiqueta="Dirección" valor={solicitudTramite.direccionTramite} className="sm:col-span-3" />
            </dl>
          </Seccion>

          {solicitudTramite.documentosAportados && (
            <Seccion titulo="Documentos aportados">
              <p className="whitespace-pre-line text-xs leading-5 text-slate-600">{solicitudTramite.documentosAportados}</p>
            </Seccion>
          )}
        </>
      )}


      {/* HISTORIAL */}
      {tabActiva === "historial" && (
        <Seccion titulo="Historial">
          <HistorialTramite eventos={historial} />
        </Seccion>
      )}


      {/* DOCUMENTOS */}
      {tabActiva === "documentos" && (
        <Seccion titulo="Documentos" descripcion="Archivos del trámite, incluidos los que sube el tramitador desde su app">
          <DocumentosSolicitud solicitudTramiteId={solicitudTramiteId} apiUrl={apiUrl} />
        </Seccion>
      )}


      {/* TRAZABILIDAD */}
      {tabActiva === "trazabilidad" && (
        <Seccion titulo="Trazabilidad" descripcion="Registro de actividades y observaciones de la solicitud">
          {trazabilidad.length > 0 ? (
            <ol className="relative space-y-5 border-l border-slate-200 pl-5">
              {trazabilidad.map(registro => (
                <li key={registro.id} className="relative">
                  <span className="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-sky-400 ring-1 ring-sky-200" aria-hidden="true" />
                  <p className="whitespace-pre-line text-xs leading-5 text-slate-700">{registro.observacionTrazabilidad}</p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {registro.nombreUsuario || "Sin usuario"} · {formatoFechaFinaizacion(registro.createdAt)}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 py-10 text-center">
              <History size={30} className="mx-auto mb-2 text-slate-300" />
              <p className="text-xs font-medium text-slate-500">No se han registrado observaciones</p>
              <p className="mt-1 text-[11px] text-slate-400">La trazabilidad de esta solicitud aparecerá aquí.</p>
            </div>
          )}
        </Seccion>
      )}


      {/* GASTOS */}
      {tabActiva === "gastos" && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <GastosTramite gastos={gastos} urlGastos={urlGastos} accion={accionGasto} />
        </section>
      )}


      {/* TRAMITADOR */}
      {tabActiva === "tramitador" && (
        <Seccion titulo="Tramitador" descripcion="Comentarios y reportes desde la app Nodex Tramitadores">
          <SeguimientoTramitador
            solicitudTramiteId={solicitudTramiteId}
            seguimiento={seguimiento}
            tramitador={solicitudTramite.tramitador?.nombreTramitador ?? null}
          />
        </Seccion>
      )}


      {/* WHATSAPP */}
      {tabActiva === "whatsapp" && (
        <Seccion titulo="Notificaciones WhatsApp" descripcion="Mensajes enviados al tramitador">
          <NotificacionesWhatsApp solicitudTramiteId={solicitudTramiteId} apiUrl={apiUrl} />
        </Seccion>
      )}

    </div>

  );

}
