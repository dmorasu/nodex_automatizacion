import { Table, Column, DataType, Model, AllowNull, ForeignKey, BelongsTo } from 'sequelize-typescript'
import Usuarios from '../usuarios'
import CuentasCobro from './cuentasCobro'
import EstadosCuentaCobro from './estadosCuentaCobro'

// Un registro por cada cambio de estado de una cuenta de cobro. La fecha es created_at.
@Table({
  tableName: 'gastos_trazabilidad_cuentas_cobro',
  underscored: true
})
class TrazabilidadCuentasCobro extends Model {

  @ForeignKey(() => CuentasCobro)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare cuentaCobroId: number

  @BelongsTo(() => CuentasCobro)
  declare cuentaCobro: CuentasCobro

  @Column({ type: DataType.INTEGER })
  declare estadoAnteriorId: number

  @BelongsTo(() => EstadosCuentaCobro, { foreignKey: 'estadoAnteriorId', as: 'estadoAnterior' })
  declare estadoAnterior: EstadosCuentaCobro

  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare estadoNuevoId: number

  @BelongsTo(() => EstadosCuentaCobro, { foreignKey: 'estadoNuevoId', as: 'estadoNuevo' })
  declare estadoNuevo: EstadosCuentaCobro

  @ForeignKey(() => Usuarios)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare usuarioId: number

  @BelongsTo(() => Usuarios)
  declare usuario: Usuarios

  @Column({ type: DataType.TEXT })
  declare observacion: string
}

export default TrazabilidadCuentasCobro
