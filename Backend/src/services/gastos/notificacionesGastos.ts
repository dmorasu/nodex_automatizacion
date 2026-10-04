import { Op } from 'sequelize'
import { notificationQueue } from '../../queues/notificacionesQueues'
import Notificacion from '../../models/notificaciones'
import SolicitudesGasto from '../../models/gastos/solicitudesGasto'
import Terceros from '../../models/gastos/terceros'
import Bolsas from '../../models/gastos/bolsas'
import Usuarios from '../../models/usuarios'
import { formatoFecha, formatoMoneda } from './formato'

// Escapa texto del usuario antes de ponerlo en el HTML del correo
const html = (texto: unknown) =>
  String(texto ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

const plantillaGastosPagados = (nombre: string, gastos: SolicitudesGasto[]) => `
  <div style="font-family: Arial, sans-serif; color: #334155; font-size: 14px;">
    <p>Hola ${html(nombre)},</p>
    <p>Tesorería registró el pago de ${gastos.length === 1 ? 'tu gasto' : `${gastos.length} de tus gastos`}:</p>
    <table cellpadding="8" style="border-collapse: collapse; font-size: 13px;">
      <tr style="background: #f1f5f9; text-align: left;">
        <th>Gasto</th><th>Concepto</th><th>Beneficiario</th><th>Bolsa</th><th>Fecha de pago</th><th style="text-align: right;">Valor pagado</th>
      </tr>
      ${gastos.map(g => `
        <tr style="border-top: 1px solid #e2e8f0;">
          <td><b>${html(g.codigo)}</b></td>
          <td>${html(g.conceptoPago)}</td>
          <td>${html(g.beneficiario?.nombre)}</td>
          <td>${html(g.bolsa?.nombre)}</td>
          <td>${formatoFecha(g.fechaPago)}</td>
          <td style="text-align: right;">${formatoMoneda(g.valorRealmentePagado)}</td>
        </tr>`).join('')}
    </table>
    <p style="color: #94a3b8; font-size: 12px;">Nodex Gastos · Mensaje automático, no responder.</p>
  </div>
`

// Avisa por correo a quien creó cada gasto que ya fue pagado.
// Un solo correo por persona aunque se le paguen varios gastos en el lote.
// Se llama DESPUÉS de confirmar la transacción del pago; si falla, el pago no se revierte.
export const notificarGastosPagados = async (gastoIds: number[]) => {
  try {
    const gastos = await SolicitudesGasto.findAll({
      where: { id: { [Op.in]: gastoIds } },
      include: [
        { model: Usuarios, as: 'creador', attributes: ['id', 'nombreUsuario', 'correoUsuario'] },
        { model: Terceros, attributes: ['nombre'] },
        { model: Bolsas, attributes: ['nombre'] }
      ]
    })

    const porCreador = new Map<number, SolicitudesGasto[]>()
    for (const gasto of gastos) {
      porCreador.set(gasto.creadoPor, [...(porCreador.get(gasto.creadoPor) ?? []), gasto])
    }

    for (const gastosCreador of porCreador.values()) {
      const creador = gastosCreador[0].creador
      if (!creador?.correoUsuario) continue

      const subject = gastosCreador.length === 1
        ? `Gasto pagado ${gastosCreador[0].codigo}`
        : `${gastosCreador.length} gastos pagados`
      const mensaje = plantillaGastosPagados(creador.nombreUsuario, gastosCreador)

      const notificacion = await Notificacion.create({
        solicitudTramiteId: null,
        tipo: 'GASTO_PAGADO',
        canal: 'EMAIL',
        destinatario: creador.correoUsuario,
        mensaje,
        estado: 'PENDIENTE'
      })

      await notificationQueue.add('send', {
        notificacionId: notificacion.id,
        canal: 'EMAIL',
        to: creador.correoUsuario,
        subject,
        message: mensaje,
        // Los correos de gastos no van con copia a la torre de control
        ccTorreControl: false
      })
    }
  } catch (error) {
    console.error('⚠️ No se pudieron enviar los correos de gastos pagados:', error)
  }
}
