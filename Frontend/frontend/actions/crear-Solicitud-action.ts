"use server"

import { CrearSolicitudSchema } from "@/src/schemas"
import { cookies } from "next/headers"


type ActionStateType = {
    errors: string[],
    success: string,
    solicitudId?: number
}


export async function crearSolicitud(
    prevState: ActionStateType,
    formData: FormData
) {

    // =====================================================
    // VALIDAR FORMULARIO
    // =====================================================

    const solicitud =
        CrearSolicitudSchema.safeParse({

            detalleSolicitud:
                formData.get("detalleSolicitud"),

            direccionTramite:
                formData.get("direccionTramite"),

            municipiosId:
                formData.get("municipioId"),

            clienteId:
                formData.get("clienteId"),

            operacionesId:
                formData.get("operacionId"),

            tramiteId:
                formData.get("tramiteId"),

            entidadId:
                formData.get("entidadId"),

            fechaEntregaResultado:
                formData.get("fechaEntregaResultado"),

            placa:
                formData.get("placa"),

            matriculaInmobiliaria:
                formData.get("matricula"),

            usuarioId:
                formData.get("usuarioId")
        })


    // =====================================================
    // ERRORES DE VALIDACIÓN
    // =====================================================

    if (!solicitud.success) {

        return {

            errors:
                solicitud.error.issues.map(
                    issue => issue.message
                ),

            success: ""

        }

    }


    // =====================================================
    // TOKEN
    // =====================================================

    const token =
        cookies().get("TOKEN")?.value


    // =====================================================
    // URL API
    // =====================================================

    const url =
        `${process.env.API_URL}/solicitudTramites`


    // =====================================================
    // CREAR SOLICITUD
    // =====================================================

    const req =
        await fetch(
            url,
            {
                method: "POST",

                headers: {

                    "Content-Type":
                        "application/json",

                    "Authorization":
                        `Bearer ${token}`

                },

                body:
                    JSON.stringify({

                        detalleSolicitud:
                            solicitud.data.detalleSolicitud,

                        direccionTramite:
                            solicitud.data.direccionTramite,

                        municipiosId:
                            solicitud.data.municipiosId,

                        clienteId:
                            solicitud.data.clienteId,

                        operacionesId:
                            solicitud.data.operacionesId,

                        fechaEntregaResultado:
                            solicitud.data.fechaEntregaResultado,

                        placa:
                            solicitud.data.placa,

                        matriculaInmobiliaria:
                            solicitud.data.matriculaInmobiliaria,

                        entidadId:
                            solicitud.data.entidadId,

                        tramiteId:
                            solicitud.data.tramiteId,

                        usuarioId:
                            solicitud.data.usuarioId

                    })
            }
        )


    // =====================================================
    // LEER RESPUESTA
    // =====================================================

    const json =
        await req.json()


    // =====================================================
    // VALIDAR RESPUESTA HTTP
    // =====================================================

    if (!req.ok) {

        return {

            errors: [
                json.error ||
                "No se pudo crear la solicitud"
            ],

            success: ""

        }

    }


    // =====================================================
    // OBTENER SOLICITUD CREADA
    // =====================================================

    const solicitudCreada =
        json.solicitud


    if (!solicitudCreada?.id) {

        return {

            errors: [
                "La solicitud fue creada pero no se recibió su identificador"
            ],

            success: ""

        }

    }


    // =====================================================
    // RESPUESTA
    // =====================================================

    return {

        errors: [],

        success:
            "Solicitud creada correctamente",

        solicitudId:
            solicitudCreada.id

    }

}