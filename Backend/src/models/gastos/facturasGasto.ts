import { Table, Column, DataType, Model, AllowNull, Default, Unique, ForeignKey, BelongsTo } from 'sequelize-typescript'
import Usuarios from '../usuarios'
import SolicitudesGasto from './solicitudesGasto'

// Factura real de un gasto pagado. La registra Legalización.
// Con ella se calcula la retención, el 4x1000, el valor a legalizar
// y el reintegro (valor pagado − valor de la factura).
@Table({
  tableName: 'gastos_facturas',
  underscored: true
})
class FacturasGasto extends Model {

  @ForeignKey(() => SolicitudesGasto)
  @Unique
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare solicitudGastoId: number

  @BelongsTo(() => SolicitudesGasto)
  declare solicitudGasto: SolicitudesGasto

  @Column({ type: DataType.STRING(50) })
  declare numeroFactura: string

  @AllowNull(false)
  @Default(true)
  @Column({ type: DataType.BOOLEAN })
  declare tieneFacturaReal: boolean

  // Tercero de la factura (puede ser distinto del beneficiario del pago)
  @Column({ type: DataType.STRING(30) })
  declare identificacionTerceroReal: string

  @Column({ type: DataType.STRING(200) })
  declare nombreTerceroReal: string

  @AllowNull(false)
  @Column({ type: DataType.DECIMAL(15, 2) })
  declare valorFactura: string

  // ── Retención (base manual) ────────────────

  @AllowNull(false)
  @Column({ type: DataType.DECIMAL(15, 2) })
  declare baseRetencion: string

  // Copia del porcentaje vigente al calcular (0.110000 = 11 %)
  @AllowNull(false)
  @Column({ type: DataType.DECIMAL(10, 6) })
  declare porcentajeRetencion: string

  // baseRetencion × porcentajeRetencion
  @AllowNull(false)
  @Column({ type: DataType.DECIMAL(15, 2) })
  declare retencionFuente: string

  // baseRetencion − retencionFuente
  @AllowNull(false)
  @Column({ type: DataType.DECIMAL(15, 2) })
  declare totalPagar: string

  // ── Legalización ───────────────────────────

  // Copia de la tasa vigente al calcular (0.004000 = 4x1000)
  @AllowNull(false)
  @Column({ type: DataType.DECIMAL(10, 6) })
  declare tasaGmf: string

  // valorFactura × tasaGmf
  @AllowNull(false)
  @Column({ type: DataType.DECIMAL(15, 2) })
  declare cuatroXMil: string

  // valorFactura + cuatroXMil → lo que suma a la cuenta de cobro y vuelve a la bolsa
  @AllowNull(false)
  @Column({ type: DataType.DECIMAL(15, 2) })
  declare valorLegalizado: string

  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare registradoPor: number

  @BelongsTo(() => Usuarios, { foreignKey: 'registradoPor', as: 'registrador' })
  declare registrador: Usuarios

  @Column({ type: DataType.TEXT })
  declare observacion: string
}

export default FacturasGasto
