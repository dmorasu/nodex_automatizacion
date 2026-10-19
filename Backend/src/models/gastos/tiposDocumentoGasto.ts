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

  // Para qué servicio se sube: así cada cargue muestra solo los tipos que le corresponden
  // (al crear el gasto y antes de pagarlo: pago; ya pagado: legalización; con reintegro pendiente: reintegro)
  @Default(false)
  @AllowNull(false)
  @Column({ type: DataType.BOOLEAN })
  declare paraPago: boolean

  @Default(false)
  @AllowNull(false)
  @Column({ type: DataType.BOOLEAN })
  declare paraLegalizacion: boolean

  @Default(false)
  @AllowNull(false)
  @Column({ type: DataType.BOOLEAN })
  declare paraReintegro: boolean
}

export default TiposDocumentoGasto
