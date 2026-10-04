import { Table, Column, DataType, Model, AllowNull, ForeignKey, BelongsTo, HasMany } from 'sequelize-typescript'
import Usuarios from '../usuarios'
import Bolsas from './bolsas'
import SolicitudesGasto from './solicitudesGasto'
import DocumentosGasto from './documentosGasto'

// Grupo de gastos que Tesorería paga de una sola vez (pago masivo)
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

  @HasMany(() => SolicitudesGasto)
  declare gastos: SolicitudesGasto[]

  // Soporte(s) del pago
  @HasMany(() => DocumentosGasto)
  declare documentos: DocumentosGasto[]
}

export default LotesPago
