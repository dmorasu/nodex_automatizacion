import { Table, Column, DataType, Model, Unique, AllowNull, Default } from 'sequelize-typescript'

@Table({
  tableName: 'gastos_tipos_documento_gasto',
  underscored: true
})
class TiposDocumentoGasto extends Model {

  @Unique
  @AllowNull(false)
  @Column({ type: DataType.STRING(50) })
  declare codigo: string

  @AllowNull(false)
  @Column({ type: DataType.STRING(100) })
  declare nombre: string

  @Default(true)
  @Column({ type: DataType.BOOLEAN })
  declare activo: boolean
}

export default TiposDocumentoGasto
