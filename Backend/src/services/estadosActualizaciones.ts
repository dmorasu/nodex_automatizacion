import { cambiarEstadoTramite } from './estadoTramite'
import { excelDateToString } from '../utils/excelDate'

// Cambio de estado masivo (Excel o gestión en pantalla). Cada fila usa la misma lógica del
// cambio individual: estado actual, finalización y notificaciones. Cada trámite se guarda por
// separado: si una fila falla, las demás quedan aplicadas y la fila se reporta con su error.
export const procesarEstados = async (data: any[]) => {
  const errores: { fila: number, error: string }[] = []

  for (let i = 0; i < data.length; i++) {
    const row = data[i]
    const fila = i + 2

    try {
      await cambiarEstadoTramite({
        solicitudTramiteId: Number(row.solicitudTramiteId),
        estadoId: Number(row.estadoId),
        tipoRechazoId: row.tipoRechazoId ? Number(row.tipoRechazoId) : null,
        // Solo cuenta con Novedad Subsanada Continuar Trámite (celda de fecha o texto)
        fechaEntregaResultado: excelDateToString(row.fechaEntregaResultado)
      })
    } catch (error: any) {
      errores.push({ fila, error: error.message })
      console.error(`❌ Error fila ${fila}:`, error.message)
    }
  }

  return { errores }
}
