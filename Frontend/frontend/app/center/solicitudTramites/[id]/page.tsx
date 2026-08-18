import AddCuentaCobroBoton from '@/components/cuentacobro/AddCuentaCobroBoton';
import AddEstadosBoton from '@/components/estados/AddEstadosBoton';
import AddLogisticatoBoton from '@/components/logistica/AddLogistica';

import {
  ArrowLeft,
  Radar,
  FileText,
} from "lucide-react";

import AddProgramacionBoton from '@/components/programacion/AddProgramacionBoton';
import AddTrazabilidadBoton from '@/components/trazabilidad/AddTrazabilitadBoton';

import dynamic from "next/dynamic";

import {
  SolicitudAPIRespuestaSchema
} from '@/src/schemas';

import { Metadata } from 'next';
import Link from 'next/link';

import AddTramitadorBoton from '@/components/tramitador/AddTramitadorBoton';
import AddSubEstadoBoton from '@/components/subEstados/AddSubEstadosBoton';

import DetalleSolicitudTabs
  from '@/components/solicitudTramites/DetalleSolicitudTabs';


const ModalContainer = dynamic(
  () => import('@/components/ui/ModalContainer'),
  { ssr: false }
);


export async function generateMetadata({
  params
}: {
  params: { id: string }
}): Promise<Metadata> {

  // ==========================================
  // OBTENER LOS DATOS DE LA SOLICITUD
  // ==========================================

  const res = await fetch(
    `${process.env.API_URL}/solicitudTramites/${params.id}`
  );


  if (!res.ok) {

    return {
      title: "Solicitud no encontrada",
    };

  }


  const data = await res.json();


  // ==========================================
  // VALIDAR RESPUESTA CON ZOD
  // ==========================================

  const solicitud =
    SolicitudAPIRespuestaSchema.parse(data);


  // ==========================================
  // METADATA
  // ==========================================

  return {

    title: `Nodex - ${solicitud.id}`,

    description:
      solicitud.detalleSolicitud,

  };

}



export default async function DetalleSolicitudTramite({
  params
}: {
  params: { id: string }
}) {


  // ==========================================
  // ID DE LA SOLICITUD
  // ==========================================

  const solicitudTramiteId =
    params.id;


  // ==========================================
  // CONSULTAR SOLICITUD
  // ==========================================

  const url =
    `${process.env.API_URL}/solicitudTramites/${solicitudTramiteId}`;


  const req = await fetch(url, {

    cache: 'no-store',

  });


  // ==========================================
  // OBTENER JSON
  // ==========================================

  const json =
    await req.json();


  // ==========================================
  // VALIDAR RESPUESTA
  // ==========================================

  const solicitudTramite =
    SolicitudAPIRespuestaSchema.parse(json);


  return (

    <>


      {/* ================================================= */}
      {/* ENCABEZADO PRINCIPAL                              */}
      {/* ================================================= */}

      <div className="
        bg-white
        border
        border-slate-200
        rounded-lg
        px-5
        py-4
        shadow-lg
        mt-10
      ">


        <div className="
          grid
          grid-cols-1
          lg:grid-cols-[280px_1fr]
          gap-6
          items-center
        ">


          {/* ============================================= */}
          {/* TÍTULO                                        */}
          {/* ============================================= */}

          <div className="
            flex
            items-center
            gap-3
          ">


            {/* ICONO */}

            <div className="
              flex
              items-center
              justify-center
              w-11
              h-11
              bg-sky-50
              rounded-lg
              shrink-0
            ">

              <FileText
                className="text-sky-500"
                size={22}
              />

            </div>


            {/* TEXTO */}

            <div>

              <p className="
                text-xs
                font-medium
                text-gray-500
                mb-0.5
              ">

                Solicitud

              </p>


              <h1 className="
                text-xl
                font-semibold
                text-slate-800
                whitespace-nowrap
              ">

                Trámite N: {solicitudTramite.id}

              </h1>

            </div>


          </div>



          {/* ============================================= */}
          {/* BOTONERA                                      */}
          {/* ============================================= */}

          <div className="
            grid
            grid-cols-2
            sm:grid-cols-3
            xl:grid-cols-4
            gap-2
          ">


            {/* =========================================== */}
            {/* ESTADO                                      */}
            {/* =========================================== */}

            <AddEstadosBoton />


            {/* =========================================== */}
            {/* TRAMITADOR                                  */}
            {/* =========================================== */}

            <AddTramitadorBoton />


            {/* =========================================== */}
            {/* PROGRAMACIÓN                                */}
            {/* =========================================== */}

            <AddProgramacionBoton />


            {/* =========================================== */}
            {/* LOGÍSTICA                                   */}
            {/* =========================================== */}

            <AddLogisticatoBoton />


            {/* =========================================== */}
            {/* SUBESTADO                                   */}
            {/* =========================================== */}

            <AddSubEstadoBoton />


            {/* =========================================== */}
            {/* CUENTA DE COBRO                             */}
            {/* =========================================== */}

            <AddCuentaCobroBoton />


            {/* =========================================== */}
            {/* TRAZABILIDAD                                */}
            {/* =========================================== */}

            <AddTrazabilidadBoton />


            {/* =========================================== */}
            {/* TORRE DE CONTROL                            */}
            {/* =========================================== */}

            <Link
  href="/center/torreControl"
  className="
    group
    flex
    items-center
    gap-2.5
    h-10
    px-3
    rounded-lg
    bg-slate-50
    border
    border-slate-200
    text-slate-600
    transition-all
    duration-200
    hover:bg-emerald-50
    hover:border-emerald-200
    hover:text-emerald-600
    focus:outline-none
    focus:ring-2
    focus:ring-emerald-100
  "
>

  <span className="
    flex
    items-center
    justify-center
    w-7
    h-7
    rounded-md
    bg-white
    border
    border-slate-200
    group-hover:bg-emerald-100
    group-hover:border-emerald-200
    transition-all
  ">

    <Radar
      size={16}
      className="
        text-emerald-500
        group-hover:text-emerald-600
      "
    />

  </span>

  <span className="
    text-xs
    font-medium
    whitespace-nowrap
  ">

    Torre Control

  </span>

</Link>
<Link
  href="/center/dashboard"
  className="
    group
    flex
    items-center
    gap-2.5
    h-10
    px-3
    rounded-lg
    bg-slate-50
    border
    border-slate-200
    text-slate-600
    transition-all
    duration-200
    hover:bg-slate-100
    hover:border-slate-300
    hover:text-slate-700
    focus:outline-none
    focus:ring-2
    focus:ring-slate-100
  "
>

  <span className="
    flex
    items-center
    justify-center
    w-7
    h-7
    rounded-md
    bg-white
    border
    border-slate-200
    group-hover:bg-slate-200
    group-hover:border-slate-300
    transition-all
  ">

    <ArrowLeft
      size={16}
      className="
        text-slate-500
        group-hover:text-slate-700
      "
    />

  </span>

  <span className="
    text-xs
    font-medium
    whitespace-nowrap
  ">

    Volver

  </span>

</Link>


          </div>


        </div>


      </div>



      {/* ================================================= */}
      {/* CONTENIDO PRINCIPAL                               */}
      {/* ================================================= */}

      <div className="mt-8">


        <DetalleSolicitudTabs

          solicitudTramite={
            solicitudTramite
          }

          solicitudTramiteId={
            Number(solicitudTramiteId)
          }

          apiUrl={
            process.env.API_URL as string
          }

        />


      </div>



      {/* ================================================= */}
      {/* MODAL                                             */}
      {/* ================================================= */}

      <ModalContainer
        solicitudTramite={
          solicitudTramite
        }
      />


    </>

  );

}