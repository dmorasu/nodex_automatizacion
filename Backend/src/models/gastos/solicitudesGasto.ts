import { Table, Column, DataType, Model, AllowNull, Default, Unique, ForeignKey, BelongsTo, HasMany, HasOne } from 'sequelize-typescript'
import Operaciones from '../operaciones'
import SolicitudTramites from '../solicitudTramites'
import Tramitador from '../tramitador'
import Usuarios from '../usuarios'
import TiposGasto from './tiposGasto'
import FormasPago from './formasPago'
import EstadosGasto from './estadosGasto'
import Terceros from './terceros'
import Bolsas from './bolsas'
import LotesPago from './lotesPago'
import TrazabilidadGastos from './trazabilidadGastos'
import DocumentosGasto from './documentosGasto'
import Reintegros from './reintegros'
import CuentasCobroGastos from './cuentasCobroGastos'
import FacturasGasto from './facturasGasto'
import LegalizacionesCaja from './legalizacionesCaja'
import Anticipos from './anticipos'

// Solicitud de gasto. Nace en estado SOLICITADO por un valor solicitado y la paga Tesorería.
// La retención se define al crear (solo inmuebles); el 4x1000 se calcula al registrar la factura real.
@Table({
  tableName: 'gastos_solicitudes',
  underscored: true
})
class SolicitudesGasto extends Model {

  // GAS-2026-000123. Se asigna justo después de crear el registro
  @Unique
  @Column({ type: DataType.STRING(20) })
  declare codigo: string

  // ── Relaciones ─────────────────────────────

  @ForeignKey(() => Operaciones)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare operacionId: number

  @BelongsTo(() => Operaciones)
  declare operacion: Operaciones

  // Opcional: hay gastos que no tienen trámite (ej: pago de impuestos)
  @ForeignKey(() => SolicitudTramites)
  @Column({ type: DataType.INTEGER })
  declare solicitudTramiteId: number

  @BelongsTo(() => SolicitudTramites)
  declare solicitudTramite: SolicitudTramites

  @ForeignKey(() => Tramitador)
  @Column({ type: DataType.INTEGER })
  declare tramitadorId: number

  @BelongsTo(() => Tramitador)
  declare tramitador: Tramitador

  // Anticipo del cliente del que salió el gasto: se paga de la bolsa de anticipos y
  // se descuenta del saldo de ese cliente. No se puede cambiar después de crear el gasto
  @ForeignKey(() => Anticipos)
  @Column({ type: DataType.INTEGER })
  declare anticipoId: number | null

  @BelongsTo(() => Anticipos)
  declare anticipo: Anticipos

  @ForeignKey(() => TiposGasto)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare tipoGastoId: number

  @BelongsTo(() => TiposGasto)
  declare tipoGasto: TiposGasto

  @ForeignKey(() => FormasPago)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare formaPagoId: number

  @BelongsTo(() => FormasPago)
  declare formaPago: FormasPago

  @ForeignKey(() => EstadosGasto)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare estadoId: number

  @BelongsTo(() => EstadosGasto)
  declare estado: EstadosGasto

  @ForeignKey(() => Terceros)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare beneficiarioId: number

  @BelongsTo(() => Terceros)
  declare beneficiario: Terceros

  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare creadoPor: number

  @BelongsTo(() => Usuarios, { foreignKey: 'creadoPor', as: 'creador' })
  declare creador: Usuarios

  @Column({ type: DataType.INTEGER })
  declare actualizadoPor: number

  @BelongsTo(() => Usuarios, { foreignKey: 'actualizadoPor', as: 'actualizador' })
  declare actualizador: Usuarios

  // ── Datos del gasto ────────────────────────

  // Reembolsable = se le cobra al cliente: va a cuenta de cobro y el dinero vuelve a la bolsa.
  // No reembolsable = lo asume la bolsa: se legaliza con la factura y se contabiliza solo.
  @AllowNull(false)
  @Default(true)
  @Column({ type: DataType.BOOLEAN })
  declare reembolsable: boolean

  @Column({ type: DataType.STRING(50) })
  declare numeroFactura: string

  @AllowNull(false)
  @Column({ type: DataType.STRING(200) })
  declare conceptoPago: string

  // Inmueble
  @Column({ type: DataType.STRING(50) })
  declare matriculaInmobiliaria: string

  // Vehículo
  @Column({ type: DataType.STRING(20) })
  declare placa: string

  @Column({ type: DataType.STRING(100) })
  declare transito: string

  // ── Cliente / banco ────────────────────────

  @Column({ type: DataType.STRING(50) })
  declare contrato: string

  @Column({ type: DataType.STRING(200) })
  declare nombreClienteBanco: string

  @Column({ type: DataType.STRING(30) })
  declare identificacionClienteBanco: string

  @Column({ type: DataType.STRING(50) })
  declare codigoBpr: string

  // ── Valores ────────────────────────────────

  // Valor del gasto pedido al crearlo (sin retención)
  @AllowNull(false)
  @Column({ type: DataType.DECIMAL(15, 2) })
  declare valorSolicitadoPago: string

  // ── Retención en la fuente (solo gastos de inmueble; null en los demás) ──

  @Column({ type: DataType.DECIMAL(15, 2) })
  declare retencionBase: string

  // Fracción (0.110000 = 11 %). Por defecto el parámetro RETENCION_FUENTE; se puede cambiar
  @Column({ type: DataType.DECIMAL(10, 6) })
  declare retencionPorcentaje: string

  // retencionBase × retencionPorcentaje
  @Column({ type: DataType.DECIMAL(15, 2) })
  declare retencionValor: string

  // retencionBase − retencionValor
  @Column({ type: DataType.DECIMAL(15, 2) })
  declare retencionTotalPagar: string

  @Column({ type: DataType.TEXT })
  declare observacion: string

  // ── Tesorería (null hasta el pago) ─────────

  // Valor que Tesorería programó para pago (por defecto el solicitado). Pasa a
  // valorRealmentePagado al confirmar el pago; vuelve a null si el gasto sale del lote.
  @Column({ type: DataType.DECIMAL(15, 2) })
  declare valorProgramado: string | null

  // Se llena al confirmar el pago con el valor programado
  @Column({ type: DataType.DECIMAL(15, 2) })
  declare valorRealmentePagado: string

  // Se elige al crear el gasto (obligatorio en la aplicación); Tesorería puede cambiarla al pagar.
  // Acepta null en la base de datos por los gastos creados antes de esta regla.
  @ForeignKey(() => Bolsas)
  @Column({ type: DataType.INTEGER })
  declare bolsaId: number

  @BelongsTo(() => Bolsas)
  declare bolsa: Bolsas

  @Column({ type: DataType.DATEONLY })
  declare fechaPago: string

  @Column({ type: DataType.STRING(50) })
  declare numeroEgreso: string

  @ForeignKey(() => LotesPago)
  @Column({ type: DataType.INTEGER })
  declare lotePagoId: number

  @BelongsTo(() => LotesPago)
  declare lotePago: LotesPago

  @Column({ type: DataType.STRING(100) })
  declare atajoTesoreria: string

  // ── Legalización ───────────────────────────

  // Ej: "Legalizado con cuenta de cobro CC-045"
  @Column({ type: DataType.TEXT })
  declare observacionLegalizacion: string

  // ── Contabilidad (solo NO reembolsables; los reembolsables se contabilizan por cuenta de cobro) ──

  @Column({ type: DataType.STRING(50) })
  declare documentoContable: string

  @Column({ type: DataType.DATE })
  declare fechaContabilizacion: Date

  @Column({ type: DataType.INTEGER })
  declare contabilizadoPor: number

  @BelongsTo(() => Usuarios, { foreignKey: 'contabilizadoPor', as: 'contabilizador' })
  declare contabilizador: Usuarios

  // ── Anulación ──────────────────────────────

  @Column({ type: DataType.TEXT })
  declare motivoAnulacion: string

  // ── Historial ──────────────────────────────

  @HasMany(() => TrazabilidadGastos)
  declare trazabilidad: TrazabilidadGastos[]

  @HasMany(() => DocumentosGasto)
  declare documentos: DocumentosGasto[]

  // Factura real (la registra Legalización después del pago)
  @HasOne(() => FacturasGasto)
  declare factura: FacturasGasto

  // Legalización en caja menor (la registra Tesorería después de entregar el efectivo)
  @HasOne(() => LegalizacionesCaja)
  declare legalizacionCaja: LegalizacionesCaja

  @HasMany(() => Reintegros)
  declare reintegros: Reintegros[]

  // Historial de cuentas de cobro donde ha estado (solo una activa a la vez)
  @HasMany(() => CuentasCobroGastos)
  declare lineasCuentaCobro: CuentasCobroGastos[]
}

export default SolicitudesGasto
