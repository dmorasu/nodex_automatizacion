import SolicitudTramites from '../../models/solicitudTramites'

export type TipoNotificacion =
  | 'ASIGNADO'
  | 'FINALIZADO'
  | 'TRAZABILIDAD'
  | 'PROGRAMACION'
  | 'CAMBIO_ESTADO'

type TemplateData = {
  observacion?: string
  estado?: string
  fecha?: string
  operacion?:string
  [key: string]: any
}

// 🔥 LAYOUT CORPORATIVO FINAL
const layout = (content: string) => `
<div style="background:#f3f4f6;padding:30px;font-family:Arial, sans-serif;">
  <div style="max-width:750px;margin:auto;background:#ffffff;border-radius:12px;padding:30px;border:1px solid #e5e7eb;">
    
    <!-- HEADER LOGO + NODEX -->
    <div style="display:flex;align-items:center;justify-content:center;gap:15px;margin-bottom:15px;">
      
      <img 
        src="https://gomezpineda.com/wp-content/uploads/2023/09/GP-L-01.png"
        alt="Gómez Pineda Abogados"
        style="max-width:140px;"
      />

      <div style="font-size:22px;font-weight:bold;color:#1d4ed8;">
        NODEX
      </div>

    </div>

    <!-- LINEA DORADA -->
    <div style="height:3px;background:#c9a857;width:100%;margin-bottom:20px;"></div>

    ${content}

    

    <!-- FIRMA -->
    <p style="margin-top:15px;font-size:14px;color:#374151;text-align:center;">
      Cordialmente,<br/>
      <b style="color:#1d4ed8;">Gómez Pineda Abogados</b>
    </p>

    <!-- AVISO -->
    <p style="margin-top:20px;font-size:12px;color:#6b7280;text-align:center;">
      ⚙️ Este es un mensaje automático generado por el sistema.<br/>
      Por favor, no responder a este correo.
    </p>

  </div>
</div>
`

export const construirMensaje = (
  tipo: TipoNotificacion,
  solicitud: SolicitudTramites,
  data: TemplateData = {}
) => {
// =========================
// ✅ ASIGNADO (WHATSAPP)
// =========================
if (tipo === 'ASIGNADO') {
  return {
    subject: 'Asignación de diligencia',
    text: `
👋 *Hola ${data.nombre || 'Tramitador'}!*, buen día 😊

Te escribo para solicitar tu apoyo con la siguiente diligencia:

🔹 *Detalle de la diligencia:*
💰 *Valor Honorarios:* $${data.valor || '0'}
📅 *Fecha de realización:* ${data.fecha || 'Pendiente'}

🧑‍💼 Nombre del solicitante: ${data.solicitante || 'N/A'}
📌 *Consecutivo del trámite:* ${solicitud.id}
👤 *Programador:* ${data.programador || 'N/A'}

*¡Un saludo!.*
    `,
    html: ''
  }
}

  if (tipo === 'FINALIZADO') {
  return {
    subject: '✅ Diligencia finalizada',
    text: '',
    html: layout(`
      <h2>📢 ¡Hola ${data.nombre || ''}!</h2>

      <p>
        Tu diligencia con consecutivo <b>#${solicitud.id} - ${solicitud.placa??""} ${solicitud.matriculaInmobiliaria??""}</b> ha sido finalizada exitosamente ✅
      </p>

      <h3>📌 Detalles:</h3>

      <p>🔹 Tipo de diligencia: ${data.tipo || ''}</p>
      <p>📌 Resultado: ${data.resultado || ''}</p>
      <p>📅 Fecha en la que se Finaliza el Servicio: ${data.fecha || ''}</p>
      <p>🧑‍💼 Corresponsal: ${data.tramitador || ''}</p>
      <p>🏙️ Municipio: ${data.municipio || ''}</p>
      <p>👤 Programador: ${data.programador || ''}</p>

      <p>📎 Los soportes ya han sido cargados en la carpeta del Trámite
      <p>📞 Si tienes alguna inquietud, contáctanos.</p>

      <p>¡Gracias por tu confianza! 😊</p>
    `)
  }
}

  // =========================
  // TRAZABILIDAD
  // =========================
  if (tipo === 'TRAZABILIDAD') {
    const observacion = (data?.observacion || 'Sin detalle')
      .toString()
      .slice(0, 500)
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")

    return {
      subject: '📌 Nueva trazabilidad',
      text: observacion,
      html: layout(`
  <h2 style="color:#1d4ed8;">📌 Nueva trazabilidad</h2>

  <p><b>🆔 Trámite:</b> ${solicitud.id} - ${solicitud.placa??""} ${solicitud.matriculaInmobiliaria??""}</b></p>

  <p><b>🔄 Estado actual:</b> ${data.estado || 'Sin estado'}</p>

  <div style="background:#f9fafb;padding:15px;border-radius:8px;border:1px solid #e5e7eb;">
    ${observacion}
  </div>
`)
    }
  }

 if (tipo === 'PROGRAMACION') {
  return {
    subject: `📅 Su Trámite  #${solicitud.id} - ${solicitud.placa??""} ${solicitud.matriculaInmobiliaria??""} ha sido programado `,
    text: '',
    html: layout(`
      <h2>📢 ¡Hola ${data.nombre || ''}!</h2>

      <p>
        Tu diligencia con consecutivo <b>#${solicitud.id} - ${solicitud.placa??""} ${solicitud.matriculaInmobiliaria??""}</b> ha sido programada ✅
      </p>

      <h3>📌 Detalles de la programación:</h3>

      <p>🔹 Tipo de diligencia: ${data.tipo || ''}</p>
      <p>📅 Fecha en la que se realizará la Diligencia:: ${data.fecha || ''}</p>
      <p>🧑‍💼 Corresponsal: ${data.tramitador || ''}</p>
      <p>🏙️ Municipio: ${data.municipio || ''}</p>
      <p>👤 Operación: ${data.operacion || ''}</p>
      <p>👤 Programador: ${data.programador || ''}</p>

      
      <p>¡Gracias por tu atención!</p>
    `)
  }
}
  if (tipo === 'CAMBIO_ESTADO') {

  // 🔥 CASO NOVEDAD (ID = 3)
  if (data.estadoId === 3) {
    return {
      subject: '⚠️ Novedad en diligencia',
      text: '',
      html: layout(`
        <h2>📢 ¡Hola ${data.nombre || ''}!</h2>

        <p>
          Queremos informarte que tu diligencia con consecutivo <b>#${solicitud.id} - ${solicitud.placa??""} ${solicitud.matriculaInmobiliaria??""}</b> presenta una novedad ⚠️
        </p>

        <h3>📌 Detalles de la diligencia:</h3>

        <p>⚠️ Novedad: ${data.novedad || ''}</p>
        <p>📅 Fecha de reprogramación: Pendiente de la subsanación para programación  </p>
        <p>🧑‍💼 Corresponsal: ${data.tramitador || ''}</p>
        <p>🏙️ Municipio: ${data.municipio || ''}</p>
        <p>👤 Programador: ${data.programador || ''}</p>
        <p>🏙️ Operación ${data.operacion || ''}</p>
        <p>
          Resolver la novedad e informarnos para dar continuidad al trámite 😊
        </p>
      `)
    }
  }

  // 🔥 OTROS ESTADOS
  return {
    subject: '🔄 Cambio de estado',
    text: '',
    html: layout(`
      <h2>🔄 Cambio de estado</h2>
      <p>Trámite #${solicitud.id}</p>
      <p>Nuevo estado: ${data.estado || ''}</p>
    `)
  }
}

  throw new Error('Tipo de notificación no soportado')
}