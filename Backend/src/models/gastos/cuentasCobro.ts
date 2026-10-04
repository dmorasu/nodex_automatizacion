import { Table, Column, DataType, Model, AllowNull, Unique, ForeignKey, BelongsTo, HasMany, HasOne } from 'sequelize-typescript'
import Usuarios from '../usuarios'
import EstadosCuentaCobro from './estadosCuentaCobro'
import CuentasCobroGastos from './cuentasCobroGastos'
import TrazabilidadCuentasCobro from './trazabilidadCuentasCobro'
import Contabilizaciones from './contabilizaciones'

// Agrupa gastos pagados para legalizarlos. Al legalizarla, el valor legalizado
// de cada gasto vuelve a su bolsa y se crea la contabilización pendiente.
@Table({
  tableName: 'gastos_cuentas_cobro',
  underscored: true
})
class CuentasCobro extends Model {

  @Unique
  @AllowNull(false)
  @Column({ type: DataType.STRING(50) })
  declare numeroCuentaCobro: string

  @ForeignKey(() => EstadosCuentaCobro)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare estadoId: number

  @BelongsTo(() => EstadosCuentaCobro)
  declare estado: EstadosCuentaCobro

  @Column({ type: DataType.DATEONLY })
  declare fechaRadicacion: string

  // Sumas de las líneas (calculadas en el backend)
  @AllowNull(false)
  @Column({ type: DataType.DECIMAL(15, 2), defaultValue: 0 })
  declare totalFacturas: string

  @AllowNull(false)
  @Column({ type: DataType.DECIMAL(15, 2), defaultValue: 0 })
  declare totalCuatroXMil: string

  @AllowNull(false)
  @Column({ type: DataType.DECIMAL(15, 2), defaultValue: 0 })
  declare totalLegalizado: string

  // Código armado con el número del gasto y el tipo (fórmula pendiente de definir)
  @Column({ type: DataType.STRING(100) })
  declare atajoLegalizacion: string

  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare creadoPor: number

  @BelongsTo(() => Usuarios, { foreignKey: 'creadoPor', as: 'creador' })
  declare creador: Usuarios

  @Column({ type: DataType.DATE })
  declare fechaLegalizacion: Date

  @Column({ type: DataType.TEXT })
  declare observacion: string

  @Column({ type: DataType.TEXT })
  declare motivoAnulacion: string

  @HasMany(() => CuentasCobroGastos)
  declare lineas: CuentasCobroGastos[]

  @HasMany(() => TrazabilidadCuentasCobro)
  declare trazabilidad: TrazabilidadCuentasCobro[]

  @HasOne(() => Contabilizaciones)
  declare contabilizacion: Contabilizaciones
}

export default CuentasCobro
