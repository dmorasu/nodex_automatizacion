import { Table, Column, DataType, Model, AllowNull, ForeignKey, BelongsTo, HasMany } from 'sequelize-typescript'
import Tramitador from '../tramitador'
import PausaJornada from './pausaJornada'

// Una ruta del mensajero en un día, de "Iniciar ruta" a "Finalizar ruta" (puede haber varias
// en el día). Sirve para el tiempo de ruta y los km por GPS (PESV). Los km se calculan con las
// posiciones de mensajeria_ubicaciones entre el inicio y el fin, y se guardan al finalizar.
@Table({
  tableName: 'mensajeria_jornadas',
  underscored: true,
  indexes: [{ name: 'mensajeria_jornadas_tramitador_fecha', fields: ['tramitador_id', 'fecha'] }]
})
class JornadaMensajero extends Model {

  @ForeignKey(() => Tramitador)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare tramitadorId: number

  @BelongsTo(() => Tramitador)
  declare tramitador: Tramitador

  // Día de la ruta (Colombia)
  @AllowNull(false)
  @Column({ type: DataType.DATEONLY })
  declare fecha: string

  @AllowNull(false)
  @Column({ type: DataType.DATE })
  declare inicio: Date

  @Column({ type: DataType.DATE })
  declare fin: Date | null

  @Column({ type: DataType.DOUBLE })
  declare latitudInicio: number | null

  @Column({ type: DataType.DOUBLE })
  declare longitudInicio: number | null

  @Column({ type: DataType.DOUBLE })
  declare latitudFin: number | null

  @Column({ type: DataType.DOUBLE })
  declare longitudFin: number | null

  // Km recorridos según el GPS de la app (se guarda al finalizar la ruta)
  @Column({ type: DataType.DECIMAL(9, 2) })
  declare kmGps: string | null

  @HasMany(() => PausaJornada)
  declare pausas: PausaJornada[]
}

export default JornadaMensajero
