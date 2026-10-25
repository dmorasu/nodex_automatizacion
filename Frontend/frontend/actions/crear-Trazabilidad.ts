"use server"

import { TrazabilidadSchema, SuccessSchema } from "@/src/schemas"
import { verificacionSesion } from "@/src/auth/dal"
import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { mensajesDeError } from "@/src/lib/erroresBackend"

type ActionStateType = {
    errors: string[],
    success: string
}

export default async function CrearTrazabilidad(
    solicitudTramitesId: number,
    prevState: ActionStateType,
    formData: FormData
) {
    try {
        // ✅ Sesión por request
        const { usuario } = await verificacionSesion()

        const trazabilidadData = {
            solicitudTramitesId,
            observacionTrazabilidad: formData.get('observacionTrazabilidad')
        }

        const trazabilidad = TrazabilidadSchema.safeParse(trazabilidadData)

        if (!trazabilidad.success) {
            return {
                errors: trazabilidad.error.issues.map(issue => issue.message),
                success: ''
            }
        }

        // ✅ Token dinámico
        const token = (await cookies()).get("TOKEN")?.value

        if (!token) {
            return {
                errors: ["Sesión inválida"],
                success: ''
            }
        }

        const url = `${process.env.API_URL}/solicitudTramites/${solicitudTramitesId}/trazabilidad`

        const req = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            cache: "no-store",          // 🔥 CLAVE
            next: { revalidate: 0 },    // 🔥 refuerzo anti-cache
            body: JSON.stringify({
                solicitudTramitesId,
                nombreUsuario: usuario.nombreUsuario,
                observacionTrazabilidad: trazabilidadData.observacionTrazabilidad
            })
        })

        const json = await req.json().catch(() => null)

        if (!req.ok) {
            return {
                errors: mensajesDeError(json, "No se pudo guardar la trazabilidad"),
                success: ''
            }
        }

        revalidatePath(`/center/solicitudTramites/${solicitudTramitesId}`)

        const success = SuccessSchema.parse(json)

        return {
            errors: [],
            success
        }

    } catch (error) {
        console.error("Error CrearTrazabilidad:", error)

        return {
            errors: ["Error interno del servidor"],
            success: ''
        }
    }
}