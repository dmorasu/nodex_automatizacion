import { Table, Column, DataType, Model, Unique, AllowNull, Default } from 'sequelize-typescript'

@Table({
  tableName: 'gastos_estados_gasto',
  underscored: true
})
class EstadosGasto extends Model {

  @Unique
  @AllowNull(false)
  @Column({ type: DataType.STRING(50) })
  declare codigo: string

  @AllowNull(false)
  @Column({ type: DataType.STRING(100) })
  declare nombre: string

  // Posición del estado en el flujo (para ordenar filtros y líneas de tiempo)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare orden: number

  @Default(true)
  @Column({ type: DataType.BOOLEAN })
  declare activo: boolean
}

export default EstadosGasto
