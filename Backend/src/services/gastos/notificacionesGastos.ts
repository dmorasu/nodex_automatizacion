import { Op } from 'sequelize'
import { notificationQueue } from '../../queues/notificacionesQueues'
import Notificacion from '../../models/notificaciones'
import SolicitudesGasto from '../../models/gastos/solicitudesGasto'
import Terceros from '../../models/gastos/terceros'
import Bolsas from '../../models/gastos/bolsas'
import TiposGasto from '../../models/gastos/tiposGasto'
import Operaciones from '../../models/operaciones'
import SolicitudTramites from '../../models/solicitudTramites'
import Usuarios from '../../models/usuarios'
import FacturasGasto from '../../models/gastos/facturasGasto'
import Reintegros from '../../models/gastos/reintegros'
import Tramitador from '../../models/tramitador'
import SoporteTramitador, { ESTADOS_SOPORTE, TIPOS_SOPORTE } from '../../models/tramitadores/soporteTramitador'
import LotesPago from '../../models/gastos/lotesPago'
import Roles from '../../models/gastos/roles'
import { ROLES } from './constantes'
import { formatoFecha, formatoMoneda } from './formato'
import { correoGastos, ESTADOS_CORREO, html } from './plantillaCorreo'

// Destinatarios fijos (.env). Se leen al enviar para no depender del orden de carga de dotenv
const correoTesoreria = () => process.env.CORREO_TESORERIA || 'grupotesoreria@gomezpinedaabogados.com'
const correoTorreControl = () => process.env.CORREO_TORRE_CONTROL || 'torredecontrol@gomezpinedaabogados.com'
const correoLegalizacion = () => process.env.CORREO_LEGALIZACION || 'legalizaciongastos@gomezpinedaabogados.com'

const tramite = (g: SolicitudesGasto) => g.solicitudTramiteId ? `#${g.solicitudTramiteId}` : null

const plural = (n: number, uno: string, varios: string) => n === 1 ? uno : `${n} ${varios}`

// Guarda la notificación y la deja en la cola; el worker la envía por SendGrid
const encolarCorreo = async (tipo: string, to: string, subject: string, mensaje: string, ccTorreControl = false) => {
  const notificacion = await Notificacion.create({
    solicitudTramiteId: null,
    tipo,
    canal: 'EMAIL',
    destinatario: to,
    mensaje,
    estado: 'PENDIENTE'
  })

  await notificationQueue.add('send', {
    notificacionId: notificacion.id,
    canal: 'EMAIL',
    to,
    subject,
    message: mensaje,
    // Por defecto los correos de gastos no van con copia a la torre de control
    ccTorreControl
  })
}

// Cómo se pagó: aprobado por Dirección de Negocio y confirmado con el soporte del banco,
// o pago directo (compras de certificados, sin aprobación)
const comoSePago = (gastos: SolicitudesGasto[]) => {
  const aprobador = gastos.find(g => g.lotePago?.aprobador)?.lotePago?.aprobador?.nombreUsuario
  return aprobador
    ? ` Lo aprobó Dirección de Negocio (${html(aprobador)}) y el soporte del banco está en el detalle del gasto en Nodex Gastos.`
    : ' El soporte del pago está en el detalle del gasto en Nodex Gastos.'
}

// Mismo correo de pago para el creador, el analista y la torre de control.
// Sale cuando Tesorería CONFIRMA el pago (no al programarlo ni al aprobarlo).
const correoPagado = (titulo: string, saludo: string, intro: string, gastos: SolicitudesGasto[]) =>
  correoGastos({
    estado: ESTADOS_CORREO.PAGADO,
    titulo,
    saludo,
    intro: intro + comoSePago(gastos),
    gastos,
    monto: g => g.valorRealmentePagado,
    etiquetaTotal: 'Total pagado',
    detalles: g => [
      ['Beneficiario', html(g.beneficiario?.nombre)],
      ['Fecha de pago', formatoFecha(g.fechaPago)],
      ['Bolsa', html(g.bolsa?.nombre)],
      ['Trámite', tramite(g)],
      ['Lote de pago', g.lotePagoId ? `#${g.lotePagoId}` : null],
      ['Aprobado por', g.lotePago?.aprobador ? html(g.lotePago.aprobador.nombreUsuario) : 'Pago directo (certificados)']
    ]
  })

const agruparPor = <T>(gastos: SolicitudesGasto[], clave: (g: SolicitudesGasto) => T) => {
  const grupos = new Map<T, SolicitudesGasto[]>()
  for (const gasto of gastos) {
    const k = clave(gasto)
    grupos.set(k, [...(grupos.get(k) ?? []), gasto])
  }
  return grupos
}

// Avisa a Tesorería de los gastos nuevos que tiene por pagar.
// Un solo correo aunque sean varios (cargue masivo).
// Se llama DESPUÉS de confirmar la transacción; si falla, el gasto no se revierte.
export const notificarGastosCreados = async (gastoIds: number[]) => {
  try {
    const gastos = await SolicitudesGasto.findAll({
      where: { id: { [Op.in]: gastoIds } },
      include: [
        { model: Usuarios, as: 'creador', attributes: ['nombreUsuario'] },
        { model: Terceros, attributes: ['nombre'] },
        { model: Bolsas, attributes: ['nombre'] },
        { model: TiposGasto, attributes: ['nombre'] },
        { model: Operaciones, attributes: ['nombreOperacion'] }
      ],
      order: [['id', 'ASC']]
    })
    if (!gastos.length) return

    const subject = gastos.length === 1
      ? `Nuevo gasto por pagar ${gastos[0].codigo}`
      : `${gastos.length} gastos nuevos por pagar`

    const mensaje = correoGastos({
      estado: ESTADOS_CORREO.POR_PAGAR,
      titulo: gastos.length === 1 ? 'Nuevo gasto por pagar' : `${gastos.length} gastos nuevos por pagar`,
      saludo: 'Hola equipo de Tesorería,',
      intro: gastos.length === 1
        ? 'Se creó un gasto que está pendiente de pago.'
        : 'Se crearon estos gastos que están pendientes de pago.',
      gastos,
      monto: g => g.valorSolicitadoPago,
      etiquetaTotal: 'Total solicitado',
      detalles: g => [
        ['Tipo', html(g.tipoGasto?.nombre)],
        ['Operación', html(g.operacion?.nombreOperacion)],
        ['Beneficiario', html(g.beneficiario?.nombre)],
        ['Bolsa', html(g.bolsa?.nombre)],
        ['Trámite', tramite(g)],
        ['Creado por', html(g.creador?.nombreUsuario)]
      ]
    })

    await encolarCorreo('GASTO_CREADO', correoTesoreria(), subject, mensaje)
  } catch (error) {
    console.error('⚠️ No se pudo enviar el correo de gastos creados a Tesorería:', error)
  }
}

// Avisa del pago confirmado (bolsa descontada y soporte del banco adjunto):
//  - a quien creó cada gasto,
//  - al analista asignado al trámite del gasto, con copia a la torre de control,
//  - a la torre de control directamente por los gastos sin analista (o sin trámite).
// Un solo correo por destinatario aunque se paguen varios gastos en el lote.
// Se llama DESPUÉS de confirmar la transacción del pago; si falla, el pago no se revierte.
export const notificarGastosPagados = async (gastoIds: number[]) => {
  try {
    const gastos = await SolicitudesGasto.findAll({
      where: { id: { [Op.in]: gastoIds } },
      include: [
        { model: Usuarios, as: 'creador', attributes: ['id', 'nombreUsuario', 'correoUsuario'] },
        { model: Terceros, attributes: ['nombre'] },
        { model: Bolsas, attributes: ['nombre'] },
        {
          model: LotesPago,
          attributes: ['id', 'aprobadoPor'],
          include: [{ model: Usuarios, as: 'aprobador', attributes: ['nombreUsuario'] }]
        }
      ],
      order: [['id', 'ASC']]
    })
    if (!gastos.length) return

    // ── Quien creó el gasto ──
    for (const gastosCreador of agruparPor(gastos, g => g.creadoPor).values()) {
      const creador = gastosCreador[0].creador
      if (!creador?.correoUsuario) continue

      await encolarCorreo(
        'GASTO_PAGADO',
        creador.correoUsuario,
        gastosCreador.length === 1 ? `Gasto pagado ${gastosCreador[0].codigo}` : `${gastosCreador.length} gastos pagados`,
        correoPagado(
          gastosCreador.length === 1 ? 'Tu gasto fue pagado' : 'Tus gastos fueron pagados',
          `Hola ${html(creador.nombreUsuario)},`,
          `Tesorería confirmó el pago de ${plural(gastosCreador.length, 'tu gasto', 'de tus gastos')}.`,
          gastosCreador
        )
      )
    }

    // ── Analista asignado al trámite (con copia a la torre de control) ──
    const tramiteIds = [...new Set(gastos.map(g => g.solicitudTramiteId).filter(Boolean))]
    const tramites = tramiteIds.length
      ? await SolicitudTramites.findAll({ where: { id: tramiteIds }, attributes: ['id', 'analistaAsignado'] })
      : []
    const analistaDeTramite = new Map(tramites.map(t => [t.id, t.analistaAsignado]))

    const analistaIds = [...new Set(tramites.map(t => t.analistaAsignado).filter((id): id is number => !!id))]
    const analistas = analistaIds.length
      ? await Usuarios.findAll({ where: { id: analistaIds }, attributes: ['id', 'nombreUsuario', 'correoUsuario'] })
      : []
    const analistaPorId = new Map(analistas.map(a => [a.id, a]))

    // Analista con correo del gasto, o null si va directo a la torre de control
    const analistaDe = (g: SolicitudesGasto) => {
      const analista = analistaPorId.get(analistaDeTramite.get(g.solicitudTramiteId) ?? 0)
      return analista?.correoUsuario ? analista : null
    }

    for (const [analista, gastosAnalista] of agruparPor(gastos, analistaDe)) {
      const asunto = gastosAnalista.length === 1
        ? `Gasto pagado ${gastosAnalista[0].codigo}`
        : `${gastosAnalista.length} gastos pagados`

      if (analista) {
        await encolarCorreo(
          'GASTO_PAGADO_ANALISTA',
          analista.correoUsuario,
          `${asunto} · trámites asignados`,
          correoPagado(
            'Pago en trámites asignados',
            `Hola ${html(analista.nombreUsuario)},`,
            `Tesorería confirmó el pago de ${plural(gastosAnalista.length, 'un gasto', 'gastos')} de trámites que tienes asignados.`,
            gastosAnalista
          ),
          true // copia a la torre de control
        )
      } else {
        await encolarCorreo(
          'GASTO_PAGADO_TORRE_CONTROL',
          correoTorreControl(),
          asunto,
          correoPagado(
            gastosAnalista.length === 1 ? 'Gasto pagado' : 'Gastos pagados',
            'Hola Torre de Control,',
            `Tesorería confirmó el pago de ${plural(gastosAnalista.length, 'un gasto', 'gastos')} sin analista asignado.`,
            gastosAnalista
          )
        )
      }
    }
  } catch (error) {
    console.error('⚠️ No se pudieron enviar los correos de gastos pagados:', error)
  }
}

// Avisa a Legalización que un trámite FINALIZADO tiene gastos con la factura que subió el
// tramitador. Solo gastos reembolsables (los no reembolsables los lleva Contabilidad) cuya
// factura del tramitador no está rechazada y que Legalización aún no ha registrado.
// Si el trámite no tiene gastos o ninguno tiene factura, no se envía nada.
// Se llama DESPUÉS de guardar el estado; si falla, el estado no se revierte.
export const notificarFacturasParaLegalizacion = async (solicitudTramiteId: number) => {
  try {
    const soportes = await SoporteTramitador.findAll({
      where: {
        tipo: TIPOS_SOPORTE.FACTURA,
        estado: { [Op.ne]: ESTADOS_SOPORTE.RECHAZADO }
      },
      include: [
        {
          model: SolicitudesGasto,
          required: true,
          where: { solicitudTramiteId, reembolsable: true },
          include: [
            { model: Terceros, attributes: ['nombre'] },
            { model: Bolsas, attributes: ['nombre'] },
            { model: FacturasGasto, attributes: ['id'] }
          ]
        },
        { model: Tramitador, attributes: ['nombreTramitador'] }
      ],
      order: [['id', 'ASC']]
    })

    // Un gasto por ficha, con el estado de su factura más reciente
    const porGasto = new Map<number, SoporteTramitador>()
    for (const soporte of soportes) {
      if (soporte.solicitudGasto.factura) continue // Legalización ya registró la factura
      porGasto.set(soporte.solicitudGastoId, soporte)
    }
    if (!porGasto.size) return

    const gastos = [...porGasto.values()].map(s => s.solicitudGasto)
    const soporteDe = (g: SolicitudesGasto) => porGasto.get(g.id)!

    const mensaje = correoGastos({
      estado: ESTADOS_CORREO.POR_LEGALIZAR,
      titulo: gastos.length === 1 ? 'Factura lista para legalizar' : `${gastos.length} facturas listas para legalizar`,
      saludo: 'Hola equipo de Legalización,',
      intro: `El trámite <strong>#${solicitudTramiteId}</strong> fue finalizado y ${gastos.length === 1 ? 'tiene un gasto' : `tiene ${gastos.length} gastos`} con la factura subida por el tramitador.`,
      gastos,
      monto: g => g.valorRealmentePagado,
      etiquetaTotal: 'Total pagado',
      detalles: g => [
        ['Trámite', tramite(g)],
        ['Tramitador', html(soporteDe(g).tramitador?.nombreTramitador)],
        ['Beneficiario', html(g.beneficiario?.nombre)],
        ['Bolsa', html(g.bolsa?.nombre)],
        ['Factura del tramitador', soporteDe(g).estado === ESTADOS_SOPORTE.APROBADO ? 'Aprobada' : 'Pendiente de revisión'],
        ['Observación', html(soporteDe(g).observacion)]
      ]
    })

    await encolarCorreo(
      'GASTO_FACTURA_LEGALIZACION',
      correoLegalizacion(),
      `Trámite #${solicitudTramiteId} finalizado · ${plural(gastos.length, 'factura', 'facturas')} por legalizar`,
      mensaje
    )
  } catch (error) {
    console.error(`⚠️ No se pudo enviar el correo de facturas a Legalización (trámite ${solicitudTramiteId}):`, error)
  }
}

// Avisa a Tesorería que el tramitador subió el comprobante de un reintegro.
// Se llama DESPUÉS de guardar el soporte; si falla, el soporte no se revierte.
export const notificarReintegroTramitador = async (soporteId: number) => {
  try {
    const soporte = await SoporteTramitador.findByPk(soporteId, {
      include: [
        {
          model: SolicitudesGasto,
          include: [
            { model: Terceros, attributes: ['nombre'] },
            { model: Bolsas, attributes: ['nombre'] }
          ]
        },
        { model: Reintegros, attributes: ['id', 'valorReintegro', 'observacion'] },
        { model: Tramitador, attributes: ['nombreTramitador'] }
      ]
    })
    if (!soporte || soporte.tipo !== TIPOS_SOPORTE.REINTEGRO || !soporte.solicitudGasto) return

    const gasto = soporte.solicitudGasto
    const tramitador = soporte.tramitador?.nombreTramitador

    const mensaje = correoGastos({
      estado: ESTADOS_CORREO.REINTEGRO,
      titulo: 'Reintegro del tramitador',
      saludo: 'Hola equipo de Tesorería,',
      intro: `${tramitador ? `<strong>${html(tramitador)}</strong>` : 'El tramitador'} subió el comprobante de un reintegro. Queda pendiente de revisión.`,
      gastos: [gasto],
      monto: () => soporte.reintegro?.valorReintegro,
      etiquetaTotal: 'Valor del reintegro',
      detalles: g => [
        ['Trámite', tramite(g)],
        ['Tramitador', html(tramitador)],
        ['Beneficiario', html(g.beneficiario?.nombre)],
        ['Bolsa', html(g.bolsa?.nombre)],
        ['Valor pagado del gasto', formatoMoneda(g.valorRealmentePagado)],
        ['Observación', html(soporte.observacion || soporte.reintegro?.observacion)]
      ]
    })

    await encolarCorreo('GASTO_REINTEGRO_TRAMITADOR', correoTesoreria(), `Reintegro del tramitador · ${gasto.codigo}`, mensaje)
  } catch (error) {
    console.error(`⚠️ No se pudo enviar el correo de reintegro a Tesorería (soporte ${soporteId}):`, error)
  }
}

// Correos de quienes tienen el perfil Dirección de Negocio
const correosDireccion = async () => {
  const usuarios = await Usuarios.findAll({
    attributes: ['correoUsuario'],
    include: [{ model: Roles, attributes: [], where: { codigo: ROLES.DIRECCION_NEGOCIO }, through: { attributes: [] } }]
  })
  return [...new Set(usuarios.map(u => u.correoUsuario).filter(Boolean))]
}

const gastosConDetalle = (where: Record<string, unknown>) =>
  SolicitudesGasto.findAll({
    where,
    include: [
      { model: Usuarios, as: 'creador', attributes: ['nombreUsuario'] },
      { model: Terceros, attributes: ['nombre'] },
      { model: TiposGasto, attributes: ['nombre'] }
    ],
    order: [['id', 'ASC']]
  })

// Avisa a Dirección de Negocio que Tesorería programó un lote para pago y espera su aprobación.
// Se llama DESPUÉS de guardar; si falla, la programación no se revierte.
export const notificarLoteProgramado = async (loteId: number) => {
  try {
    const destinatarios = await correosDireccion()
    if (!destinatarios.length) {
      console.warn(`⚠️ Lote #${loteId} programado, pero nadie tiene el perfil Dirección de Negocio con correo`)
      return
    }

    const lote = await LotesPago.findByPk(loteId, { include: [{ model: Bolsas, attributes: ['nombre'] }] })
    const gastos = await gastosConDetalle({ lotePagoId: loteId })
    if (!lote || !gastos.length) return

    const mensaje = correoGastos({
      estado: ESTADOS_CORREO.POR_APROBAR,
      titulo: `Pago por aprobar · lote #${lote.id}`,
      saludo: 'Hola,',
      intro: `Tesorería programó ${gastos.length === 1 ? 'un gasto' : `${gastos.length} gastos`} para pago desde la bolsa <strong>${html(lote.bolsa?.nombre)}</strong> el ${formatoFecha(lote.fechaPago)}. Revíselos en Nodex Gastos para aprobarlos o rechazarlos.`,
      gastos,
      monto: g => g.valorProgramado,
      etiquetaTotal: 'Total programado',
      detalles: g => [
        ['Beneficiario', html(g.beneficiario?.nombre)],
        ['Tipo', html(g.tipoGasto?.nombre)],
        ['Trámite', tramite(g)],
        ['Solicitado por', html(g.creador?.nombreUsuario)]
      ]
    })

    for (const correo of destinatarios) {
      await encolarCorreo('LOTE_PROGRAMADO', correo, `Pago por aprobar · lote #${lote.id} · ${formatoMoneda(lote.total)}`, mensaje)
    }
  } catch (error) {
    console.error(`⚠️ No se pudo enviar el correo del lote programado #${loteId}:`, error)
  }
}

// Avisa a Tesorería lo que decidió Dirección de Negocio:
//  - sin rechazados: el lote quedó aprobado y falta adjuntar el soporte del banco y confirmar;
//  - con rechazados: qué gastos volvieron a Por pagar y por qué.
export const notificarRevisionLote = async (loteId: number, rechazadoIds: number[], motivo: string | null) => {
  try {
    const lote = await LotesPago.findByPk(loteId, { include: [{ model: Bolsas, attributes: ['nombre'] }] })
    if (!lote) return

    if (rechazadoIds.length) {
      const gastos = await gastosConDetalle({ id: { [Op.in]: rechazadoIds } })
      if (!gastos.length) return
      const mensaje = correoGastos({
        estado: ESTADOS_CORREO.RECHAZADO,
        titulo: gastos.length === 1 ? 'Gasto rechazado por Dirección' : `${gastos.length} gastos rechazados por Dirección`,
        saludo: 'Hola equipo de Tesorería,',
        intro: `Dirección de Negocio rechazó ${gastos.length === 1 ? 'un gasto' : `${gastos.length} gastos`} del lote <strong>#${lote.id}</strong>. Volvieron a <strong>Por pagar</strong>.<br>Motivo: ${html(motivo)}`,
        gastos,
        monto: g => g.valorSolicitadoPago,
        etiquetaTotal: 'Total rechazado',
        detalles: g => [
          ['Beneficiario', html(g.beneficiario?.nombre)],
          ['Tipo', html(g.tipoGasto?.nombre)],
          ['Trámite', tramite(g)],
          ['Solicitado por', html(g.creador?.nombreUsuario)]
        ]
      })
      await encolarCorreo('LOTE_GASTOS_RECHAZADOS', correoTesoreria(), `Gastos rechazados · lote #${lote.id}`, mensaje)
      return
    }

    const gastos = await gastosConDetalle({ lotePagoId: loteId })
    if (!gastos.length) return
    const mensaje = correoGastos({
      estado: ESTADOS_CORREO.APROBADO,
      titulo: `Lote #${lote.id} aprobado para pago`,
      saludo: 'Hola equipo de Tesorería,',
      intro: `Dirección de Negocio aprobó el lote <strong>#${lote.id}</strong> (bolsa ${html(lote.bolsa?.nombre)}). Cuando el banco procese el pago, adjunte el soporte y confirme el pago en Nodex Gastos.`,
      gastos,
      monto: g => g.valorProgramado,
      etiquetaTotal: 'Total aprobado',
      detalles: g => [
        ['Beneficiario', html(g.beneficiario?.nombre)],
        ['Tipo', html(g.tipoGasto?.nombre)],
        ['Trámite', tramite(g)],
        ['Solicitado por', html(g.creador?.nombreUsuario)]
      ]
    })
    await encolarCorreo('LOTE_APROBADO', correoTesoreria(), `Lote #${lote.id} aprobado · ${formatoMoneda(lote.total)}`, mensaje)
  } catch (error) {
    console.error(`⚠️ No se pudo enviar el correo de revisión del lote #${loteId}:`, error)
  }
}
