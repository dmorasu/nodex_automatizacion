"use server"

import { encabezadosSesion } from "@/src/lib/sesionApi"
import { CrearSolicitudSchema, ErrorResponoseSchema, SolicitudTramites, SuccessSchema ,EditarSolicitudSchema} from "@/src/schemas"
import { error } from "console"
import { revalidatePath } from "next/cache"
import { Solitreo } from "next/font/google"
import { success } from "zod"

type ActiosStateType={
    errors:string[],
    success:string
}


// latitud/longitud del formulario: solo si vienen las dos y son números
const coordenadas = (formData: FormData) => {
    const latitud = Number(formData.get("latitud"))
    const longitud = Number(formData.get("longitud"))
    return formData.get("latitud") && formData.get("longitud") && Number.isFinite(latitud) && Number.isFinite(longitud)
        ? { latitud, longitud }
        : {}
}

export async function EditarSolicitudTramite(solicitudTramiteId: SolicitudTramites['id'], prevState:ActiosStateType, formData:FormData) {
  
   const solicitudTramiteData={
        detalleSolicitud: formData.get('detalleSolicitud'),
        direccionTramite: formData.get('direccionTramite'),
        municipiosId:formData.get('municipioId'),
        clienteId:formData.get('clienteId'),
        operacionesId:formData.get('operacionId'),
        tramiteId:formData.get('tramiteId'),
        entidadId:formData.get("entidadId"),
        fechaEntregaResultado:formData.get('fechaEntregaResultado'),
        
        usuarioId:formData.get('usuarioId')
   }

   const solicitudTramite = EditarSolicitudSchema.safeParse(solicitudTramiteData)

   if(!solicitudTramite.success){
        return{
            errors:solicitudTramite.error.issues.map(issue=>issue.message),
            success:''
        }
   }

   const url=`${process.env.API_URL}/solicitudTramites/${solicitudTramiteId}`
   const req = await fetch(url,{
    method:'PUT',
    headers: {
      ...(await encabezadosSesion()),
        'Content-Type':'application/json'
    },
    body:JSON.stringify({
              detalleSolicitud:solicitudTramiteData.detalleSolicitud,
              direccionTramite:solicitudTramiteData.direccionTramite,
              // Ubicación del lugar elegido en el autocompletado de Google (si se eligió)
              ...coordenadas(formData),
              municipiosId:solicitudTramiteData.municipiosId,
              clienteId :solicitudTramiteData.clienteId,
              operacionesId:solicitudTramiteData.operacionesId,
              fechaEntregaResultado:solicitudTramiteData.fechaEntregaResultado,
              entidadId:solicitudTramiteData.entidadId,
              tramiteId:solicitudTramiteData.tramiteId,
             
              usuarioId:solicitudTramiteData.usuarioId
    })
   })

   const json =await req.json()
   if(!req.ok){
    const {error}=ErrorResponoseSchema.parse(json)
    return{
        errors:[error],
        success:''
    }
   }

   revalidatePath('/center/dashboard')
   const success=SuccessSchema.parse(json)

    return {
        errors:[],
        success
    }
    
}