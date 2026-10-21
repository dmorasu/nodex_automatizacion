import { Table, Column, DataType, Model, AllowNull, ForeignKey, BelongsTo } from 'sequelize-typescript'
import Tramitador from '../tramitador'

// Posición del mensajero mientras tiene la ruta iniciada en su app (más o menos cada minuto,
// solo con la app abierta). Torre de control ve la última del día en el mapa de rutas.
// Las de más de DIAS_UBICACIONES días se borran solas (dato personal: solo lo necesario).
@Table({
  tableName: 'mensajeria_ubicaciones',
  underscored: true,
  updatedAt: false,
  // Con underscored, los índices van con el nombre real de la columna
  indexes: [{ name: 'mensajeria_ubicaciones_tramitador_fecha', fields: ['tramitador_id', 'registrada_en'] }]
})
class UbicacionMensajero extends Model {

  @ForeignKey(() => Tramitador)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare tramitadorId: number

  @BelongsTo(() => Tramitador, { onDelete: 'CASCADE' })
  declare tramitador: Tramitador

  @AllowNull(false)
  @Column({ type: DataType.DOUBLE })
  declare latitud: number

  @AllowNull(false)
  @Column({ type: DataType.DOUBLE })
  declare longitud: number

  @Column({ type: DataType.INTEGER })
  declare precisionMetros: number | null

  // Hora del servidor al recibirla (la del celular puede estar mal)
  @AllowNull(false)
  @Column({ type: DataType.DATE })
  declare registradaEn: Date
}

export default UbicacionMensajero
