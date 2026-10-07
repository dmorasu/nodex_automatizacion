import { Table, Column, DataType, Model, Unique, AllowNull, Default } from 'sequelize-typescript'

// Beneficiarios de los pagos. Se reutilizan entre gastos para no
// digitar (y equivocar) los datos bancarios cada vez.
@Table({
  tableName: 'gastos_terceros',
  underscored: true
})
class Terceros extends Model {

  // NIT, CC, CE, ...
  @AllowNull(false)
  @Default('NIT')
  @Column({ type: DataType.STRING(10) })
  declare tipoIdentificacion: string

  @Unique
  @AllowNull(false)
  @Column({ type: DataType.STRING(30) })
  declare identificacion: string

  @AllowNull(false)
  @Column({ type: DataType.STRING(200) })
  declare nombre: string

  @Column({ type: DataType.STRING(100) })
  declare banco: string

  // AHORROS | CORRIENTE
  @Column({ type: DataType.STRING(20) })
  declare tipoCuenta: string

  @Column({ type: DataType.STRING(30) })
  declare numeroCuenta: string

  @Column({ type: DataType.STRING(100) })
  declare correo: string

  // Contacto de los clientes del banco que pagan anticipos
  @Column({ type: DataType.STRING(30) })
  declare telefono: string | null

  @Column({ type: DataType.STRING(200) })
  declare direccion: string | null

  @Default(true)
  @Column({ type: DataType.BOOLEAN })
  declare activo: boolean
}

export default Terceros
