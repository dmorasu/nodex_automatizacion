import { Metadata } from "next"
import { BellRing } from "lucide-react"
import { requiereConfigurarNotificaciones } from "@/src/auth/dal"
import { encabezadosSesion } from "@/src/lib/sesionApi"
import TarjetaNotificacionProgramada, { type NotificacionProgramada } from "@/components/notificaciones/TarjetaNotificacionProgramada"

export const metadata: Metadata = {
  title: "Nodex - Notificaciones automáticas",
}

const leer = async (): Promise<NotificacionProgramada[] | null> => {
  try {
    const req = await fetch(`${process.env.API_URL}/notificaciones-programadas`, { headers: encabezadosSesion(), cache: "no-store" })
    return req.ok ? await req.json() : null
  } catch {
    return null
  }
}

// Admin y Torre de control: hora, días y activación de los avisos automáticos a los
// tramitadores (WhatsApp de diligencias de hoy y vencidas; push de reintegros), y envío manual
export default async function NotificacionesPage() {
  await requiereConfigurarNotificaciones()
  const notificaciones = await leer()

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-sky-100 bg-sky-50">
            <BellRing size={19} className="text-sky-500" />
          </span>
          <h1 className="text-xl font-semibold text-slate-800">Notificaciones automáticas</h1>
        </div>
        <p className="mt-1 ml-11 text-xs text-slate-400">
          Avisos que reciben los tramitadores por WhatsApp y en la app. Las horas son de Colombia.
        </p>
      </div>

      {notificaciones === null ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          No se pudo cargar la configuración. Intente de nuevo en unos minutos.
        </p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {notificaciones.map(notificacion => (
            <TarjetaNotificacionProgramada key={notificacion.clave} inicial={notificacion} />
          ))}
        </div>
      )}
    </div>
  )
}
