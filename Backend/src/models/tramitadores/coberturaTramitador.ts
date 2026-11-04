import { Table, Column, DataType, Model, ForeignKey, BelongsTo, AllowNull } from 'sequelize-typescript'
import Tramitador from '../tramitador'
import Municipios from '../municipios'

// Municipios que atiende cada tramitador (Directorio de tramitadores, 2026-11-04). Antes era el
// texto libre "Municipios de cobertura" del Excel de Torre de control. La crea sync().
@Table({
  tableName: 'tramitadores_cobertura',
  underscored: true,
  updatedAt: false,
  indexes: [{ name: 'tramitadores_cobertura_unica', unique: true, fields: ['tramitador_id', 'municipio_id'] }]
})
class CoberturaTramitador extends Model {

  @ForeignKey(() => Tramitador)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare tramitadorId: number

  @BelongsTo(() => Tramitador, { onDelete: 'CASCADE' })
  declare tramitador: Tramitador

  @ForeignKey(() => Municipios)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare municipioId: number

  @BelongsTo(() => Municipios, { onDelete: 'CASCADE' })
  declare municipio: Municipios
}

export default CoberturaTramitador
