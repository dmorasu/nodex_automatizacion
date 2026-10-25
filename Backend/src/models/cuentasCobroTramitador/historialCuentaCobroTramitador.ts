import { Table, Column, DataType, Model, AllowNull, ForeignKey, BelongsTo } from 'sequelize-typescript'
import CuentaCobroTramitador from './cuentaCobroTramitador'

// Qué pasó con la cuenta, quién y cuándo (usuario de Nodex o el tramitador desde la app)
@Table({
  tableName: 'tramitadores_cuentas_cobro_historial',
  underscored: true,
  updatedAt: false,
  indexes: [{ name: 'tramitadores_cuentas_cobro_historial_cuenta', fields: ['cuenta_id'] }]
})
class HistorialCuentaCobroTramitador extends Model {

  @ForeignKey(() => CuentaCobroTramitador)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare cuentaId: number

  @BelongsTo(() => CuentaCobroTramitador, { onDelete: 'CASCADE' })
  declare cuenta: CuentaCobroTramitador

  // "Generada", "Enviada al tramitador", "Valor cambiado"…
  @AllowNull(false)
  @Column({ type: DataType.STRING(100) })
  declare accion: string

  @Column({ type: DataType.STRING(20) })
  declare estadoNuevo: string | null

  @Column({ type: DataType.TEXT })
  declare detalle: string | null

  @Column({ type: DataType.INTEGER })
  declare usuarioId: number | null

  @Column({ type: DataType.INTEGER })
  declare tramitadorId: number | null

  // Nombre de quien lo hizo (para no tener que unir con usuarios o tramitadores al mostrarlo)
  @Column({ type: DataType.STRING(200) })
  declare nombre: string | null
}

export default HistorialCuentaCobroTramitador
