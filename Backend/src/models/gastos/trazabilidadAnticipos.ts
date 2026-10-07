import { Table, Column, DataType, Model, AllowNull, ForeignKey, BelongsTo } from 'sequelize-typescript'
import Usuarios from '../usuarios'
import Anticipos from './anticipos'

// Historial de un anticipo: cada cambio de estado (y las correcciones del creador)
@Table({
  tableName: 'gastos_trazabilidad_anticipos',
  underscored: true,
  updatedAt: false
})
class TrazabilidadAnticipos extends Model {

  @ForeignKey(() => Anticipos)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare anticipoId: number

  @BelongsTo(() => Anticipos, { onDelete: 'CASCADE' })
  declare anticipo: Anticipos

  @Column({ type: DataType.STRING(20) })
  declare estadoAnterior: string | null

  @AllowNull(false)
  @Column({ type: DataType.STRING(20) })
  declare estadoNuevo: string

  @ForeignKey(() => Usuarios)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare usuarioId: number

  @BelongsTo(() => Usuarios)
  declare usuario: Usuarios

  @Column({ type: DataType.TEXT })
  declare observacion: string | null
}

export default TrazabilidadAnticipos
