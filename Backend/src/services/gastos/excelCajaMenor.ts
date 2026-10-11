import XLSX from 'xlsx'
import type { FiltrosHistorialCaja, historialCaja } from './cajaMenor'
import { fechaHora, hoja } from './excelArqueo'

// =====================================
// EXCEL DEL HISTORIAL DE UNA CAJA MENOR
// Lo entregado, lo legalizado y en qué reembolso quedó cada gasto (con los filtros de la pantalla)
// =====================================

const ESTADOS_REEMBOLSO: Record<string, string> = {
  BORRADOR: 'Borrador', POR_APROBAR: 'Por aprobar', APROBADO: 'Aprobado', LEGALIZADO: 'Legalizado', ANULADO: 'Anulado'
}

const numero = (valor: string | null | undefined) => (valor === null || valor === undefined ? '' : Number(valor))

export const generarExcelHistorialCaja = (
  caja: { nombre: string, saldoActual: string, fondoAsignado: string | null },
  historial: Awaited<ReturnType<typeof historialCaja>>,
  filtros: FiltrosHistorialCaja
) => {
  const libro = XLSX.utils.book_new()
  const { totales } = historial
  const periodo = filtros.desde || filtros.hasta ? `${filtros.desde ?? '…'} a ${filtros.hasta ?? '…'}` : 'Todo'

  const resumen = [
    [`Historial de ${caja.nombre}`, ''],
    ['Generado', fechaHora(new Date())],
    ['Entregas del período', periodo],
    ['Fondo asignado', Number(caja.fondoAsignado ?? 0)],
    ['Disponible hoy', Number(caja.saldoActual)],
    ['Total entregado (filtrado)', totales.entregado],
    ['Total de soportes legalizados (filtrado)', totales.soporte],
    ['Gastos', `${totales.cantidad} (${totales.sinLegalizar} sin legalizar)`]
  ]

  const filas = historial.gastos.map(g => {
    const l = g.legalizacionCaja
    return {
      Gasto: g.codigo,
      Concepto: g.conceptoPago,
      'Solicitado por': g.creador?.nombreUsuario ?? '',
      Estado: g.estado?.nombre ?? '',
      'Fecha de entrega': g.fechaPago ?? '',
      Entregado: numero(g.valorRealmentePagado),
      Factura: l?.numeroFactura ?? '',
      'Fecha de factura': l?.fechaFactura ?? '',
      Beneficiario: l?.beneficiario ?? '',
      'Tipo de documento': l?.tipoIdentificacion ?? '',
      'Identificación': l?.identificacion ?? '',
      'Placa / matrícula': l?.placa ?? l?.matriculaInmobiliaria ?? g.placa ?? g.matriculaInmobiliaria ?? '',
      'Quién legaliza': l?.quienLegaliza ?? '',
      'Valor del soporte': numero(l?.valorSoporte),
      'Diferencia (soporte − entregado)': numero(l?.diferencia),
      'Legalizado en Nodex': l ? fechaHora(l.createdAt) : '',
      'Registró': l?.registrador?.nombreUsuario ?? '',
      Reembolso: l?.reembolso?.codigo ?? '',
      'Estado del reembolso': l?.reembolso ? ESTADOS_REEMBOLSO[l.reembolso.estado] ?? l.reembolso.estado : '',
      'Reembolso legalizado el': l?.reembolso?.fechaLegalizacion ?? ''
    }
  })

  XLSX.utils.book_append_sheet(libro, hoja(filas, ['Entregado', 'Valor del soporte', 'Diferencia (soporte − entregado)'], resumen), 'Historial')
  return XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}
