"use client"

import { useEffect, useState } from "react"
import {
  MessageCircle,
  Clock,
  User,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react"

interface NotificacionWhatsApp {
  id: number
  solicitudTramiteId: number
  tipo: string
  canal: string
  destinatario: string
  mensaje: string
  estado: string
  error: string | null
  createdAt: string
}

interface Props {
  solicitudTramiteId: number
  apiUrl: string
}

export default function NotificacionesWhatsApp({
  solicitudTramiteId,
  apiUrl,
}: Props) {

  const [notificaciones, setNotificaciones] = useState<
    NotificacionWhatsApp[]
  >([])

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState<string | null>(null)

  // 🔹 Notificación actualmente abierta
  const [notificacionAbierta, setNotificacionAbierta] =
    useState<number | null>(null)


  useEffect(() => {

    const obtenerNotificaciones = async () => {

      try {

        setLoading(true)
        setError(null)

        const response = await fetch(
          `${apiUrl}/notificaciones/solicitud/${solicitudTramiteId}`,
          {
            cache: "no-store",
          }
        )

        if (!response.ok) {
          throw new Error(
            "No se pudieron obtener las notificaciones"
          )
        }

        const data: NotificacionWhatsApp[] =
          await response.json()

        setNotificaciones(
          data.filter(
            (notificacion) =>
              notificacion.canal === "WHATSAPP"
          )
        )

      } catch (error) {

        console.error(
          "ERROR OBTENIENDO NOTIFICACIONES WHATSAPP:",
          error
        )

        setError(
          "No se pudieron cargar las notificaciones"
        )

      } finally {

        setLoading(false)

      }

    }

    obtenerNotificaciones()

  }, [apiUrl, solicitudTramiteId])


  // =====================================================
  // FORMATO FECHA COLOMBIA
  // =====================================================

  const formatearFecha = (fecha: string) => {

    return new Intl.DateTimeFormat("es-CO", {
      timeZone: "America/Bogota",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(fecha))

  }


  // =====================================================
  // COLOR ESTADO
  // =====================================================

  const obtenerClaseEstado = (estado: string) => {

    switch (estado?.toUpperCase()) {

      case "ENVIADO":
      case "ENVIADA":
        return "bg-green-100 text-green-700"

      case "PENDIENTE":
        return "bg-yellow-100 text-yellow-700"

      case "ERROR":
      case "FALLIDO":
        return "bg-red-100 text-red-700"

      default:
        return "bg-gray-100 text-gray-700"

    }

  }


  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {

    return (
      <div className="flex items-center justify-center py-10">

        <p className="text-sm text-gray-500">
          Cargando mensajes de WhatsApp...
        </p>

      </div>
    )

  }


  // =====================================================
  // ERROR
  // =====================================================

  if (error) {

    return (
      <div className="flex items-center gap-2 p-4 text-sm text-red-600">

        <AlertCircle size={18} />

        {error}

      </div>
    )

  }


  // =====================================================
  // SIN NOTIFICACIONES
  // =====================================================

  if (notificaciones.length === 0) {

    return (
      <div className="
        flex
        flex-col
        items-center
        justify-center
        py-12
        text-gray-500
      ">

        <MessageCircle
          size={40}
          className="mb-3"
        />

        <p className="text-sm">
          No hay mensajes de WhatsApp enviados
          para esta solicitud.
        </p>

      </div>
    )

  }


  // =====================================================
  // LISTADO
  // =====================================================

  return (

    <div className="space-y-3">

      {notificaciones.map((notificacion) => {

        const abierto =
          notificacionAbierta === notificacion.id

        return (

          <div
            key={notificacion.id}
            className="
              overflow-hidden
              rounded-lg
              border
              border-gray-200
              bg-white
              shadow-sm
              transition
              hover:border-gray-300
            "
          >

            {/* ================================================= */}
            {/* CABECERA CLICKEABLE */}
            {/* ================================================= */}

            <button
              type="button"
              onClick={() =>
                setNotificacionAbierta(
                  abierto ? null : notificacion.id
                )
              }
              className="
                w-full
                text-left
                px-5
                py-4
                hover:bg-gray-50
                transition
              "
            >

              <div className="
                flex
                items-center
                justify-between
                gap-4
              ">

                {/* IZQUIERDA */}

                <div className="
                  flex
                  items-center
                  gap-3
                  min-w-0
                ">

                  <div className="
                    flex
                    h-9
                    w-9
                    shrink-0
                    items-center
                    justify-center
                    rounded-full
                    bg-green-50
                  ">

                    <MessageCircle
                      size={19}
                      className="text-green-600"
                    />

                  </div>


                  <div className="min-w-0">

                    <div className="
                      flex
                      items-center
                      gap-2
                      flex-wrap
                    ">

                      <span className="
                        text-sm
                        font-semibold
                        text-gray-800
                      ">
                        {notificacion.tipo}
                      </span>

                      <span
                        className={`
                          rounded-full
                          px-2.5
                          py-0.5
                          text-[10px]
                          font-semibold
                          uppercase
                          ${obtenerClaseEstado(
                            notificacion.estado
                          )}
                        `}
                      >
                        {notificacion.estado}
                      </span>

                    </div>


                    <div className="
                      mt-1
                      flex
                      flex-wrap
                      items-center
                      gap-x-5
                      gap-y-1
                      text-xs
                      text-gray-500
                    ">

                      <span className="
                        flex
                        items-center
                        gap-1.5
                      ">

                        <User size={14} />

                        <span>
                          {notificacion.destinatario}
                        </span>

                      </span>


                      <span className="
                        flex
                        items-center
                        gap-1.5
                      ">

                        <Clock size={14} />

                        <span>
                          {formatearFecha(
                            notificacion.createdAt
                          )}
                        </span>

                      </span>

                    </div>

                  </div>

                </div>


                {/* DERECHA */}

                <div className="
                  shrink-0
                  text-gray-400
                ">

                  {abierto ? (
                    <ChevronUp size={20} />
                  ) : (
                    <ChevronDown size={20} />
                  )}

                </div>

              </div>

            </button>


            {/* ================================================= */}
            {/* CONTENIDO DEL MENSAJE */}
            {/* ================================================= */}

            {abierto && (

              <div className="
                border-t
                border-gray-100
                bg-gray-50
                px-5
                py-5
              ">

                <div className="
                  mb-3
                  text-[11px]
                  font-semibold
                  uppercase
                  tracking-wide
                  text-gray-500
                ">
                  Mensaje enviado
                </div>


                <div className="
                  rounded-lg
                  border
                  border-gray-200
                  bg-white
                  p-4
                ">

                  <p className="
                    whitespace-pre-line
                    text-sm
                    leading-6
                    text-gray-700
                  ">
                    {notificacion.mensaje}
                  </p>

                </div>


                {/* ERROR */}

                {notificacion.error && (

                  <div className="
                    mt-3
                    rounded-lg
                    border
                    border-red-200
                    bg-red-50
                    p-3
                    text-sm
                    text-red-700
                  ">

                    <strong>
                      Error:
                    </strong>{" "}

                    {notificacion.error}

                  </div>

                )}

              </div>

            )}

          </div>

        )

      })}

    </div>

  )

}