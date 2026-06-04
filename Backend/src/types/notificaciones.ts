// types/notification.ts

export type NotificacionParams = {
  solicitud: any
  tipo: 'ASIGNADO' | 'FINALIZADO' | 'TRAZABILIDAD' | 'PROGRAMACION' | 'CAMBIO_ESTADO'
  destinatario: any
  data?: {
    observacion?: string
    [key: string]: any
  }
}