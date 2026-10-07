"use client"

import { useEffect, useState } from "react"
import { toast } from "react-toastify"
import { BellOff, BellRing, Loader2, Share } from "lucide-react"
import { enviarPruebaPush, guardarSuscripcionPush } from "@/actions/notificaciones"
import { datosSuscripcion, estadoPush, navegadorActual, suscribir, type EstadoPush } from "@/src/lib/push"
import { claseBotonPrimario } from "@/components/ui/estilos"

// Tarjeta del inicio para activar los avisos en el celular (trámites nuevos y reintegros).
// Si ya están activas no muestra nada, pero vuelve a registrar el celular en el backend: así,
// si otro tramitador inicia sesión en el mismo celular, los avisos pasan a él.
export default function ActivarNotificaciones({ clavePublica }: { clavePublica: string }) {
  const [estado, setEstado] = useState<EstadoPush | null>(null)
  const [activando, setActivando] = useState(false)

  useEffect(() => {
    let vigente = true
    const revisar = async () => {
      const actual = await estadoPush()
      if (actual === "activas" || (actual === "inactivas" && Notification.permission === "granted")) {
        // Permiso ya dado: se suscribe (o confirma) sin volver a preguntar
        const suscripcion = await suscribir(clavePublica).catch(() => null)
        if (suscripcion) {
          const guardada = await guardarSuscripcionPush(datosSuscripcion(suscripcion), navegadorActual())
          if (vigente) setEstado(guardada.ok ? "activas" : "inactivas")
          return
        }
      }
      if (vigente) setEstado(actual)
    }
    void revisar()
    return () => { vigente = false }
  }, [clavePublica])

  const activar = async () => {
    setActivando(true)
    try {
      const suscripcion = await suscribir(clavePublica)
      if (!suscripcion) {
        setEstado(Notification.permission === "denied" ? "bloqueadas" : "inactivas")
        return
      }
      const guardada = await guardarSuscripcionPush(datosSuscripcion(suscripcion), navegadorActual())
      if (!guardada.ok) {
        toast.error(guardada.errores[0])
        return
      }
      setEstado("activas")
      toast.success("Notificaciones activadas")
      // Prueba para que vea cómo le llegan
      await enviarPruebaPush()
    } catch {
      toast.error("No se pudieron activar las notificaciones en este celular")
    } finally {
      setActivando(false)
    }
  }

  if (estado === null || estado === "activas" || estado === "no-soportado") return null

  if (estado === "instalar-iphone") {
    return (
      <Aviso Icono={BellRing} titulo="Reciba avisos en su iPhone">
        Para que le lleguen los trámites nuevos y los reintegros pendientes, agregue la app a la pantalla de inicio:
        toque <Share size={13} className="inline align-text-bottom" /> <b>Compartir</b> → <b>Agregar a inicio</b>, ábrala
        desde ese ícono y active las notificaciones.
      </Aviso>
    )
  }

  if (estado === "bloqueadas") {
    return (
      <Aviso Icono={BellOff} titulo="Notificaciones bloqueadas">
        Bloqueó las notificaciones de esta app. Para recibir los avisos de trámites nuevos y reintegros, actívelas en los
        ajustes del navegador o del celular (Notificaciones → Nodex Tramitadores).
      </Aviso>
    )
  }

  return (
    <Aviso Icono={BellRing} titulo="Active las notificaciones">
      Le avisaremos cuando le asignen un trámite y cada día mientras tenga reintegros por enviar.
      <button type="button" onClick={activar} disabled={activando} className={`${claseBotonPrimario} mt-3 w-full`}>
        {activando ? <Loader2 size={17} className="animate-spin" /> : <BellRing size={17} />}
        Activar notificaciones
      </button>
    </Aviso>
  )
}

function Aviso({ Icono, titulo, children }: { Icono: typeof BellRing, titulo: string, children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
      <div className="flex items-center gap-2">
        <Icono size={18} className="shrink-0 text-indigo-600" />
        <p className="text-sm font-semibold text-indigo-900">{titulo}</p>
      </div>
      <div className="mt-1.5 text-sm text-indigo-900/80">{children}</div>
    </div>
  )
}
