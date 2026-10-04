import { Table, Column, DataType, Model, AllowNull, Default, Unique, ForeignKey, BelongsTo } from 'sequelize-typescript'
import Usuarios from '../usuarios'
import CuentasCobro from './cuentasCobro'

// Se crea automáticamente al legalizar una cuenta de cobro (pendiente de contabilizar).
// El estado se deduce de `contabilizado`: false = Pendiente, true = Contabilizado.
// Los datos de factura y tercero no se duplican: se leen de la cuenta y sus líneas.
@Table({
  tableName: 'gastos_contabilizaciones',
  underscored: true
})
class Contabilizaciones extends Model {

  @ForeignKey(() => CuentasCobro)
  @Unique
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare cuentaCobroId: number

  @BelongsTo(() => CuentasCobro)
  declare cuentaCobro: CuentasCobro

  @AllowNull(false)
  @Default(false)
  @Column({ type: DataType.BOOLEAN })
  declare contabilizado: boolean

  // Obligatorio al marcar contabilizado
  @Column({ type: DataType.STRING(50) })
  declare documentoContable: string

  @Column({ type: DataType.DATE })
  declare fechaContabilizacion: Date

  @Column({ type: DataType.INTEGER })
  declare contabilizadoPor: number

  @BelongsTo(() => Usuarios, { foreignKey: 'contabilizadoPor', as: 'contabilizador' })
  declare contabilizador: Usuarios
}

export default Contabilizaciones
