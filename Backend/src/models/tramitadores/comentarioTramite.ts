import { Table, Column, DataType, Model, ForeignKey, BelongsTo, AllowNull } from 'sequelize-typescript'
import SolicitudTramites from '../solicitudTramites'
import Tramitador from '../tramitador'
import Usuarios from '../usuarios'

// Conversación del trámite entre el tramitador (app) y el equipo interno (Nodex Trámites).
// Va aparte de la trazabilidad: esa alimenta las notificaciones al cliente y estos
// comentarios no deben salir allí. Cada comentario lo escribe un tramitador o un usuario.
@Table({
  tableName: 'tramitadores_comentarios',
  underscored: true
})
class ComentarioTramite extends Model {

  @ForeignKey(() => SolicitudTramites)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare solicitudTramiteId: number

  @BelongsTo(() => SolicitudTramites, { onDelete: 'CASCADE' })
  declare solicitudTramite: SolicitudTramites

  @ForeignKey(() => Tramitador)
  @Column({ type: DataType.INTEGER })
  declare tramitadorId: number | null

  @BelongsTo(() => Tramitador)
  declare tramitador: Tramitador

  @ForeignKey(() => Usuarios)
  @Column({ type: DataType.INTEGER })
  declare usuarioId: number | null

  @BelongsTo(() => Usuarios)
  declare usuario: Usuarios

  @AllowNull(false)
  @Column({ type: DataType.TEXT })
  declare comentario: string
}

export default ComentarioTramite
