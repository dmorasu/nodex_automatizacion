import AddCuentaCobroBoton from '@/components/cuentacobro/AddCuentaCobroBoton';
import AddEstadosBoton from '@/components/estados/AddEstadosBoton';
import AddLogisticatoBoton from '@/components/logistica/AddLogistica';
import { ArrowLeft, Radar, FileText, Activity } from "lucide-react"
import AddProgramacionBoton from '@/components/programacion/AddProgramacionBoton';
import AddTrazabilidadBoton from '@/components/trazabilidad/AddTrazabilitadBoton';

import dynamic from "next/dynamic";
import { SolicitudAPIRespuestaSchema } from '@/src/schemas'
import { formatoFecha, formatoFechaFinaizacion, formatoFechaSinZona, formatoMoneda } from '@/src/ultis';
import { Metadata } from 'next'
import Link from 'next/link';
import React from 'react'
import clsx from "clsx"
import AddTramitadorBoton from '@/components/tramitador/AddTramitadorBoton';
import AddSubEstadoBoton from '@/components/subEstados/AddSubEstadosBoton';


const ModalContainer = dynamic(
  () => import('@/components/ui/ModalContainer'),
  { ssr: false }
);

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  // 1️⃣ Primero obtener los datos de la solicitud
  const res = await fetch(`${process.env.API_URL}/solicitudTramites/${params.id}`);

  if (!res.ok) {
    return {
      title: "Solicitud no encontrada",
    };
  }

  const data = await res.json();

  // 2️⃣ Validar la respuesta con el esquema Zod
  const solicitud = SolicitudAPIRespuestaSchema.parse(data);

  // 3️⃣ Devolver los metadatos
  return {
    title: `Nodex - ${solicitud.id}`,
    description: solicitud.detalleSolicitud,
  };
}



export default async function DetalleSolicitudTramite({ params }: { params: { id: string } }) {

  const solicitudTramiteId = params.id
  const url = `${process.env.API_URL}/solicitudTramites/${solicitudTramiteId}`
  const req = await fetch(url, {
    cache: 'no-store',

  })
  const json = await req.json()
  const solicitudTramite = SolicitudAPIRespuestaSchema.parse(json)
  //console.log(solicitudTramite)
  return (
    <>
<div className="bg-white border border-slate-200 rounded-lg px-6 py-4 shadow-lg mt-10">

  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">

    {/* Título */}
    <div className="flex items-center gap-4 bg-slate-50 px-4 py-3 rounded-lg border w-fit">

      <FileText className="text-sky-500" size={24} />

      <h1 className="text-l sm:text-2xl font-semibold text-slate-800">
        Trámite N: {solicitudTramite.id}
      </h1>

    </div>

    {/* Botonera */}
    <div className="flex flex-col gap-3 w-full lg:w-auto">

      {/* Fila 1 */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <AddEstadosBoton />
        <AddTramitadorBoton />
        <AddProgramacionBoton />
        <AddLogisticatoBoton />
      </div>

      {/* Fila 2 */}
      
      <div className="flex flex-wrap lg:justify-end gap-3">
        <AddSubEstadoBoton/>
        

        

        <AddCuentaCobroBoton />
        <AddTrazabilidadBoton />
        <Link
          href="/center/torreControl"
          className="
            flex items-center justify-center gap-2
            h-10 min-w-[140px]
            px-4
            bg-emerald-400 text-white font-medium rounded-md
            hover:bg-white hover:text-slate-600
            hover:border hover:border-emerald-400
            transition
          "
        >
          <Radar size={18} />
          Torre Control
        </Link>
        <Link
          href="/center/dashboard"
          className="
            flex items-center justify-center gap-2
            h-10 min-w-[140px]
            px-4
            bg-red-400 text-white font-medium rounded-md
            hover:bg-white hover:text-slate-600
            hover:border hover:border-red-400
            transition
          "
        >
          <ArrowLeft size={18} />
          Volver
        </Link>
        

      </div>

    </div>

  </div>

</div>
      <>  
          
          <div>
             <h4 className="text-2xl text-gray-600 mt-10 text-center font-bold "  >
            Detalle de la Solicitud:
          </h4>
          </div>
          <ul role="list" className="divide-y divide-gray-300 border shadow-lg mt-10 ">
              
              <li key={solicitudTramite.id} className="flex justify-center gap-x-6 p-5 ">
                <div className="flex min-w-0 gap-x-4">
                  <div className="min-w-0 flex-auto space-y-2"> 
                    <p className="text-lg  leading-6 text-red-500 font-bold">
                        <span className="text-red-500 font-bold ">Número de Solicitud : </span>{" "}
                        {solicitudTramite.id}
                    </p>
                    <p className="text-sm font-normal leading-6 text-gray-900">
                        <span className="text-red-500 font-semibold ">Cliente:</span>{" "}
                        {solicitudTramite.clientes?.nombreCliente}
                    </p>
                    <p className="text-sm font-normal leading-6 text-gray-900 text-justify">
                        <span className="text-black font-bold ">Detalle Solicitud: </span>{" "}
                        <span className='text-justify'>{solicitudTramite.detalleSolicitud}</span>
                    </p>
                    
                    
                     <p className='text-gray-600  text-sm'>
                        <span className="text-black font-bold">Placa:</span>{" "}
                        <span className='text-justify'> {solicitudTramite.placa?? "Sin Placa"}</span>
                    </p>
                     <p className='text-gray-600  text-sm'>
                        <span className="text-black font-bold">Matrícula Inmobiliaria:</span>{" "}
                        <span className='text-justify'>{solicitudTramite.matriculaInmobiliaria??"Sin Matricula"}</span>
                    </p>
                     
                     <p className='text-gray-500  text-sm'>
                        
                        <span className="text-black font-semibold">Centro de Costos:</span>{" "}
                        {solicitudTramite.operaciones?.centroDeCostos??"El tipo de trámite no se le ha asignado Centro de Costos"}
                        
                    </p>
                    <p className="text-sm font-bold text-sky-400">
                         
                    </p>
                    <p className='text-gray-500  text-sm'>
                        

                        <span className="text-black font-semibold">Ciudad:</span>{" "}
                        {solicitudTramite.municipios?.nombreMunicipio}
                    </p>
                    <p className='text-gray-500  text-sm'>

                        <span className="text-black font-semibold">Dirección:</span>{" "}
                        {solicitudTramite.direccionTramite} 
                    </p>
                    <p className='text-gray-600 text-sm'>
                        <span className="text-black font-bold">Tipo de Trámite:</span>{" "}
                        {solicitudTramite.tramite?.nombreTramite}

                    </p>
                    <p className='text-gray-600 text-sm'>
                        <span className="text-black font-bold">Valor Trámite:</span>{" "}
                        {formatoMoneda(   solicitudTramite.programacion?.valorTramite??"0")}

                    </p>
                    <p className='text-gray-600 text-sm'>
                        <span className="text-black font-bold">Valor Viáticos:</span>{" "}
                          {formatoMoneda(   solicitudTramite.programacion?.valorViaticos??"0")}

                    </p>
                     <p className='text-gray-500  text-sm'>
                        

                        <span className="text-black font-semibold">Fecha de Creación:</span>{" "}
                        {formatoFechaFinaizacion(solicitudTramite.createdAt)} 
                    </p>
                    
                    <p className='text-gray-600 text-sm'>
                        <span className="text-black font-bold">Fecha en la que se debe Entregar el  Resultado:</span>{" "}
                        {solicitudTramite.fechaEntregaResultado && formatoFechaSinZona(solicitudTramite.fechaEntregaResultado??"Sin Fecha")}

                    </p>
                    
                     <p className='text-gray-500  text-sm'>
                        

                        <span className="text-black font-semibold">Fecha en la que se realizará la Diligencia:</span>{" "}
                        {formatoFechaSinZona(solicitudTramite.programacion?.fechaProbableEntrega??"Sin Fecha ")} 
                    </p>
                   
                    <p className='text-gray-600 text-sm'>
                        <span className="text-black font-bold">Fecha en la que se Finaliza el Servicio:</span>{" "}
                        {solicitudTramite.fechaEntregaResultado && formatoFechaFinaizacion(solicitudTramite.programacion?.fechaFinalizacionServicio??"Sin Fecha")}

                    </p>
                    <p className='text-red-500  text-sm font-bold'>
                        

                        <span className="text-black font-semibold">Tramitador Asignado:</span>{" "}
                        {solicitudTramite.tramitador?.nombreTramitador??"No se ha asignado un Tramitador "} 
                    </p>
                    {/* <p
                                        className={clsx(
                                          "p-2 rounded-lg font-bold w-full md:w-auto text-center",
                                          {
                                            "bg-red-400 text-white":
                                              solicitudTramite.estadosTramites?.[0]?.estado?.nombreEstado === "Sin Iniciar",
                                            "bg-amber-400 text-white":
                                              solicitudTramite.estadosTramites?.[0]?.estado?.nombreEstado === "En Curso",
                                            "bg-green-500 text-white":
                                              solicitudTramite.estadosTramites?.[0]?.estado?.nombreEstado === "Finalizado",
                                            "bg-blue-500 text-white":
                                              solicitudTramite.estadosTramites?.[0]?.estado?.nombreEstado === "Reprogramado",
                                            "bg-orange-500 text-white":
                                              solicitudTramite.estadosTramites?.[0]?.estado?.nombreEstado === "Desistido",
                                            "bg-purple-500 text-white":
                                              solicitudTramite.estadosTramites?.[0]?.estado?.nombreEstado === "Suspendido",
                                            "bg-gray-400 text-white":
                                              !["Sin Iniciar","En Curso","Finalizado","Reprogramado","Desistido","Suspendido"]
                                              .includes(solicitudTramite.estadosTramites?.[0]?.estado?.nombreEstado ?? "")
                                          }
                                        )}
                                      >
                                        {solicitudTramite.estadosTramites?.[0]?.estado?.nombreEstado ?? "Sin Iniciar"}
                                      </p> */}
                  

        
              <p className="text-black font-semibold text-sm">
                      Programador:{" "}
                      <span className="font-normal text-gray-600">
                  {solicitudTramite.tramite?.responsable??"Sin asingar"}
                </span>
                
              </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-x-6">

                </div>
              </li>
            
          </ul>
        </>
      {solicitudTramite.trazabilidad?.length ? (
        <>


          

          
         



          <h6 className='text-2xl text-orage-400 mt-10 text-center'>
            Historial de Trazabilidad:
          </h6>

          <ul role="list" className="divide-y divide-gray-300 border shadow-lg mt-10 ">
            {solicitudTramite.trazabilidad.map((solicitudTramite) => (
              <li key={solicitudTramite.id} className="flex justify-between gap-x-6 p-5">
                <div className="flex min-w-0 gap-x-4">
                  <div className="min-w-0 flex-auto space-y-2">
                    <p className="text-base font-semibold ">
                      {solicitudTramite.observacionTrazabilidad}
                    </p>
                    <span className="text-orange-500">Creado por :</span>{" "}
                        {solicitudTramite.nombreUsuario} 
                    <p className="text-sm font-bold text-sky-400">
                      {formatoFechaFinaizacion(solicitudTramite.createdAt)}

                    </p>
                    <p className='text-gray-500  text-sm'>

                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>


        </>
      ) : (
        


        <p className='text-center py-20'> No se han registrado observaciones en la Trazabilidad</p>
        
      )}
      <ModalContainer solicitudTramite={solicitudTramite} />


    </>
  )
}
