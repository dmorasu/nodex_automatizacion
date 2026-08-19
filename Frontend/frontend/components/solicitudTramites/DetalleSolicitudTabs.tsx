"use client";

import { useState } from "react";

import {
  Info,
  FileText,
  History,
  CalendarDays,
  User,
  MapPin,
  Car,
  Building2,
  ClipboardList,
  DollarSign,
  MapPinned,
} from "lucide-react";

import DocumentosSolicitud from "@/components/documentos/DocumentosSolicitud";

import {
  formatoFechaFinaizacion,
  formatoFechaSinZona,
  formatoMoneda,
} from "@/src/ultis";


interface Props {
  solicitudTramite: any;
  solicitudTramiteId: number;
  apiUrl: string;
}


export default function DetalleSolicitudTabs({
  solicitudTramite,
  solicitudTramiteId,
  apiUrl,
}: Props) {

  const [tabActiva, setTabActiva] =
    useState<"informacion" | "documentos" | "trazabilidad">(
      "informacion"
    );


  return (

    <div className="
      bg-white
      border
      border-gray-200
      rounded-lg
      shadow-lg
      overflow-hidden
      mt-6
    ">


      {/* ===================================================== */}
      {/* PESTAÑAS                                               */}
      {/* ===================================================== */}

      <div className="
        flex
        flex-wrap
        border-b
        border-gray-200
        bg-gray-50
      ">


        {/* INFORMACIÓN */}

        <button
          type="button"
          onClick={() => setTabActiva("informacion")}
          className={`
            flex
            items-center
            justify-center
            gap-2
            px-5
            py-3
            text-sm
            font-medium
            transition
            border-b-2

            ${
              tabActiva === "informacion"
                ? "border-sky-500 text-sky-600 bg-white"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            }
          `}
        >

          <Info size={17} />

          Información

        </button>



        {/* DOCUMENTOS */}

        <button
          type="button"
          onClick={() => setTabActiva("documentos")}
          className={`
            flex
            items-center
            justify-center
            gap-2
            px-5
            py-3
            text-sm
            font-medium
            transition
            border-b-2

            ${
              tabActiva === "documentos"
                ? "border-sky-500 text-sky-600 bg-white"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            }
          `}
        >

          <FileText size={17} />

          Documentos

        </button>



        {/* TRAZABILIDAD */}

        <button
          type="button"
          onClick={() => setTabActiva("trazabilidad")}
          className={`
            flex
            items-center
            justify-center
            gap-2
            px-5
            py-3
            text-sm
            font-medium
            transition
            border-b-2

            ${
              tabActiva === "trazabilidad"
                ? "border-sky-500 text-sky-600 bg-white"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            }
          `}
        >

          <History size={17} />

          Trazabilidad

          {solicitudTramite.trazabilidad?.length > 0 && (

            <span className="
              ml-1
              px-2
              py-0.5
              rounded-full
              bg-sky-100
              text-sky-600
              text-xs
            ">

              {solicitudTramite.trazabilidad.length}

            </span>

          )}

        </button>


      </div>



      {/* ===================================================== */}
      {/* CONTENIDO                                              */}
      {/* ===================================================== */}

      <div className="p-6">


        {/* ===================================================== */}
        {/* INFORMACIÓN                                            */}
        {/* ===================================================== */}

        {tabActiva === "informacion" && (

  <div>

    {/* ================================================= */}
    {/* ENCABEZADO */}
    {/* ================================================= */}

    <div className="
      flex
      items-center
      gap-3
      mb-6
      pb-4
      border-b
      border-gray-200
    ">

      <div className="
        bg-slate-50
        p-2
        rounded-lg
      ">

        <Info
          size={21}
          className="text-sky-500"
        />

      </div>

      <div>

        <h3 className="
          text-base
          font-semibold
          text-gray-800
        ">
          Información de la Solicitud
        </h3>

        <p className="
          text-xs
          text-gray-500
          mt-0.5
        ">
          Información general del trámite
        </p>

      </div>

    </div>


    {/* ================================================= */}
    {/* INFORMACIÓN */}
    {/* ================================================= */}

    <div className="space-y-0">


      {/* NÚMERO */}

      <div className="
        flex
        flex-col
        sm:flex-row
        sm:items-center
        py-3
        border-b
        border-gray-100
      ">

        <span className="
          text-xs
          font-medium
          text-gray-500
          sm:w-64
          shrink-0
        ">
          Número de Solicitud
        </span>

        <span className="
          text-xs
          font-semibold
          text-gray-800
        ">
          {solicitudTramite.id}
        </span>

      </div>


      {/* CLIENTE */}

      <div className="
        flex
        flex-col
        sm:flex-row
        sm:items-center
        py-3
        border-b
        border-gray-100
      ">

        <span className="
          text-xs
          font-medium
          text-gray-500
          sm:w-64
          shrink-0
        ">
          Cliente
        </span>

        <span className="
          text-xs
          text-gray-800
        ">
          {solicitudTramite.clientes?.nombreCliente ??
            "Sin cliente"}
        </span>

      </div>
      {/* De */}

      <div className="
        flex
        flex-col
        sm:flex-row
        sm:items-center
        py-3
        border-b
        border-gray-100
      ">

        <span className="
          text-xs
          font-medium
          text-gray-500
          sm:w-64
          shrink-0
        ">
          Detalle
        </span>

        <span className="
          text-xs
          text-gray-800
        ">
          {solicitudTramite.detalleSolicitud??""}
        </span>

      </div>
            

      {/* PLACA */}

      <div className="
        flex
        flex-col
        sm:flex-row
        sm:items-center
        py-3
        border-b
        border-gray-100
      ">

        <span className="
          text-xs
          font-medium
          text-gray-500
          sm:w-64
          shrink-0
        ">
          Placa
        </span>

        <span className="
          text-xs
          text-gray-800
        ">
          {solicitudTramite.placa ?? "Sin Placa"}
        </span>

      </div>


      {/* MATRÍCULA */}

      <div className="
        flex
        flex-col
        sm:flex-row
        sm:items-center
        py-3
        border-b
        border-gray-100
      ">

        <span className="
          text-xs
          font-medium
          text-gray-500
          sm:w-64
          shrink-0
        ">
          Matrícula Inmobiliaria
        </span>

        <span className="
          text-xs
          text-gray-800
        ">
          {solicitudTramite.matriculaInmobiliaria ??
            "Sin Matrícula"}
        </span>

      </div>


      {/* CENTRO DE COSTOS */}

      <div className="
        flex
        flex-col
        sm:flex-row
        sm:items-center
        py-3
        border-b
        border-gray-100
      ">

        <span className="
          text-xs
          font-medium
          text-gray-500
          sm:w-64
          shrink-0
        ">
          Centro de Costos
        </span>

        <span className="
          text-xs
          text-gray-800
        ">
          {solicitudTramite.operaciones?.centroDeCostos ??
            "Sin Centro de Costos"}
        </span>

      </div>


      {/* CIUDAD */}

      <div className="
        flex
        flex-col
        sm:flex-row
        sm:items-center
        py-3
        border-b
        border-gray-100
      ">

        <span className="
          text-xs
          font-medium
          text-gray-500
          sm:w-64
          shrink-0
        ">
          Ciudad
        </span>

        <span className="
          text-xs
          text-gray-800
        ">
          {solicitudTramite.municipios?.nombreMunicipio ??
            "Sin ciudad"}
        </span>

      </div>


      {/* DIRECCIÓN */}

      <div className="
        flex
        flex-col
        sm:flex-row
        sm:items-center
        py-3
        border-b
        border-gray-100
      ">

        <span className="
          text-xs
          font-medium
          text-gray-500
          sm:w-64
          shrink-0
        ">
          Dirección
        </span>

        <span className="
          text-xs
          text-gray-800
        ">
          {solicitudTramite.direccionTramite ??
            "Sin dirección"}
        </span>

      </div>


      {/* TIPO DE TRÁMITE */}

      <div className="
        flex
        flex-col
        sm:flex-row
        sm:items-center
        py-3
        border-b
        border-gray-100
      ">

        <span className="
          text-xs
          font-medium
          text-gray-500
          sm:w-64
          shrink-0
        ">
          Tipo de Trámite
        </span>

        <span className="
          text-xs
          text-gray-800
        ">
          {solicitudTramite.tramite?.nombreTramite ??
            "Sin trámite"}
        </span>

      </div>


      {/* VALOR TRÁMITE */}

      <div className="
        flex
        flex-col
        sm:flex-row
        sm:items-center
        py-3
        border-b
        border-gray-100
      ">

        <span className="
          text-xs
          font-medium
          text-gray-500
          sm:w-64
          shrink-0
        ">
          Valor Trámite
        </span>

        <span className="
          text-xs
          font-medium
          text-gray-800
        ">
          {formatoMoneda(
            solicitudTramite.programacion?.valorTramite ?? "0"
          )}
        </span>

      </div>


      {/* VIÁTICOS */}

      <div className="
        flex
        flex-col
        sm:flex-row
        sm:items-center
        py-3
        border-b
        border-gray-100
      ">

        <span className="
          text-xs
          font-medium
          text-gray-500
          sm:w-64
          shrink-0
        ">
          Valor Viáticos
        </span>

        <span className="
          text-xs
          font-medium
          text-gray-800
        ">
          {formatoMoneda(
            solicitudTramite.programacion?.valorViaticos ?? "0"
          )}
        </span>

      </div>


      {/* FECHA CREACIÓN */}

      <div className="
        flex
        flex-col
        sm:flex-row
        sm:items-center
        py-3
        border-b
        border-gray-100
      ">

        <span className="
          text-xs
          font-medium
          text-gray-500
          sm:w-64
          shrink-0
        ">
          Fecha de Creación
        </span>

        <span className="
          text-xs
          text-gray-800
        ">
          {formatoFechaFinaizacion(
            solicitudTramite.createdAt
          )}
        </span>

      </div>


      {/* FECHA ENTREGA */}

      <div className="
        flex
        flex-col
        sm:flex-row
        sm:items-center
        py-3
        border-b
        border-gray-100
      ">

        <span className="
          text-xs
          font-medium
          text-gray-500
          sm:w-64
          shrink-0
        ">
          Fecha Entrega Resultado
        </span>

        <span className="
          text-xs
          text-gray-800
        ">
          {solicitudTramite.fechaEntregaResultado
            ? formatoFechaSinZona(
                solicitudTramite.fechaEntregaResultado
              )
            : "Sin Fecha"}
        </span>

      </div>


      {/* FECHA DILIGENCIA */}

      <div className="
        flex
        flex-col
        sm:flex-row
        sm:items-center
        py-3
        border-b
        border-gray-100
      ">

        <span className="
          text-xs
          font-medium
          text-gray-500
          sm:w-64
          shrink-0
        ">
          Fecha de Diligencia
        </span>

        <span className="
          text-xs
          text-gray-800
        ">
          {formatoFechaSinZona(
            solicitudTramite.programacion?.fechaProbableEntrega ??
              "Sin Fecha"
          )}
        </span>

      </div>


      {/* FECHA FINALIZACIÓN */}

      <div className="
        flex
        flex-col
        sm:flex-row
        sm:items-center
        py-3
        border-b
        border-gray-100
      ">

        <span className="
          text-xs
          font-medium
          text-gray-500
          sm:w-64
          shrink-0
        ">
          Fecha Finalización Servicio
        </span>

        <span className="
          text-xs
          text-gray-800
        ">
          {solicitudTramite.programacion?.fechaFinalizacionServicio
            ? formatoFechaFinaizacion(
                solicitudTramite.programacion.fechaFinalizacionServicio
              )
            : "Sin Fecha"}
        </span>

      </div>


      {/* TRAMITADOR */}

      <div className="
        flex
        flex-col
        sm:flex-row
        sm:items-center
        py-3
        border-b
        border-gray-100
      ">

        <span className="
          text-xs
          font-medium
          text-gray-500
          sm:w-64
          shrink-0
        ">
          Tramitador Asignado
        </span>

        <span className="
          text-xs
          text-gray-800
        ">
          {solicitudTramite.tramitador?.nombreTramitador ??
            "No se ha asignado un Tramitador"}
        </span>

      </div>


      {/* PROGRAMADOR */}

      <div className="
        flex
        flex-col
        sm:flex-row
        sm:items-center
        py-3
      ">

        <span className="
          text-xs
          font-medium
          text-gray-500
          sm:w-64
          shrink-0
        ">
          Programador
        </span>

        <span className="
          text-xs
          text-gray-800
        ">
          {solicitudTramite.municipios?.responsable ??
            "Sin asignar"}
        </span>

      </div>


      

    </div>

  </div>

)}



        {/* ===================================================== */}
        {/* DOCUMENTOS                                            */}
        {/* ===================================================== */}

        {tabActiva === "documentos" && (

          <DocumentosSolicitud
            solicitudTramiteId={
              solicitudTramiteId
            }
            apiUrl={
              apiUrl
            }
          />

        )}



        {/* ===================================================== */}
        {/* TRAZABILIDAD                                          */}
        {/* ===================================================== */}

        {tabActiva === "trazabilidad" && (

          <div>


            {/* ================================================ */}
            {/* ENCABEZADO                                        */}
            {/* ================================================ */}

            <div className="
              flex
              items-center
              gap-3
              mb-6
              pb-4
              border-b
              border-gray-200
            ">

              <div className="
                bg-sky-50
                p-2
                rounded-lg
              ">

                <History
                  size={22}
                  className="text-sky-500"
                />

              </div>


              <div>

                <h3 className="
                  text-xm
                  font-semibold
                  text-gray-800
                ">
                  Historial de Gestión
                </h3>

                <p className="
                  text-xs
                  text-gray-500
                  mt-0.5
                ">
                  Registro de actividades y observaciones de la solicitud
                </p>

              </div>

            </div>



            {/* ================================================ */}
            {/* HISTORIAL                                          */}
            {/* ================================================ */}

            {solicitudTramite.trazabilidad?.length ? (

              <div className="space-y-3">

                {solicitudTramite.trazabilidad.map(
                  (trazabilidad: any) => (

                    <div
                      key={trazabilidad.id}
                      className="
                        bg-slate-50
                        border
                        border-gray-200
                        rounded-lg
                        p-4
                        transition
                        hover:border-sky-200
                      "
                    >


                      {/* OBSERVACIÓN */}

                      <div className="
                        flex
                        items-start
                        gap-3
                      ">

                        <div className="
                          bg-sky-50
                          p-2
                          rounded-lg
                          shrink-0
                        ">

                          <History
                            size={18}
                            className="text-sky-500"
                          />

                        </div>


                        <div className="
                          min-w-0
                          flex-1
                        ">


                          <p className="
                            text-xs
                            
                            text-gray-800
                            leading-5
                          ">

                            {trazabilidad.observacionTrazabilidad}

                          </p>



                          {/* USUARIO + FECHA */}

                          <div className="
                            flex
                            flex-col
                            sm:flex-row
                            sm:items-center
                            gap-1
                            sm:gap-4
                            mt-3
                          ">


                            <p className="
                              text-xs
                              text-gray-500
                            ">

                              <span className="
                                font-medium
                                text-gray-600
                              ">
                                De:
                              </span>{" "}

                              {trazabilidad.nombreUsuario}

                            </p>



                            <span className="
                              hidden
                              sm:block
                              text-gray-300
                            ">
                              •
                            </span>



                            <p className="
                              text-xs
                              text-gray-500
                            ">

                              {formatoFechaFinaizacion(
                                trazabilidad.createdAt
                              )}

                            </p>


                          </div>


                        </div>


                      </div>


                    </div>

                  )
                )}

              </div>

            ) : (


              /* ============================================== */
              /* SIN TRAZABILIDAD                                */
              /* ============================================== */

              <div className="
                text-center
                py-12
                border
                border-dashed
                border-gray-300
                rounded-lg
                bg-slate-50
              ">

                <History
                  size={35}
                  className="
                    mx-auto
                    mb-3
                    text-gray-300
                  "
                />


                <p className="
                  text-xm
                  font-medium
                  text-gray-500
                ">
                  No se han registrado observaciones
                </p>


                <p className="
                  text-xs
                  text-gray-400
                  mt-1
                ">
                  La trazabilidad de esta solicitud aparecerá aquí.
                </p>

              </div>

            )}

          </div>

        )}


      </div>

    </div>

  );

}