import { Table, Column, DataType, Model, AllowNull, Default, Unique } from 'sequelize-typescript'

// Clientes empresariales (ej: Davivienda) a los que pertenecen los clientes que pagan anticipos.
// Los crea y edita el Administrador en Nodex Gastos → Catálogos.
@Table({
  tableName: 'gastos_clientes_empresariales',
  underscored: true
})
class ClientesEmpresariales extends Model {

  @Unique
  @AllowNull(false)
  @Column({ type: DataType.STRING(150) })
  declare nombre: string

  @AllowNull(false)
  @Default(true)
  @Column({ type: DataType.BOOLEAN })
  declare activo: boolean
}

export default ClientesEmpresariales
