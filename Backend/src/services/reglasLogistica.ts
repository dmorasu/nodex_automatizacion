import type { Transaction } from 'sequelize'
import Logistica from '../models/logistica'
import SolicitudTramites from '../models/solicitudTramites'
import Transportadora from '../models/trasnportadora'
import Usuarios from '../models/usuarios'
import Tramite from '../models/tramite'
import { crearNotificacion } from './notificacionesServices'

// =====================================
// REGLAS DE LA LOGÍSTICA DEL TRÁMITE (pedido de Torre de control, 2026-11-04)
//  · Pago contra entrega "Sí": no hay valor del envío (lo paga quien recibe). "No": el valor es obligatorio.
//  · La fecha probable de entrega es obligatoria.
//  · La gestión del envío se puede finalizar sin la fecha de entrega de la transportadora: mientras
//    falte, el trámite sigue en "Seguimiento logístico" del Tablero de gestión (tableroTramites.ts).
//  · Al registrar la fecha de entrega de la transportadora sale el correo "Envío entregado" a quien
//    creó el trámite (venga de la ficha, el Excel o la gestión masiva: hook del modelo).
// Se aplican en la ficha (LogisticaController), el Excel y la gestión masiva (validarLogistica).
// El rótulo de envío sigue creando la logística parcial (transportadora y destinatario) como antes.
// =====================================

// "Sí"/"No" de formularios y del Excel
export const esSi = (valor: unknown) =>
  valor === true || ['si', 'sí', 's', 'true', '1', 'x'].includes(String(valor ?? '').trim().toLowerCase())

const vacio = (valor: unknown) => valor === null || valor === undefined || String(valor).trim() === ''

// Errores de la logística tal como quedaría guardada (vacío = se puede guardar)
export const erroresLogistica = (datos: { pagoContraEntrega?: unknown, valorEnvio?: unknown, fechaProgramacionLogistica?: unknown }) => {
  const errores: string[] = []
  if (!esSi(datos.pagoContraEntrega)) {
    const valor = Number(datos.valorEnvio)
    if (vacio(datos.valorEnvio) || !Number.isFinite(valor) || valor <= 0) {
      errores.push('Registre el valor del envío (o marque Pago contra entrega)')
    }
  }
  if (vacio(datos.fechaProgramacionLogistica)) errores.push('La fecha probable de entrega es obligatoria')
  return errores
}

// Valor que se guarda: sin valor si es contra entrega
export const valorAGuardar = (pagoContraEntrega: unknown, valorEnvio: unknown) =>
  esSi(pagoContraEntrega) || vacio(valorEnvio) ? null : Number(valorEnvio)

// ── Correo "Envío entregado" ──

const dia = (valor: unknown) => (vacio(valor) ? null : String(valor).slice(0, 10))
const textoFecha = (fecha: string) => { const [a, m, d] = fecha.split('-'); return `${d}/${m}/${a}` }

export const notificarEnvioEntregado = async (solicitudTramiteId: number) => {
  const [solicitud, logistica] = await Promise.all([
    SolicitudTramites.findByPk(solicitudTramiteId, { include: [Usuarios, Tramite] }),
    Logistica.findOne({ where: { solicitudTramiteId }, include: [{ model: Transportadora, as: 'transportadora' }] })
  ])
  if (!solicitud?.usuario || !logistica?.fechaEntregaTransportadora) return
  // El modelo Transportadora tapa los getters con propiedades de clase: se lee del objeto plano
  const datos = logistica.toJSON() as { numeroGuia?: string | null, destinatario?: string | null, transportadora?: { nombreTransportadora?: string } | null }
  await crearNotificacion({
    solicitud,
    tipo: 'ENVIO_ENTREGADO' as never,
    destinatario: solicitud.usuario,
    data: {
      nombre: solicitud.usuario.nombreUsuario,
      tipo: solicitud.tramite?.nombreTramite || '',
      fechaEntregaTransportadora: textoFecha(dia(logistica.fechaEntregaTransportadora)!),
      transportadora: datos.transportadora?.nombreTransportadora?.trim() || '',
      numeroGuia: datos.numeroGuia?.trim() || '',
      destinatario: datos.destinatario?.trim() || ''
    }
  })
}

// ¿Este guardado registró la fecha de entrega de la transportadora (antes vacía)?
export const registraEntrega = (antes: unknown, despues: unknown) => !dia(antes) && Boolean(dia(despues))

const alGuardarLogistica = (logistica: Logistica, opciones: { transaction?: Transaction | null }) => {
  const antes = logistica.isNewRecord ? null : logistica.previous('fechaEntregaTransportadora')
  if (!registraEntrega(antes, logistica.fechaEntregaTransportadora)) return
  const id = Number(logistica.solicitudTramiteId)
  const avisar = () => { void notificarEnvioEntregado(id).catch(error => console.error(`❌ Correo de envío entregado (trámite ${id}):`, error)) }
  if (opciones.transaction) opciones.transaction.afterCommit(avisar)
  else avisar()
}

let activo = false

// Se llama al arrancar el backend (server.ts)
export const activarReglasLogistica = () => {
  if (activo) return
  activo = true
  const modelo = Logistica as unknown as { addHook: (evento: string, nombre: string, fn: (...args: any[]) => unknown) => unknown }
  // afterCreate: isNewRecord ya es false, así que "antes" se toma vacío
  modelo.addHook('afterCreate', 'envioEntregado', (l: Logistica, o: { transaction?: Transaction | null }) => {
    if (!dia(l.fechaEntregaTransportadora)) return
    const id = Number(l.solicitudTramiteId)
    const avisar = () => { void notificarEnvioEntregado(id).catch(error => console.error(`❌ Correo de envío entregado (trámite ${id}):`, error)) }
    if (o.transaction) o.transaction.afterCommit(avisar)
    else avisar()
  })
  modelo.addHook('afterUpdate', 'envioEntregado', alGuardarLogistica)
}
