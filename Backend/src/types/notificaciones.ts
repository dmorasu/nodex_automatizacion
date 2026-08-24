// types/notification.ts

export type NotificacionParams = {
  solicitud: any
  tipo: 'ASIGNADO' | 'FINALIZADO' | 'TRAZABILIDAD' | 'PROGRAMACION' | 'EN_ESPERA_POR_NOVEDAD'| 'LOGISTICA'
  destinatario: any 
  data?: {
    observacion?: string
    [key: string]: any
  }
}