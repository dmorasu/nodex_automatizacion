import { Op } from 'sequelize'
import { notificationQueue } from '../../queues/notificacionesQueues'
import Notificacion from '../../models/notificaciones'
import Anticipos from '../../models/gastos/anticipos'
import Terceros from '../../models/gastos/terceros'
import Bolsas from '../../models/gastos/bolsas'
import ClientesEmpresariales from '../../models/gastos/clientesEmpresariales'
import Usuarios from '../../models/usuarios'
import { correoBase, ficha, html, MARCAS, nota, type Detalle } from '../template/correoBase'
import { formatoFecha, formatoMoneda } from './formato'

// =====================================
// CORREOS DE LOS ANTICIPOS (a quien los registró)
// · Novedad: Contabilidad lo devolvió para corregirlo.
// · Confirmado: el dinero entró; ya puede crear el gasto.
// Se llaman DESPUÉS de la transacción: si fallan, el anticipo no se revierte.
// =====================================

const encolar = async (tipo: string, to: string, subject: string, mensaje: string) => {
  const notificacion = await Notificacion.create({
    solicitudTramiteId: null, tipo, canal: 'EMAIL', destinatario: to, mensaje, estado: 'PENDIENTE'
  })
  await notificationQueue.add('send', { notificacionId: notificacion.id, canal: 'EMAIL', to, subject, message: mensaje, ccTorreControl: false })
}

const consultar = (ids: number[]) =>
  Anticipos.findAll({
    where: { id: { [Op.in]: ids } },
    include: [
      { model: Usuarios, as: 'creador', attributes: ['id', 'nombreUsuario', 'correoUsuario'] },
      { model: Terceros, attributes: ['nombre', 'tipoIdentificacion', 'identificacion'] },
      { model: ClientesEmpresariales, attributes: ['nombre'] },
      { model: Bolsas, attributes: ['nombre'] }
    ],
    order: [['id', 'ASC']]
  })

const detalles = (a: Anticipos): Detalle[] => [
  ['Cliente', html(`${a.cliente?.nombre} · ${a.cliente?.tipoIdentificacion} ${a.cliente?.identificacion}`)],
  ['Cliente empresarial', html(a.clienteEmpresarial?.nombre)],
  [a.placa ? 'Placa' : 'Matrícula', html(a.placa || a.matriculaInmobiliaria)],
  ['Valor consignado', formatoMoneda(a.valorConsignado)],
  ['Fecha de consignación', formatoFecha(a.fechaConsignacion)],
  ['Recibo de caja', html(a.reciboCaja)],
  ['Bolsa', html(a.bolsa?.nombre)]
]

const tarjeta = (a: Anticipos, valor: string | null) => ficha({
  titulo: html(a.codigo),
  subtitulo: html(a.concepto),
  valor: formatoMoneda(valor),
  colorValor: MARCAS.GASTOS.color,
  detalles: detalles(a)
})

export const notificarNovedadAnticipo = async (anticipoId: number) => {
  try {
    const [anticipo] = await consultar([anticipoId])
    const correo = anticipo?.creador?.correoUsuario
    if (!correo) return

    const mensaje = correoBase({
      marca: MARCAS.GASTOS,
      estado: { texto: 'Con novedad', tono: 'peligro' },
      titulo: `Anticipo ${anticipo.codigo} con novedad`,
      saludo: `Hola ${html(anticipo.creador.nombreUsuario)},`,
      intro: 'Contabilidad revisó el anticipo y encontró una novedad. Corríjalo en Nodex Gastos (Anticipos) para que lo vuelvan a revisar.',
      preencabezado: `Novedad: ${anticipo.motivoNovedad ?? ''}`,
      cuerpo: nota('peligro', html(anticipo.motivoNovedad), 'Motivo') + tarjeta(anticipo, anticipo.valorConsignado),
      boton: { texto: 'Abrir Nodex Gastos', url: process.env.URL_NODEX_GASTOS }
    })
    await encolar('ANTICIPO_NOVEDAD', correo, `Anticipo ${anticipo.codigo} con novedad`, mensaje)
  } catch (error) {
    console.error('❌ Correo de novedad del anticipo:', error)
  }
}

// Un correo por creador con todos sus anticipos confirmados (confirmación masiva)
export const notificarAnticiposConfirmados = async (anticipoIds: number[]) => {
  try {
    const anticipos = await consultar(anticipoIds)
    const porCreador = new Map<number, Anticipos[]>()
    for (const a of anticipos) {
      if (a.creador?.correoUsuario) porCreador.set(a.creadoPor, [...(porCreador.get(a.creadoPor) ?? []), a])
    }

    for (const grupo of porCreador.values()) {
      const creador = grupo[0].creador
      const uno = grupo.length === 1
      const titulo = uno ? `Anticipo ${grupo[0].codigo} confirmado` : `${grupo.length} anticipos confirmados`
      const diferencias = grupo.filter(a => Number(a.valorRecibido) !== Number(a.valorConsignado))

      const mensaje = correoBase({
        marca: MARCAS.GASTOS,
        estado: { texto: 'Confirmado', tono: 'exito' },
        titulo,
        saludo: `Hola ${html(creador.nombreUsuario)},`,
        intro: `Contabilidad confirmó que el dinero ${uno ? 'del anticipo entró' : 'de estos anticipos entró'} al banco. ` +
          'Ya puede crear el gasto: abra el anticipo en Nodex Gastos y use <b>Crear gasto</b>.',
        preencabezado: titulo,
        cuerpo:
          (diferencias.length
            ? nota('alerta', `El valor que entró es distinto al consignado en ${diferencias.map(a => html(a.codigo)).join(', ')}. ` +
              'El saldo del cliente se calcula con el valor que entró.', 'Diferencia')
            : '') +
          grupo.map(a => tarjeta(a, a.valorRecibido)).join(''),
        boton: { texto: 'Abrir Nodex Gastos', url: process.env.URL_NODEX_GASTOS }
      })
      await encolar('ANTICIPO_CONFIRMADO', creador.correoUsuario, titulo, mensaje)
    }
  } catch (error) {
    console.error('❌ Correo de anticipos confirmados:', error)
  }
}
