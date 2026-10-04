import SolicitudTramites from "../../models/solicitudTramites";
import { correoBase, ficha, html, MARCAS, nota, type DatosCorreo, type Detalle } from "./correoBase";

export type TipoNotificacion =
  | "ASIGNADO"
  | "FINALIZADO"
  | "TRAZABILIDAD"
  | "PROGRAMACION"
  | "EN_ESPERA_POR_NOVEDAD"
  | "LOGISTICA"
  | "DILIGENCIA_HOY"
  | "DILIGENCIA_VENCIDA"
  | "DESISTIDO"
  | "DESISTIDO_SOLICITANTE";

type TemplateData = {
  nombre?: string;
  observacion?: string;
  estado?: string;
  estadoId?: number;
  fecha?: string;
  operacion?: string;
  tipo?: string;
  novedad?: string;
  tipoRechazo?: string;
  tramitador?: string;
  municipio?: string;
  programador?: string;
  resultado?: string;
  valor?: string | number;
  solicitante?: string;
  [key: string]: any;
};

// =====================================
// PIEZAS DE LOS CORREOS DE TRÁMITES
// Base común de Nodex (./correoBase.ts) con el azul de Nodex Trámites.
// =====================================

// Texto del usuario escapado; vacío si no hay dato (la ficha no muestra la fila)
const txt = (valor: unknown) => (valor === null || valor === undefined || valor === "" ? "" : html(valor));

const hola = (nombre?: string) => (nombre ? `Hola <strong>${html(nombre)}</strong>,` : "Hola,");

// Ficha con el consecutivo y la placa o matrícula del trámite arriba
const fichaTramite = (solicitud: SolicitudTramites, detalles: Detalle[]) =>
  ficha({
    titulo: `Trámite #${solicitud.id}`,
    subtitulo: txt(solicitud.placa || solicitud.matriculaInmobiliaria),
    detalles,
  });

// Botón a la app, solo si URL_NODEX_TRAMITES está en el .env
const correoTramite = (datos: Omit<DatosCorreo, "marca" | "boton">) =>
  correoBase({
    ...datos,
    marca: MARCAS.TRAMITES,
    boton: { texto: "Abrir Nodex", url: process.env.URL_NODEX_TRAMITES },
  });

// =====================================
// CONSTRUIR MENSAJE
// =====================================

export const construirMensaje = (
  tipo: TipoNotificacion,
  solicitud: SolicitudTramites,
  data: TemplateData = {},
) => {
  // =====================================
  // ASIGNADO - WHATSAPP
  // =====================================

  if (tipo === "ASIGNADO") {
      return {
                subject: "Diligencia Asignada",

                text: `
          👋 *Hola ${data.nombre || "Tramitador"}!*

              Tienes una diligencia programada por Gómez Pineda Abogados S.A.S. A continuación, te compartimos los detalles:

          🔹 *Detalle de la diligencia:*

             *Solicitud:* $${solicitud.id || "0"}

             • Tipo: ${data.tipo &&"/"&&solicitud.detalleSolicitud || "N/A" }

              Ubicación: ${solicitud.direccionTramite || "N/A"}

             *Placa/Matricula:* ${solicitud.matriculaInmobiliaria || solicitud.placa || "N/A"}

             *Cliente:* ${solicitud.clientes.nombreCliente || "N/A"}

             *Tarifa:* ${solicitud.programacion.valorTramite || "N/A"}

             *Fecha:* ${solicitud.programacion.fechaProbableEntrega|| "N/A"}

             👥 *Asignación*

             *Programador:* ${data.programador || solicitud.municipios?.responsable || "N/A"}
             *Solicitante:* ${solicitud.usuario.nombreUsuario || "N/A"}

          📞 *Soporte*
              ¿Tienes alguna inquietud? Comunícate con la Central Torre de Control:

              ✅ Gracias por tu apoyo y gestión.
                `,

                html: "",
              };
      }

  // =====================================
// DESISTIDO - WHATSAPP
// =====================================

if (tipo === "DESISTIDO") {

  return {

    subject:
      "📢 Diligencia Cancelada",

    text: `
📢 *Diligencia Cancelada*

Hola ${data.nombre || "N/A"},

Te informamos que la siguiente diligencia asignada por Gómez Pineda Abogados S.A.S. ha sido cancelada, por lo que no es necesario continuar con la gestión programada.

📋 *Detalles*

• Tipo: ${data.tipo &&"/"&&solicitud.detalleSolicitud || "N/A" }
• Placa/Matrícula: ${data.mueble || "N/A"}
• Cliente: ${solicitud.clientes?.nombreCliente || "N/A"}
• Número de Solicitud: ${solicitud.id}

👤 *Responsable*

• Programador: ${data.programador || "N/A"}

Si cuentas con documentación o novedades relacionadas con esta diligencia, por favor compártelas a través de los canales habituales de atención.

📞 *Soporte*

Para cualquier inquietud, comunícate con la Central Torre de Control:

🔗 ${data.linkSoporte || "N/A"}

✅ Gracias por tu apoyo y colaboración.
`,

    html: ""

  }

}
  // =====================================
  // DESISTIDO - CORREO A QUIEN CREÓ EL TRÁMITE
  // =====================================

  if (tipo === "DESISTIDO_SOLICITANTE") {
    return {
      subject:
        `🚫 Su Trámite #${solicitud.id} - ` +
        `${solicitud.placa ?? ""} ` +
        `${solicitud.matriculaInmobiliaria ?? ""} ` +
        `fue desistido`,

      text: "",

      html: correoTramite({
        estado: { texto: "Desistido", tono: "peligro" },
        titulo: "Trámite desistido",
        saludo: hola(data.nombre),
        intro: `El trámite <strong>#${solicitud.id}</strong> fue marcado como <strong>desistido</strong>, así que no continuará su gestión.`,
        cuerpo: `
          ${fichaTramite(solicitud, [
            ["Tipo de trámite", txt(data.tipo)],
            ["Cliente", txt(data.cliente)],
            ["Municipio", txt(data.municipio)],
            ["Operación", txt(data.operacion)],
            ["Corresponsal", txt(data.tramitador)],
            ["Programador", txt(data.programador)],
            ["Fecha", txt(data.fecha)],
          ])}
          ${data.motivo ? nota("neutro", txt(data.motivo), "Última observación") : ""}
        `,
      }),
    };
  }

  // =====================================
  // LOGÍSTICA
  // =====================================

  if (tipo === "LOGISTICA") {
    return {
      subject:
        `📦 Envío registrado - Trámite #${solicitud.id} ` +
        `${solicitud.placa ?? ""} ` +
        `${solicitud.matriculaInmobiliaria ?? ""}`,

      text: "",

      html: correoTramite({
        estado: { texto: "Logística", tono: "info" },
        titulo: "Envío documental registrado",
        saludo: hola(data.nombre),
        intro: `El envío documental del trámite <strong>#${solicitud.id}</strong>${data.tipo ? ` (${txt(data.tipo)})` : ""} fue registrado y entregado a la transportadora.`,
        cuerpo: `
          ${fichaTramite(solicitud, [
            ["Número de guía", txt(data.numeroGuia)],
            ["Transportadora", txt(data.transportadora)],
            ["Destinatario", txt(data.destinatario)],
            ["Valor del envío", data.valorEnvio ? `$${txt(data.valorEnvio)}` : null],
            ["Fecha probable de entrega", txt(data.fechaProbableEntrega)],
            ["Entrega por la transportadora", txt(data.fechaEntregaTransportadora)],
          ])}
          ${nota("info", "El envío se encuentra en proceso de distribución.")}
        `,
      }),
    };
  }

  // =====================================
  // FINALIZADO
  // =====================================

  if (tipo === "FINALIZADO") {
    return {
      subject:
        `✅ Su Trámite #${solicitud.id} - ` +
        `${solicitud.placa ?? ""} ` +
        `${solicitud.matriculaInmobiliaria ?? ""} ` +
        `ha sido finalizado`,

      text: "",

      html: correoTramite({
        estado: { texto: "Finalizado", tono: "exito" },
        titulo: "Trámite finalizado",
        saludo: hola(data.nombre),
        intro: `El trámite <strong>#${solicitud.id}</strong> fue finalizado exitosamente.`,
        cuerpo: `
          ${fichaTramite(solicitud, [
            ["Tipo de diligencia", txt(data.tipo)],
            ["Fecha de finalización", txt(data.fecha)],
            ["Corresponsal", txt(data.tramitador)],
            ["Municipio", txt(data.municipio)],
            ["Programador", txt(data.programador)],
          ])}
          ${nota("neutro", txt(data.resultado) || "Sin resultado", "Resultado")}
          ${nota("exito", "Los soportes ya fueron cargados en la carpeta del trámite.")}
        `,
      }),
    };
  }

  // =====================================
  // TRAZABILIDAD
  // =====================================

  if (tipo === "TRAZABILIDAD") {
    const observacion = (data.observacion || "Sin detalle").toString().slice(0, 500);

    return {
      subject: "📌 Nueva trazabilidad",

      text: observacion,

      html: correoTramite({
        estado: { texto: "Trazabilidad", tono: "info" },
        titulo: "Nueva actualización",
        intro: `Se registró una nueva actualización en el trámite <strong>#${solicitud.id}</strong>.`,
        cuerpo: `
          ${fichaTramite(solicitud, [["Estado actual", txt(data.estado) || "Sin estado"]])}
          ${nota("neutro", txt(observacion), "Observación")}
        `,
      }),
    };
  }

  // =====================================
  // PROGRAMACIÓN
  // =====================================

  if (tipo === "PROGRAMACION") {
    return {
      subject:
        `📅 Su Trámite #${solicitud.id} - ` +
        `${solicitud.placa ?? ""} ` +
        `${solicitud.matriculaInmobiliaria ?? ""} ` +
        `ha sido programado`,

      text: "",

      html: correoTramite({
        estado: { texto: "Programado", tono: "info" },
        titulo: "Diligencia programada",
        saludo: hola(data.nombre),
        intro: `La diligencia del trámite <strong>#${solicitud.id}</strong> fue programada.`,
        cuerpo: `
          ${fichaTramite(solicitud, [
            ["Tipo de diligencia", txt(data.tipo)],
            ["Fecha programada", txt(data.fecha) || "Pendiente"],
            ["Corresponsal", txt(data.tramitador)],
            ["Municipio", txt(data.municipio)],
            ["Operación", txt(data.operacion)],
            ["Programador", txt(data.programador)],
          ])}
          ${nota("info", "Ten presente la fecha programada para la realización de la diligencia.")}
        `,
      }),
    };
  }

  // =====================================
  // EN ESPERA POR NOVEDAD
  // =====================================

  if (tipo === "EN_ESPERA_POR_NOVEDAD") {
    if (Number(data.estadoId) === 3) {
      return {
        subject:
          `⚠️ Su Trámite ${data.tipo || ""} ` +
          `con consecutivo #${solicitud.id} – ` +
          `${solicitud.placa || "Sin placa"} / ` +
          `${solicitud.matriculaInmobiliaria || "Sin matrícula"} ` +
          `presenta novedad`,

        text: "",

        html: correoTramite({
          estado: { texto: "Requiere atención", tono: "alerta" },
          titulo: "Trámite con novedad",
          saludo: hola(data.nombre),
          intro: `El trámite <strong>#${solicitud.id}</strong> presenta una novedad que requiere gestión.`,
          cuerpo: `
            ${fichaTramite(solicitud, [
              ["Tipo de trámite", txt(data.tipo)],
              ["Tipo de rechazo", txt(data.tipoRechazo) || "Sin tipo de rechazo"],
              ["Corresponsal", txt(data.tramitador)],
              ["Municipio", txt(data.municipio)],
              ["Programador", txt(data.programador)],
              ["Operación", txt(data.operacion)],
              ["Reprogramación", "Pendiente de subsanación"],
            ])}
            ${nota("neutro", txt(data.novedad) || "Sin observaciones", "Novedad reportada")}
            ${nota("alerta", 'Una vez subsanada la novedad, actualiza el estado del trámite en <strong>Nodex</strong> a <strong>"Novedad Subsanada"</strong> para dar continuidad al proceso.', "Acción requerida")}
          `,
        }),
      };
    }

    // =====================================
    // FALLBACK
    // =====================================

    return {
      subject: "🔄 En Espera por Novedad",

      text: "",

      html: correoTramite({
        estado: { texto: "En espera", tono: "alerta" },
        titulo: "En espera por novedad",
        intro: `El trámite <strong>#${solicitud.id}</strong> se encuentra en espera por una novedad.`,
        cuerpo: fichaTramite(solicitud, [["Nuevo estado", txt(data.estado) || "Sin estado"]]),
      }),
    };
  }

  // =====================================
// DILIGENCIA PROGRAMADA PARA HOY
// WHATSAPP
// =====================================

if (tipo === "DILIGENCIA_HOY") {

  return {

    subject:
      "📢 Diligencia Programada para Hoy",

    text: `
📢 *Diligencia Programada para Hoy*

Hola ${data.nombre || "N/A"},

Te recordamos que hoy tienes una diligencia programada por Gómez Pineda Abogados S.A.S.

📋 *Detalles*

•• Tipo: ${data.tipo &&"/"&&solicitud.detalleSolicitud || "N/A" }
• Placa/Matrícula: ${data.mueble || "N/A"}
• Ubicación: ${data.ubicacion || "N/A"}
• Número de Solicitud: ${solicitud.id}
• Estado: En Curso

👤 *Responsable*

• Programador: ${data.programador || "N/A"}

📞 *Soporte*

Recuerda cargar los soportes correspondientes y reportar cualquier novedad durante la gestión.

Si requieres apoyo, comunícate con la Central Torre de Control:

🔗 ${data.linkSoporte || "N/A"}

✅ Gracias por tu gestión. Te deseamos una excelente jornada.
`,

    html: ""

  }

}


// =====================================
// DILIGENCIA VENCIDA
// WHATSAPP
// =====================================

if (tipo === "DILIGENCIA_VENCIDA") {

  return {

    subject:
      "📢 Actualización de Diligencia Pendiente",

    text: `
📢 *Actualización de Diligencia Pendiente*

Hola ${data.nombre || "N/A"},

Observamos que la diligencia programada por Gómez Pineda Abogados S.A.S. ya superó la fecha prevista. Agradecemos nos compartas una actualización sobre su estado.

📋 *Detalles*

• Tipo: ${data.tipo &&"/"&&solicitud.detalleSolicitud || "N/A" }
• Placa/Matrícula: ${data.mueble || "N/A"}
• Ubicación: ${data.ubicacion || "N/A"}
• Número de Solicitud: ${solicitud.id}
• Estado: En Curso - Vencida
• Fecha Programada: ${data.fecha || "N/A"}

👤 *Responsable*

• Programador: ${data.programador || "N/A"}

📞 *Soporte*

Recuerda cargar los soportes correspondientes y reportar cualquier novedad durante la gestión.

Si requieres apoyo, comunícate con la Central Torre de Control:

🔗 ${data.linkSoporte || "N/A"}

✅ Gracias por tu gestión. Te deseamos una excelente jornada.
`,

    html: ""

  }

}

  // =====================================
  // TIPO NO SOPORTADO
  // =====================================

  throw new Error(`Tipo de notificación no soportado: ${tipo}`);
};
