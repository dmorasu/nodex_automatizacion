import { Table, Column, DataType, Model, AllowNull, Default, ForeignKey, BelongsTo, HasMany } from 'sequelize-typescript'
import Usuarios from '../usuarios'
import Bolsas from './bolsas'
import SolicitudesGasto from './solicitudesGasto'
import DocumentosGasto from './documentosGasto'

// Grupo de gastos que Tesorería paga de una sola vez (pago masivo).
// Recorrido: PROGRAMADO (Tesorería) → APROBADO (Dirección de Negocio) → PAGADO (Tesorería con
// el soporte del banco). RECHAZADO si se le quitan todos los gastos.
@Table({
  tableName: 'gastos_lotes_pago',
  underscored: true
})
class LotesPago extends Model {

  @ForeignKey(() => Bolsas)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare bolsaId: number

  @BelongsTo(() => Bolsas)
  declare bolsa: Bolsas

  @AllowNull(false)
  @Default('PROGRAMADO')
  @Column({ type: DataType.STRING(20) })
  declare estado: string

  // Fecha programada mientras no se paga; al confirmar, la fecha real del pago
  @AllowNull(false)
  @Column({ type: DataType.DATEONLY })
  declare fechaPago: string

  @Column({ type: DataType.STRING(50) })
  declare numeroEgreso: string

  @AllowNull(false)
  @Column({ type: DataType.DECIMAL(15, 2) })
  declare total: string

  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare creadoPor: number

  @BelongsTo(() => Usuarios, { foreignKey: 'creadoPor', as: 'creador' })
  declare creador: Usuarios

  @Column({ type: DataType.TEXT })
  declare observacion: string

  @Column({ type: DataType.INTEGER })
  declare aprobadoPor: number | null

  @BelongsTo(() => Usuarios, { foreignKey: 'aprobadoPor', as: 'aprobador' })
  declare aprobador: Usuarios

  @Column({ type: DataType.DATE })
  declare fechaAprobacion: Date | null

  @Column({ type: DataType.INTEGER })
  declare confirmadoPor: number | null

  @BelongsTo(() => Usuarios, { foreignKey: 'confirmadoPor', as: 'confirmador' })
  declare confirmador: Usuarios

  @Column({ type: DataType.DATE })
  declare fechaConfirmacion: Date | null

  @HasMany(() => SolicitudesGasto)
  declare gastos: SolicitudesGasto[]

  // Soporte(s) del pago
  @HasMany(() => DocumentosGasto)
  declare documentos: DocumentosGasto[]
}

export default LotesPago
