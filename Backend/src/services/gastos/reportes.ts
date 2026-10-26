import ExcelJS from 'exceljs'
import { Op, WhereOptions } from 'sequelize'
import SolicitudesGasto from '../../models/gastos/solicitudesGasto'
import EstadosGasto from '../../models/gastos/estadosGasto'
import TiposGasto from '../../models/gastos/tiposGasto'
import FormasPago from '../../models/gastos/formasPago'
import Terceros from '../../models/gastos/terceros'
import Bolsas from '../../models/gastos/bolsas'
import FacturasGasto from '../../models/gastos/facturasGasto'
import Reintegros from '../../models/gastos/reintegros'
import EstadosReintegro from '../../models/gastos/estadosReintegro'
import CuentasCobroGastos from '../../models/gastos/cuentasCobroGastos'
import CuentasCobro from '../../models/gastos/cuentasCobro'
import EstadosCuentaCobro from '../../models/gastos/estadosCuentaCobro'
import Contabilizaciones from '../../models/gastos/contabilizaciones'
import Operaciones from '../../models/operaciones'
import Tramitador from '../../models/tramitador'
import Usuarios from '../../models/usuarios'
import { idEstadoGasto, CodigoEstadoGasto } from './estadosGasto'

export type FiltrosReporte = {
  estado?: string | null
  bolsaId?: number | null
  desde?: string | null   // fecha de creación del gasto
  hasta?: string | null
}

// Tope de filas por archivo para no saturar el servidor
export const MAXIMO_FILAS_REPORTE = 20000

const dinero = (valor: unknown) => (valor === null || valor === undefined ? null : Number(valor))

// Reporte de gastos con todo su recorrido: solicitud, pago, factura, reintegro,
// cuenta de cobro y contabilización. Una fila por gasto.
export const generarReporteGastos = async (filtros: FiltrosReporte) => {
  const condiciones: WhereOptions[] = []

  if (filtros.estado) condiciones.push({ estadoId: await idEstadoGasto(filtros.estado as CodigoEstadoGasto) })
  if (filtros.bolsaId) condiciones.push({ bolsaId: filtros.bolsaId })
  if (filtros.desde) condiciones.push({ createdAt: { [Op.gte]: new Date(`${filtros.desde}T00:00:00-05:00`) } })
  if (filtros.hasta) condiciones.push({ createdAt: { [Op.lte]: new Date(`${filtros.hasta}T23:59:59-05:00`) } })

  const gastos = await SolicitudesGasto.findAll({
    where: { [Op.and]: condiciones },
    include: [
      { model: EstadosGasto, attributes: ['nombre'] },
      { model: TiposGasto, attributes: ['nombre'] },
      { model: FormasPago, attributes: ['nombre'] },
      { model: Operaciones, attributes: ['nombreOperacion', 'centroDeCostos'] },
      { model: Bolsas, attributes: ['nombre'] },
      { model: Terceros, attributes: ['identificacion', 'nombre'] },
      { model: Tramitador, attributes: ['nombreTramitador', 'identificacion'] },
      { model: Usuarios, as: 'creador', attributes: ['nombreUsuario'] },
      { model: FacturasGasto },
      { model: Reintegros, include: [{ model: EstadosReintegro, attributes: ['nombre'] }] },
      {
        model: CuentasCobroGastos,
        attributes: ['id'],
        include: [{
          model: CuentasCobro,
          attributes: ['numeroCuentaCobro', 'fechaLegalizacion'],
          include: [
            { model: EstadosCuentaCobro, attributes: ['codigo', 'nombre'] },
            { model: Contabilizaciones, attributes: ['documentoContable', 'fechaContabilizacion'] }
          ]
        }]
      }
    ],
    order: [['id', 'ASC']],
    limit: MAXIMO_FILAS_REPORTE
  })

  const libro = new ExcelJS.Workbook()
  libro.creator = 'Nodex Gastos'
  const hoja = libro.addWorksheet('Gastos', { views: [{ state: 'frozen', ySplit: 1 }] })

  const MONEDA = '"$"#,##0.00'
  hoja.columns = [
    { header: 'Código', key: 'codigo', width: 18 },
    { header: 'Fecha creación', key: 'creado', width: 14, style: { numFmt: 'dd/mm/yyyy' } },
    { header: 'Estado', key: 'estado', width: 18 },
    { header: 'Solicitante', key: 'solicitante', width: 24 },
    { header: 'Operación', key: 'operacion', width: 26 },
    { header: 'Centro de costos', key: 'centroCostos', width: 14 },
    { header: 'Bolsa', key: 'bolsa', width: 18 },
    { header: 'Tipo de gasto', key: 'tipo', width: 14 },
    { header: 'Forma de pago', key: 'formaPago', width: 18 },
    { header: 'Concepto', key: 'concepto', width: 36 },
    { header: 'Reembolsable', key: 'reembolsable', width: 13 },
    { header: 'Trámite', key: 'tramite', width: 10 },
    { header: 'Tramitador', key: 'tramitador', width: 24 },
    { header: 'Identificación tramitador', key: 'idTramitador', width: 18 },
    { header: 'Placa', key: 'placa', width: 10 },
    { header: 'Tránsito', key: 'transito', width: 20 },
    { header: 'Matrícula inmobiliaria', key: 'matricula', width: 20 },
    { header: 'Beneficiario', key: 'beneficiario', width: 30 },
    { header: 'Identificación beneficiario', key: 'idBeneficiario', width: 18 },
    { header: 'Valor solicitado', key: 'solicitado', width: 16, style: { numFmt: MONEDA } },
    { header: 'Valor pagado', key: 'pagado', width: 16, style: { numFmt: MONEDA } },
    { header: 'Fecha de pago', key: 'fechaPago', width: 14 },
    { header: 'Lote de pago', key: 'lote', width: 10 },
    { header: 'Número de egreso', key: 'egreso', width: 16 },
    { header: 'Número de factura', key: 'numeroFactura', width: 16 },
    { header: 'Tercero de la factura', key: 'terceroFactura', width: 30 },
    { header: 'Valor factura', key: 'valorFactura', width: 16, style: { numFmt: MONEDA } },
    { header: 'Base retención', key: 'baseRetencion', width: 16, style: { numFmt: MONEDA } },
    { header: 'Retención en la fuente', key: 'retencion', width: 16, style: { numFmt: MONEDA } },
    { header: 'Total a pagar', key: 'totalPagar', width: 16, style: { numFmt: MONEDA } },
    { header: '4x1000', key: 'gmf', width: 12, style: { numFmt: MONEDA } },
    { header: 'Valor legalizado', key: 'legalizado', width: 16, style: { numFmt: MONEDA } },
    { header: 'Reintegro', key: 'reintegro', width: 14, style: { numFmt: MONEDA } },
    { header: 'Estado reintegro', key: 'estadoReintegro', width: 16 },
    { header: 'Cuenta de cobro', key: 'cuentaCobro', width: 16 },
    { header: 'Estado cuenta de cobro', key: 'estadoCuenta', width: 18 },
    { header: 'Documento contable', key: 'documentoContable', width: 18 },
    { header: 'Motivo anulación', key: 'motivoAnulacion', width: 30 }
  ]

  for (const g of gastos) {
    const factura = g.factura
    // Una sola cuenta activa; las anuladas quedan como historial
    const linea = g.lineasCuentaCobro.find(l => l.cuentaCobro?.estado?.codigo !== 'ANULADA')
    const cuenta = linea?.cuentaCobro

    hoja.addRow({
      codigo: g.codigo,
      creado: g.createdAt,
      estado: g.estado?.nombre,
      solicitante: g.creador?.nombreUsuario,
      operacion: g.operacion?.nombreOperacion,
      centroCostos: g.operacion?.centroDeCostos,
      bolsa: g.bolsa?.nombre,
      tipo: g.tipoGasto?.nombre,
      formaPago: g.formaPago?.nombre,
      concepto: g.conceptoPago,
      reembolsable: g.reembolsable ? 'Sí' : 'No',
      tramite: g.solicitudTramiteId,
      tramitador: g.tramitador?.nombreTramitador,
      idTramitador: g.tramitador?.identificacion,
      placa: g.placa,
      transito: g.transito,
      matricula: g.matriculaInmobiliaria,
      beneficiario: g.beneficiario?.nombre,
      idBeneficiario: g.beneficiario?.identificacion,
      solicitado: dinero(g.valorSolicitadoPago),
      pagado: dinero(g.valorRealmentePagado),
      fechaPago: g.fechaPago,
      lote: g.lotePagoId,
      egreso: g.numeroEgreso,
      numeroFactura: factura?.numeroFactura,
      terceroFactura: factura?.nombreTerceroReal,
      valorFactura: dinero(factura?.valorFactura),
      // La retención se define al crear el gasto (inmuebles); los anteriores la tienen en la factura
      baseRetencion: dinero(g.retencionBase ?? factura?.baseRetencion),
      retencion: dinero(g.retencionValor ?? factura?.retencionFuente),
      totalPagar: dinero(g.retencionTotalPagar ?? factura?.totalPagar),
      gmf: dinero(factura?.cuatroXMil),
      legalizado: dinero(factura?.valorLegalizado),
      reintegro: g.reintegros.length ? g.reintegros.reduce((s, r) => s + Number(r.valorReintegro), 0) : null,
      estadoReintegro: g.reintegros.map(r => r.estado?.nombre).join(', ') || null,
      cuentaCobro: cuenta?.numeroCuentaCobro,
      estadoCuenta: cuenta?.estado?.nombre,
      // Reembolsables: el de su cuenta de cobro · No reembolsables: el del propio gasto
      documentoContable: cuenta?.contabilizacion?.documentoContable ?? g.documentoContable,
      motivoAnulacion: g.motivoAnulacion
    })
  }

  const encabezado = hoja.getRow(1)
  encabezado.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  encabezado.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } }
  hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: hoja.columns.length } }

  return { buffer: await libro.xlsx.writeBuffer(), filas: gastos.length }
}
