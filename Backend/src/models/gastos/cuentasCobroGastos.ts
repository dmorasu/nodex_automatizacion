import { Table, Column, DataType, Model, AllowNull, Default, ForeignKey, BelongsTo } from 'sequelize-typescript'
import CuentasCobro from './cuentasCobro'
import SolicitudesGasto from './solicitudesGasto'

// Un gasto dentro de una cuenta de cobro, con los datos reales de su factura.
// Un gasto solo puede estar en una cuenta activa (se controla en el servicio).
@Table({
  tableName: 'gastos_cuentas_cobro_gastos',
  underscored: true
})
class CuentasCobroGastos extends Model {

  @ForeignKey(() => CuentasCobro)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare cuentaCobroId: number

  @BelongsTo(() => CuentasCobro)
  declare cuentaCobro: CuentasCobro

  @ForeignKey(() => SolicitudesGasto)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare solicitudGastoId: number

  @BelongsTo(() => SolicitudesGasto)
  declare solicitudGasto: SolicitudesGasto

  @AllowNull(false)
  @Default(true)
  @Column({ type: DataType.BOOLEAN })
  declare tieneFacturaReal: boolean

  @AllowNull(false)
  @Column({ type: DataType.DECIMAL(15, 2) })
  declare valorFactura: string

  // Copia de la tasa vigente al calcular (0.004000 = 4x1000)
  @AllowNull(false)
  @Column({ type: DataType.DECIMAL(10, 6) })
  declare tasaGmf: string

  // valorFactura × tasaGmf
  @AllowNull(false)
  @Column({ type: DataType.DECIMAL(15, 2) })
  declare cuatroXMil: string

  // valorFactura + cuatroXMil → lo que vuelve a la bolsa al legalizar
  @AllowNull(false)
  @Column({ type: DataType.DECIMAL(15, 2) })
  declare valorLegalizado: string

  // Tercero de la factura o soporte (puede ser distinto del beneficiario del pago)
  @Column({ type: DataType.STRING(30) })
  declare identificacionTerceroReal: string

  @Column({ type: DataType.STRING(200) })
  declare nombreTerceroReal: string

  @Column({ type: DataType.TEXT })
  declare observacion: string
}

export default CuentasCobroGastos
