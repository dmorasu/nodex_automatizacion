import { Table, Column, DataType, Model, AllowNull, ForeignKey, BelongsTo } from 'sequelize-typescript'
import Usuarios from '../usuarios'
import SolicitudesGasto from './solicitudesGasto'
import EstadosGasto from './estadosGasto'

// Un registro por cada cambio de estado de un gasto. La fecha es created_at.
@Table({
  tableName: 'gastos_trazabilidad',
  underscored: true
})
class TrazabilidadGastos extends Model {

  @ForeignKey(() => SolicitudesGasto)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare solicitudGastoId: number

  @BelongsTo(() => SolicitudesGasto)
  declare solicitudGasto: SolicitudesGasto

  // Null en el primer registro (creación del gasto)
  @Column({ type: DataType.INTEGER })
  declare estadoAnteriorId: number

  @BelongsTo(() => EstadosGasto, { foreignKey: 'estadoAnteriorId', as: 'estadoAnterior' })
  declare estadoAnterior: EstadosGasto

  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare estadoNuevoId: number

  @BelongsTo(() => EstadosGasto, { foreignKey: 'estadoNuevoId', as: 'estadoNuevo' })
  declare estadoNuevo: EstadosGasto

  @ForeignKey(() => Usuarios)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare usuarioId: number

  @BelongsTo(() => Usuarios)
  declare usuario: Usuarios

  @Column({ type: DataType.TEXT })
  declare observacion: string
}

export default TrazabilidadGastos
