import { Table, Column, DataType, Model, Unique, AllowNull } from 'sequelize-typescript'

// Valores configurables usados en los cálculos (retención, 4x1000, ...)
@Table({
  tableName: 'gastos_parametros',
  underscored: true
})
class Parametros extends Model {

  @Unique
  @AllowNull(false)
  @Column({ type: DataType.STRING(50) })
  declare clave: string

  // Ej: 0.110000 = 11 %  |  0.004000 = 4x1000
  @AllowNull(false)
  @Column({ type: DataType.DECIMAL(10, 6) })
  declare valor: string

  @Column({ type: DataType.STRING(200) })
  declare descripcion: string
}

export default Parametros
