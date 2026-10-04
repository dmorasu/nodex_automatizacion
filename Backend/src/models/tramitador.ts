import { Table, Column, DataType, HasMany, HasOne, Model, ForeignKey, BelongsTo } from 'sequelize-typescript'
import SolicitudTramites from './solicitudTramites'
import AccesoTramitador from './tramitadores/accesoTramitador'
import SedeMensajeria from './mensajeria/sedeMensajeria'

@Table({
  tableName: 'Tramitador'
})
class Tramitador extends Model {

  @Column({
    type: DataType.STRING(200),
    allowNull: false
  })
  declare nombreTramitador: string

  @Column({
    type: DataType.STRING(50),
    allowNull: false,
    unique: true
  })
  declare identificacion: string

  @Column({
    type: DataType.STRING(150),
    allowNull: false
  })
  declare correoTramitador: string

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true
  })
  declare activo: boolean

  @Column({
    type: DataType.STRING(100)
  })
  declare region: string

  @Column({
    type: DataType.STRING(20)
  })
  declare numeroTramitador: string

  // Mensajero: tiene ruta diaria (mapa en Torre de control y "Mi ruta" en su app)
  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false
  })
  declare esMensajero: boolean

  // Oficina de la que sale su ruta
  @ForeignKey(() => SedeMensajeria)
  @Column({ type: DataType.INTEGER })
  declare sedeId: number | null

  @BelongsTo(() => SedeMensajeria)
  declare sede: SedeMensajeria

  @HasMany(() => SolicitudTramites, {
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  })
  declare solicitudesTramites: SolicitudTramites[]

  // Acceso a la app Nodex Tramitadores (si se le creó)
  @HasOne(() => AccesoTramitador)
  declare acceso: AccesoTramitador
}

export default Tramitador
