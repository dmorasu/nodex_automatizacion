import { Table, Column, DataType, Model, AllowNull, ForeignKey, BelongsTo, Default } from 'sequelize-typescript'
import JornadaMensajero from './jornadaMensajero'

// Pausa dentro de una ruta (por ahora solo el almuerzo). No parte la ruta: se descuenta
// del tiempo efectivo.
@Table({ tableName: 'mensajeria_pausas', underscored: true })
class PausaJornada extends Model {

  @ForeignKey(() => JornadaMensajero)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare jornadaId: number

  @BelongsTo(() => JornadaMensajero, { onDelete: 'CASCADE' })
  declare jornada: JornadaMensajero

  @AllowNull(false)
  @Default('ALMUERZO')
  @Column({ type: DataType.STRING(20) })
  declare tipo: string

  @AllowNull(false)
  @Column({ type: DataType.DATE })
  declare inicio: Date

  @Column({ type: DataType.DATE })
  declare fin: Date | null
}

export default PausaJornada
