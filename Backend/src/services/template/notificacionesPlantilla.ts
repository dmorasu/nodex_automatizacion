import SolicitudTramites from '../../models/solicitudTramites'

export type TipoNotificacion =
  | 'ASIGNADO'
  | 'FINALIZADO'
  | 'TRAZABILIDAD'
  | 'PROGRAMACION'
  | 'EN_ESPERA_POR_NOVEDAD'
  | 'LOGISTICA'


type TemplateData = {
  nombre?: string
  observacion?: string
  estado?: string
  estadoId?: number
  fecha?: string
  operacion?: string
  tipo?: string
  novedad?: string
  tipoRechazo?: string
  tramitador?: string
  municipio?: string
  programador?: string
  resultado?: string
  valor?: string | number
  solicitante?: string
  [key: string]: any
}

// =====================================
// COMPONENTES VISUALES PARA EMAIL
// =====================================

const badge = (texto: string, tipo = 'blue') => {
  const colores: Record<string, { bg: string; color: string }> = {
    blue: {
      bg: '#e0f2fe',
      color: '#0369a1'
    },
    green: {
      bg: '#dcfce7',
      color: '#15803d'
    },
    orange: {
      bg: '#ffedd5',
      color: '#c2410c'
    },
    red: {
      bg: '#fee2e2',
      color: '#dc2626'
    },
    gray: {
      bg: '#f3f4f6',
      color: '#4b5563'
    }
  }

  const color = colores[tipo] || colores.blue

  return `
    <span
      style="
        display:inline-block;
        background:${color.bg};
        color:${color.color};
        padding:7px 12px;
        border-radius:999px;
        font-size:12px;
        font-weight:700;
      "
    >
      ${texto}
    </span>
  `
}

const infoCard = (
  icono: string,
  titulo: string,
  valor: string | number
) => `
  <tr>
    <td
      style="
        padding:12px 0;
        border-bottom:1px solid #e5e7eb;
      "
    >
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td width="42" valign="top">
            <div
              style="
                width:34px;
                height:34px;
                line-height:34px;
                text-align:center;
                background:#eff6ff;
                border-radius:10px;
                font-size:16px;
              "
            >
              ${icono}
            </div>
          </td>

          <td valign="top">
            <div
              style="
                font-size:12px;
                color:#64748b;
                margin-bottom:3px;
                font-weight:600;
              "
            >
              ${titulo}
            </div>

            <div
              style="
                font-size:14px;
                color:#0f172a;
                font-weight:700;
                line-height:1.4;
              "
            >
              ${valor || 'N/A'}
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
`

const detailsBox = (content: string) => `
  <table
    width="100%"
    cellpadding="0"
    cellspacing="0"
    style="
      margin-top:20px;
      background:#ffffff;
      border:1px solid #e2e8f0;
      border-radius:16px;
    "
  >
    <tr>
      <td style="padding:8px 22px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          ${content}
        </table>
      </td>
    </tr>
  </table>
`

// =====================================
// LAYOUT CORPORATIVO MODERNO
// =====================================

const layout = (
  content: string,
  options?: {
    title?: string
    subtitle?: string
    status?: string
    statusType?: string
  }
) => `
<!DOCTYPE html>
<html lang="es">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>

<body
  style="
    margin:0;
    padding:0;
    background:#f1f5f9;
    font-family:Arial, Helvetica, sans-serif;
    color:#334155;
  "
>

  <div
    style="
      width:100%;
      background:#f1f5f9;
      padding:35px 15px;
      box-sizing:border-box;
    "
  >

    <table
      width="100%"
      cellpadding="0"
      cellspacing="0"
      style="
        max-width:720px;
        margin:0 auto;
        background:#ffffff;
        border-radius:22px;
        overflow:hidden;
        box-shadow:0 15px 40px rgba(15,23,42,0.08);
      "
    >

      <!-- HEADER -->

      <tr>
        <td
          style="
            background:linear-gradient(135deg,#0f172a 0%,#1d4ed8 55%,#0ea5e9 100%);
            padding:28px 32px;
          "
        >

          <table width="100%" cellpadding="0" cellspacing="0">

            <tr>

              <td valign="middle">

                <table cellpadding="0" cellspacing="0">
                  <tr>

                    <td valign="middle">

                      <div
                        style="
                          background:#ffffff;
                          border-radius:14px;
                          padding:8px 12px;
                          display:inline-block;
                        "
                      >
                        <img
                          src="https://gomezpineda.com/wp-content/uploads/2023/09/GP-L-01.png"
                          alt="Gómez Pineda Abogados"
                          style="
                            max-width:115px;
                            display:block;
                          "
                        />
                      </div>

                    </td>

                    <td width="16"></td>

                    <td valign="middle">

                      <div
                        style="
                          color:#ffffff;
                          font-size:22px;
                          font-weight:800;
                          letter-spacing:1px;
                        "
                      >
                        NODEX
                      </div>

                      <div
                        style="
                          color:#bfdbfe;
                          font-size:11px;
                          margin-top:3px;
                          letter-spacing:1px;
                        "
                      >
                        CONTROL DE GESTIÓN
                      </div>

                    </td>

                  </tr>
                </table>

              </td>

              <td
                align="right"
                valign="middle"
              >
                ${
                  options?.status
                    ? badge(
                        options.status,
                        options.statusType || 'blue'
                      )
                    : ''
                }
              </td>

            </tr>

          </table>

        </td>
      </tr>


      <!-- TITULO -->

      ${
        options?.title
          ? `
          <tr>
            <td style="padding:30px 32px 10px 32px;">

              <div
                style="
                  font-size:25px;
                  font-weight:800;
                  color:#0f172a;
                  line-height:1.3;
                "
              >
                ${options.title}
              </div>

              ${
                options.subtitle
                  ? `
                    <div
                      style="
                        margin-top:8px;
                        font-size:14px;
                        color:#64748b;
                        line-height:1.6;
                      "
                    >
                      ${options.subtitle}
                    </div>
                  `
                  : ''
              }

            </td>
          </tr>
        `
          : ''
      }


      <!-- CONTENIDO -->

      <tr>
        <td
          style="
            padding:20px 32px 35px 32px;
          "
        >

          ${content}

        </td>
      </tr>


      <!-- FOOTER -->

      <tr>

        <td
          style="
            background:#f8fafc;
            border-top:1px solid #e2e8f0;
            padding:25px 32px;
            text-align:center;
          "
        >

          <div
            style="
              font-size:13px;
              color:#475569;
              line-height:1.6;
            "
          >
            Este mensaje fue generado automáticamente por
            <strong style="color:#1d4ed8;">
              NODEX
            </strong>
          </div>

          <div
            style="
              margin-top:7px;
              font-size:11px;
              color:#94a3b8;
            "
          >
            Por favor, no responder directamente a este correo.
          </div>

        </td>

      </tr>

    </table>

  </div>

</body>

</html>
`

// =====================================
// CONSTRUIR MENSAJE
// =====================================

export const construirMensaje = (
  tipo: TipoNotificacion,
  solicitud: SolicitudTramites,
  data: TemplateData = {}
) => {

  // =====================================
  // ASIGNADO - WHATSAPP
  // =====================================

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

*¡Un saludo!*
      `,

      html: ''
    }
  }
 // =====================================
  // LOGÍSTICA
  // =====================================

  if (tipo === 'LOGISTICA') {

    return {

      subject:
        `📦 Envío registrado - Trámite #${solicitud.id} ` +
        `${solicitud.placa ?? ''} ` +
        `${solicitud.matriculaInmobiliaria ?? ''}`,

      text: '',

      html: layout(

        `
        <p
          style="
            font-size:15px;
            color:#475569;
            line-height:1.7;
            margin-top:0;
          "
        >
          📢 Hola <strong>${data.nombre || ''}</strong>,
        </p>

        <p
          style="
            font-size:15px;
            color:#475569;
            line-height:1.7;
          "
        >
          Tu envío documental correspondiente al consecutivo
          <strong>#${solicitud.id}</strong>,
          asociado a
          <strong>
            ${
              solicitud.placa ||
              solicitud.matriculaInmobiliaria ||
              'N/A'
            }
          </strong>
          y al trámite
          <strong>${data.tipo || 'N/A'}</strong>,
          ha sido registrado exitosamente. ✅
        </p>

        <p
          style="
            font-size:16px;
            font-weight:700;
            color:#0f172a;
            margin-top:25px;
            margin-bottom:10px;
          "
        >
          📌 Detalles de la programación logística
        </p>

        ${detailsBox(`

          ${infoCard(
            '📦',
            'Número de guía',
            data.numeroGuia || 'N/A'
          )}

          ${infoCard(
            '💰',
            'Valor del envío',
            data.valorEnvio
              ? `$${data.valorEnvio}`
              : 'N/A'
          )}

          ${infoCard(
            '🚛',
            'Transportadora',
            data.transportadora || 'N/A'
          )}

          ${infoCard(
            '👤',
            'Destinatario',
            data.destinatario || 'N/A'
          )}

          ${infoCard(
            '📅',
            'Fecha probable de entrega',
            data.fechaProbableEntrega || 'N/A'
          )}

          ${infoCard(
            '📅',
            'Fecha de entrega por la transportadora',
            data.fechaEntregaTransportadora || 'N/A'
          )}

        `)}

        <div
          style="
            margin-top:22px;
            padding:18px;
            background:#eff6ff;
            border:1px solid #bfdbfe;
            border-radius:14px;
            color:#1e40af;
            font-size:14px;
            line-height:1.7;
          "
        >
          ✅ Tu envío ha sido entregado a la transportadora y se encuentra
          en proceso de distribución.
        </div>

        <p
          style="
            margin-top:22px;
            font-size:14px;
            color:#64748b;
            text-align:center;
          "
        >
          ¡Gracias por tu atención!
        </p>
        `,

        {
          title: '📦 Envío documental registrado',

          subtitle:
            `Información logística del trámite #${solicitud.id}`,

          status: 'LOGÍSTICA',

          statusType: 'blue'
        }
      )
    }
  }

  // =====================================
  // FINALIZADO
  // =====================================

  if (tipo === 'FINALIZADO') {

    return {
      subject:
        `✅ Su Trámite #${solicitud.id} - ` +
        `${solicitud.placa ?? ''} ` +
        `${solicitud.matriculaInmobiliaria ?? ''} ` +
        `ha sido finalizado`,

      text: '',

      html: layout(

        `
        <p
          style="
            font-size:15px;
            line-height:1.7;
            color:#475569;
            margin:0;
          "
        >
          Hola <strong>${data.nombre || ''}</strong>, queremos informarte que
          el trámite <strong>#${solicitud.id}</strong> ha sido finalizado
          exitosamente.
        </p>

        ${detailsBox(`

          ${infoCard(
            '📋',
            'Tipo de diligencia',
            data.tipo || 'N/A'
          )}

          ${infoCard(
            '📌',
            'Resultado',
            data.resultado || 'Sin resultado'
          )}

          ${infoCard(
            '📅',
            'Fecha de finalización',
            data.fecha || 'N/A'
          )}

          ${infoCard(
            '🧑‍💼',
            'Corresponsal',
            data.tramitador || 'N/A'
          )}

          ${infoCard(
            '📍',
            'Municipio',
            data.municipio || 'N/A'
          )}

          ${infoCard(
            '👤',
            'Programador',
            data.programador || 'N/A'
          )}

        `)}

        <div
          style="
            margin-top:20px;
            padding:16px;
            background:#ecfdf5;
            border:1px solid #bbf7d0;
            border-radius:14px;
            color:#166534;
            font-size:14px;
            line-height:1.6;
          "
        >
          📎 Los soportes ya han sido cargados en la carpeta del trámite.
        </div>

        <p
          style="
            margin-top:22px;
            font-size:14px;
            color:#64748b;
            text-align:center;
          "
        >
          Gracias por tu confianza.
        </p>
        `,

        {
          title: 'Trámite finalizado',
          subtitle: `Consecutivo #${solicitud.id}`,
          status: 'FINALIZADO',
          statusType: 'green'
        }
      )
    }
  }


  // =====================================
  // TRAZABILIDAD
  // =====================================

  if (tipo === 'TRAZABILIDAD') {

    const observacion = (
      data.observacion || 'Sin detalle'
    )
      .toString()
      .slice(0, 500)
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

    return {
      subject: '📌 Nueva trazabilidad',

      text: observacion,

      html: layout(

        `
        <p
          style="
            font-size:15px;
            color:#475569;
            line-height:1.7;
            margin-top:0;
          "
        >
          Se ha registrado una nueva actualización para el trámite
          <strong>#${solicitud.id}</strong>.
        </p>

        ${detailsBox(`

          ${infoCard(
            '🆔',
            'Consecutivo',
            `#${solicitud.id}`
          )}

          ${infoCard(
            '🔄',
            'Estado actual',
            data.estado || 'Sin estado'
          )}

        `)}

        <div
          style="
            margin-top:20px;
            background:#f8fafc;
            border-left:4px solid #0ea5e9;
            border-radius:12px;
            padding:18px;
          "
        >

          <div
            style="
              font-size:12px;
              font-weight:700;
              color:#0369a1;
              text-transform:uppercase;
              margin-bottom:8px;
            "
          >
            Observación
          </div>

          <div
            style="
              color:#334155;
              font-size:14px;
              line-height:1.7;
            "
          >
            ${observacion}
          </div>

        </div>
        `,

        {
          title: 'Nueva actualización',
          subtitle: 'Se ha registrado una nueva trazabilidad',
          status: 'TRAZABILIDAD',
          statusType: 'blue'
        }
      )
    }
  }


  // =====================================
  // PROGRAMACIÓN
  // =====================================

  if (tipo === 'PROGRAMACION') {

    return {
      subject:
        `📅 Su Trámite #${solicitud.id} - ` +
        `${solicitud.placa ?? ''} ` +
        `${solicitud.matriculaInmobiliaria ?? ''} ` +
        `ha sido programado`,

      text: '',

      html: layout(

        `
        <p
          style="
            font-size:15px;
            color:#475569;
            line-height:1.7;
            margin-top:0;
          "
        >
          Hola <strong>${data.nombre || ''}</strong>. Tu diligencia con
          consecutivo <strong>#${solicitud.id}</strong> ha sido programada.
        </p>

        ${detailsBox(`

          ${infoCard(
            '📋',
            'Tipo de diligencia',
            data.tipo || 'N/A'
          )}

          ${infoCard(
            '📅',
            'Fecha programada',
            data.fecha || 'Pendiente'
          )}

          ${infoCard(
            '🧑‍💼',
            'Corresponsal',
            data.tramitador || 'N/A'
          )}

          ${infoCard(
            '📍',
            'Municipio',
            data.municipio || 'N/A'
          )}

          ${infoCard(
            '🏢',
            'Operación',
            data.operacion || 'N/A'
          )}

          ${infoCard(
            '👤',
            'Programador',
            data.programador || 'N/A'
          )}

        `)}

        <div
          style="
            margin-top:22px;
            padding:16px;
            background:#eff6ff;
            border:1px solid #bfdbfe;
            border-radius:14px;
            color:#1e40af;
            text-align:center;
            font-size:14px;
          "
        >
          📅 Por favor, ten presente la fecha programada para la realización
          de la diligencia.
        </div>
        `,

        {
          title: 'Diligencia programada',
          subtitle: `Trámite #${solicitud.id}`,
          status: 'PROGRAMADO',
          statusType: 'blue'
        }
      )
    }
  }


  // =====================================
  // EN ESPERA POR NOVEDAD
  // =====================================

  if (tipo === 'EN_ESPERA_POR_NOVEDAD') {

    if (Number(data.estadoId) === 3) {

      return {

        subject:
          `⚠️ Su Trámite ${data.tipo || ''} ` +
          `con consecutivo #${solicitud.id} – ` +
          `${solicitud.placa || 'Sin placa'} / ` +
          `${solicitud.matriculaInmobiliaria || 'Sin matrícula'} ` +
          `presenta novedad`,

        text: '',

        html: layout(

          `
          <p
            style="
              font-size:15px;
              color:#475569;
              line-height:1.7;
              margin-top:0;
            "
          >
            Hola <strong>${data.nombre || ''}</strong>, queremos informarte que
            el trámite <strong>#${solicitud.id}</strong> presenta una novedad
            que requiere gestión.
          </p>

          ${detailsBox(`

            ${infoCard(
              '📋',
              'Tipo de trámite',
              data.tipo || 'N/A'
            )}

            ${infoCard(
              '⚠️',
              'Novedad reportada',
              data.novedad || 'Sin observaciones'
            )}

            ${infoCard(
              '🚫',
              'Tipo de rechazo',
              data.tipoRechazo || 'Sin tipo de rechazo'
            )}

            ${infoCard(
              '📅',
              'Reprogramación',
              'Pendiente de subsanación'
            )}

            ${infoCard(
              '🧑‍💼',
              'Corresponsal',
              data.tramitador || 'N/A'
            )}

            ${infoCard(
              '📍',
              'Municipio',
              data.municipio || 'N/A'
            )}

            ${infoCard(
              '👤',
              'Programador',
              data.programador || 'N/A'
            )}

            ${infoCard(
              '🏢',
              'Operación',
              data.operacion || 'N/A'
            )}

          `)}

          <div
            style="
              margin-top:22px;
              padding:18px;
              background:#fff7ed;
              border:1px solid #fed7aa;
              border-radius:14px;
              color:#9a3412;
              font-size:14px;
              line-height:1.7;
            "
          >
            <strong>Acción requerida</strong>
            <br /><br />

            Agradecemos gestionar la novedad. Una vez haya sido subsanada,
            por favor actualiza el estado del trámite en
            <strong>NODEX</strong> a
            <strong>"Novedad Subsanada"</strong> para dar continuidad al
            proceso.
          </div>
          `,

          {
            title: 'Trámite con novedad',
            subtitle: `Consecutivo #${solicitud.id}`,
            status: 'REQUIERE ATENCIÓN',
            statusType: 'orange'
          }
        )
      }
    }


    // =====================================
    // FALLBACK
    // =====================================

    return {

      subject: '🔄 En Espera por Novedad',

      text: '',

      html: layout(

        `
        <p
          style="
            font-size:15px;
            color:#475569;
            line-height:1.7;
          "
        >
          El trámite <strong>#${solicitud.id}</strong> se encuentra actualmente
          en espera por una novedad.
        </p>

        ${detailsBox(`

          ${infoCard(
            '🆔',
            'Trámite',
            `#${solicitud.id}`
          )}

          ${infoCard(
            '🔄',
            'Nuevo estado',
            data.estado || 'Sin estado'
          )}

        `)}
        `,

        {
          title: 'En espera por novedad',
          subtitle: `Trámite #${solicitud.id}`,
          status: 'EN ESPERA',
          statusType: 'orange'
        }
      )
    }
  }
  

  // =====================================
  // TIPO NO SOPORTADO
  // =====================================

  throw new Error(
    `Tipo de notificación no soportado: ${tipo}`
  )
}