import { Table, Column, DataType, Model, AllowNull, ForeignKey, BelongsTo } from 'sequelize-typescript'
import Usuarios from '../usuarios'
import ReembolsosCaja from './reembolsosCaja'

// Historial de un reembolso de caja menor: cada paso queda con su fecha, quién lo hizo y el
// detalle (gastos agregados o quitados, motivo de cada devolución de Dirección, fecha de legalización…)
@Table({
  tableName: 'gastos_trazabilidad_reembolsos_caja',
  underscored: true,
  updatedAt: false
})
class TrazabilidadReembolsosCaja extends Model {

  @ForeignKey(() => ReembolsosCaja)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare reembolsoCajaId: number

  @BelongsTo(() => ReembolsosCaja)
  declare reembolso: ReembolsosCaja

  // CREADO | AGREGADO | QUITADO | ENVIADO | DEVUELTO | APROBADO | LEGALIZADO | ANULADO
  @AllowNull(false)
  @Column({ type: DataType.STRING(20) })
  declare accion: string

  @Column({ type: DataType.TEXT })
  declare detalle: string | null

  @ForeignKey(() => Usuarios)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare usuarioId: number

  @BelongsTo(() => Usuarios)
  declare usuario: Usuarios

  declare createdAt: Date
}

export default TrazabilidadReembolsosCaja
