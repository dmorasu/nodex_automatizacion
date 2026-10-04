import { Table, Column, DataType, Model, AllowNull, Default } from 'sequelize-typescript'

// Fondo por línea de negocio desde el que se pagan los gastos.
// El saldo se mueve SOLO con registros en movimientos de bolsa (fase 4);
// saldoActual es la copia del saldo que se actualiza en la misma transacción.
@Table({
  tableName: 'gastos_bolsas',
  underscored: true
})
class Bolsas extends Model {

  @AllowNull(false)
  @Column({ type: DataType.STRING(100) })
  declare nombre: string

  @Column({ type: DataType.STRING(100) })
  declare lineaNegocio: string

  @AllowNull(false)
  @Default(0)
  @Column({ type: DataType.DECIMAL(15, 2) })
  declare saldoActual: string

  @Default(true)
  @Column({ type: DataType.BOOLEAN })
  declare activo: boolean
}

export default Bolsas
