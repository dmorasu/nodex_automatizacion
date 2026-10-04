import { Table, Column, DataType, Model, AllowNull, ForeignKey, BelongsTo } from 'sequelize-typescript'
import Usuarios from '../usuarios'
import SolicitudesGasto from './solicitudesGasto'
import EstadosReintegro from './estadosReintegro'

// Sobrante que el tramitador devuelve (ej: se le giraron 200.000 y el trámite costó 190.000).
// Al marcarlo reintegrado, el valor vuelve a la bolsa del gasto.
@Table({
  tableName: 'gastos_reintegros',
  underscored: true
})
class Reintegros extends Model {

  @ForeignKey(() => SolicitudesGasto)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare solicitudGastoId: number

  @BelongsTo(() => SolicitudesGasto)
  declare solicitudGasto: SolicitudesGasto

  @ForeignKey(() => EstadosReintegro)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare estadoId: number

  @BelongsTo(() => EstadosReintegro)
  declare estado: EstadosReintegro

  @AllowNull(false)
  @Column({ type: DataType.DECIMAL(15, 2) })
  declare valorReintegro: string

  @Column({ type: DataType.DATEONLY })
  declare fechaReintegro: string

  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare registradoPor: number

  @BelongsTo(() => Usuarios, { foreignKey: 'registradoPor', as: 'registrador' })
  declare registrador: Usuarios

  @Column({ type: DataType.TEXT })
  declare observacion: string
}

export default Reintegros
