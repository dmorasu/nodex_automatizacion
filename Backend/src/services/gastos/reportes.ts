import ExcelJS from 'exceljs'
import { Includeable, Op, WhereOptions } from 'sequelize'
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
import Anticipos from '../../models/gastos/anticipos'
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

// Seguimiento desde la app de tramitadores (mismos textos que el CSV de Legalización)
const REPORTE_REALIZADO: Record<string, string> = { PENDIENTE: 'Por revisar', REVISADO: 'Revisado', DEVUELTO: 'Devuelto' }
const SOPORTE_TRAMITADOR: Record<string, string> = { PENDIENTE: 'Pendiente de revisión', APROBADO: 'Aprobada', RECHAZADO: 'Rechazada' }

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
    include: INCLUDES_REPORTE,
    order: [['id', 'ASC']],
    limit: MAXIMO_FILAS_REPORTE
  })

  return { buffer: await libroDeGastos(gastos), filas: gastos.length }
}

// Lo que necesita cada fila del Excel detallado (reporte del Tablero y exportable de cada bandeja)
export const INCLUDES_REPORTE: Includeable[] = [
  { model: EstadosGasto, attributes: ['nombre'] },
  { model: TiposGasto, attributes: ['nombre'] },
  { model: FormasPago, attributes: ['nombre'] },
  { model: Operaciones, attributes: ['nombreOperacion', 'centroDeCostos'] },
  { model: Bolsas, attributes: ['nombre'] },
  { model: Terceros, attributes: ['identificacion', 'nombre', 'banco', 'tipoCuenta', 'numeroCuenta'] },
  { model: Tramitador, attributes: ['nombreTramitador', 'identificacion'] },
  { model: Anticipos, attributes: ['codigo'] },
  { model: Usuarios, as: 'creador', attributes: ['nombreUsuario'] },
  { model: FacturasGasto },
  // Los hasMany van aparte (separate): con el límite de filas y los filtros del listado sobre los
  // includes (beneficiario en la búsqueda), en la misma consulta Sequelize arma una subconsulta que falla
  { model: Reintegros, separate: true, include: [{ model: EstadosReintegro, attributes: ['nombre'] }] },
  {
    model: CuentasCobroGastos,
    separate: true,
    attributes: ['id', 'solicitudGastoId'],
    include: [{
      model: CuentasCobro,
      attributes: ['numeroCuentaCobro', 'fechaLegalizacion'],
      include: [
        { model: EstadosCuentaCobro, attributes: ['codigo', 'nombre'] },
        { model: Contabilizaciones, attributes: ['documentoContable', 'fechaContabilizacion'] }
      ]
    }]
  }
]

// Excel detallado: una fila por gasto con todo su recorrido. Si los gastos traen los atributos de
// seguimiento del tramitador (estadoTramite, reporteRealizado, soporteTramitador), también salen
export const libroDeGastos = async (gastos: SolicitudesGasto[]) => {
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
    { header: 'Anticipo', key: 'anticipo', width: 18 },
    { header: 'Cliente', key: 'cliente', width: 28 },
    { header: 'Identificación cliente', key: 'idCliente', width: 18 },
    { header: 'Contrato', key: 'contrato', width: 16 },
    { header: 'Código BPR/FTF', key: 'codigoBpr', width: 16 },
    { header: 'Trámite', key: 'tramite', width: 10 },
    { header: 'Estado del trámite', key: 'estadoTramite', width: 20 },
    { header: 'Reporte realizado del tramitador', key: 'reporteRealizado', width: 16 },
    { header: 'Factura del tramitador', key: 'soporteTramitador', width: 16 },
    { header: 'Tramitador', key: 'tramitador', width: 24 },
    { header: 'Identificación tramitador', key: 'idTramitador', width: 18 },
    { header: 'Placa', key: 'placa', width: 10 },
    { header: 'Tránsito', key: 'transito', width: 20 },
    { header: 'Matrícula inmobiliaria', key: 'matricula', width: 20 },
    { header: 'Beneficiario', key: 'beneficiario', width: 30 },
    { header: 'Identificación beneficiario', key: 'idBeneficiario', width: 18 },
    // Cuenta a la que se le paga (la registrada hoy en el beneficiario)
    { header: 'Banco', key: 'banco', width: 20 },
    { header: 'Tipo de cuenta', key: 'tipoCuenta', width: 14 },
    { header: 'Número de cuenta', key: 'numeroCuenta', width: 20 },
    { header: 'Valor liquidación', key: 'liquidacion', width: 16, style: { numFmt: MONEDA } },
    { header: 'Valor solicitado', key: 'solicitado', width: 16, style: { numFmt: MONEDA } },
    { header: 'Valor pagado', key: 'pagado', width: 16, style: { numFmt: MONEDA } },
    { header: 'Fecha de pago', key: 'fechaPago', width: 14 },
    { header: 'Lote de pago', key: 'lote', width: 10 },
    { header: 'Número de egreso', key: 'egreso', width: 16 },
    { header: 'Número de factura', key: 'numeroFactura', width: 16 },
    { header: 'Tercero de la factura', key: 'terceroFactura', width: 30 },
    { header: 'Valor factura', key: 'valorFactura', width: 16, style: { numFmt: MONEDA } },
    { header: 'Base retención', key: 'baseRetencion', width: 16, style: { numFmt: MONEDA } },
    { header: '% retención', key: 'porcentajeRetencion', width: 11, style: { numFmt: '0.00%' } },
    { header: 'Retención en la fuente', key: 'retencion', width: 16, style: { numFmt: MONEDA } },
    { header: 'Total a pagar', key: 'totalPagar', width: 16, style: { numFmt: MONEDA } },
    { header: '4x1000', key: 'gmf', width: 12, style: { numFmt: MONEDA } },
    { header: 'Valor legalizado', key: 'legalizado', width: 16, style: { numFmt: MONEDA } },
    { header: 'Reintegro', key: 'reintegro', width: 14, style: { numFmt: MONEDA } },
    { header: 'Estado reintegro', key: 'estadoReintegro', width: 16 },
    { header: 'Cuenta de cobro', key: 'cuentaCobro', width: 16 },
    { header: 'Estado cuenta de cobro', key: 'estadoCuenta', width: 18 },
    { header: 'Documento contable', key: 'documentoContable', width: 18 },
    { header: 'Observación', key: 'observacion', width: 30 },
    { header: 'Observación legalización', key: 'observacionLegalizacion', width: 30 },
    { header: 'Observación factura', key: 'observacionFactura', width: 30 },
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
      anticipo: g.anticipo?.codigo,
      cliente: g.nombreClienteBanco,
      idCliente: g.identificacionClienteBanco,
      contrato: g.contrato,
      codigoBpr: g.codigoBpr,
      tramite: g.solicitudTramiteId,
      estadoTramite: g.solicitudTramiteId ? g.get('estadoTramite') as string | undefined : null,
      reporteRealizado: REPORTE_REALIZADO[String(g.get('reporteRealizado'))] ?? null,
      soporteTramitador: SOPORTE_TRAMITADOR[String(g.get('soporteTramitador'))] ?? null,
      tramitador: g.tramitador?.nombreTramitador,
      idTramitador: g.tramitador?.identificacion,
      placa: g.placa,
      transito: g.transito,
      matricula: g.matriculaInmobiliaria,
      beneficiario: g.beneficiario?.nombre,
      idBeneficiario: g.beneficiario?.identificacion,
      banco: g.beneficiario?.banco,
      tipoCuenta: g.beneficiario?.tipoCuenta,
      numeroCuenta: g.beneficiario?.numeroCuenta,
      liquidacion: dinero(g.valorLiquidacion),
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
      porcentajeRetencion: dinero(g.retencionPorcentaje ?? factura?.porcentajeRetencion),
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
      observacion: g.observacion,
      observacionLegalizacion: g.observacionLegalizacion,
      observacionFactura: factura?.observacion,
      motivoAnulacion: g.motivoAnulacion
    })
  }

  const encabezado = hoja.getRow(1)
  encabezado.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  encabezado.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } }
  hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: hoja.columns.length } }

  return libro.xlsx.writeBuffer()
}
