import type SolicitudesGasto from '../../models/gastos/solicitudesGasto'
import { correoBase, ficha, html, MARCAS, resumen, type Detalle, type Tono } from '../template/correoBase'
import { formatoMoneda } from './formato'

export { html } from '../template/correoBase'
export type { Detalle } from '../template/correoBase'

// =====================================
// PLANTILLA DE LOS CORREOS DE NODEX GASTOS
// Resumen con el total y una ficha por gasto, sobre la base común de los correos de Nodex.
// =====================================

export const ESTADOS_CORREO = {
  POR_PAGAR: { texto: 'Por pagar', tono: 'alerta' as Tono },
  POR_APROBAR: { texto: 'Por aprobar', tono: 'alerta' as Tono },
  APROBADO: { texto: 'Aprobado', tono: 'exito' as Tono },
  RECHAZADO: { texto: 'Rechazado', tono: 'peligro' as Tono },
  PAGADO: { texto: 'Pagado', tono: 'exito' as Tono },
  POR_LEGALIZAR: { texto: 'Por legalizar', tono: 'info' as Tono },
  REINTEGRO: { texto: 'Reintegro', tono: 'info' as Tono }
} as const

type DatosCorreo = {
  estado: typeof ESTADOS_CORREO[keyof typeof ESTADOS_CORREO]
  titulo: string
  saludo: string
  intro: string
  gastos: SolicitudesGasto[]
  monto: (g: SolicitudesGasto) => string | number | null | undefined
  etiquetaTotal: string
  detalles: (g: SolicitudesGasto) => Detalle[]
}

export const correoGastos = (datos: DatosCorreo) => {
  const total = datos.gastos.reduce((suma, g) => suma + Number(datos.monto(g) ?? 0), 0)
  const cantidad = datos.gastos.length === 1 ? '1 gasto' : `${datos.gastos.length} gastos`

  return correoBase({
    marca: MARCAS.GASTOS,
    estado: datos.estado,
    titulo: datos.titulo,
    saludo: datos.saludo,
    intro: datos.intro,
    preencabezado: `${datos.titulo} · ${formatoMoneda(total)}`,
    cuerpo: `
      <div style="padding-top: 8px;">${resumen(datos.etiquetaTotal, formatoMoneda(total), cantidad)}</div>
      ${datos.gastos.map(g => ficha({
        titulo: html(g.codigo),
        subtitulo: html(g.conceptoPago),
        valor: formatoMoneda(datos.monto(g)),
        colorValor: MARCAS.GASTOS.color,
        detalles: datos.detalles(g)
      })).join('')}`,
    // Botón a la app, solo si URL_NODEX_GASTOS está en el .env
    boton: { texto: 'Abrir Nodex Gastos', url: process.env.URL_NODEX_GASTOS }
  })
}
