import { Table, Column, DataType, Model, ForeignKey, BelongsTo, AllowNull } from 'sequelize-typescript'
import RotuloEnvio from './rotuloEnvio'
import SolicitudTramites from '../solicitudTramites'
import DocumentoSolicitud from '../documentosSolicitud'

// Trámites que van en cada rótulo (un envío puede llevar varios) y el documento con el PDF que
// quedó en cada uno. La crea sync().
@Table({
  tableName: 'rotulos_envio_tramites',
  underscored: true,
  timestamps: false,
  indexes: [{ name: 'rotulos_envio_tramites_unica', unique: true, fields: ['rotulo_id', 'solicitud_tramite_id'] }]
})
class RotuloTramite extends Model {

  @ForeignKey(() => RotuloEnvio)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare rotuloId: number

  @BelongsTo(() => RotuloEnvio, { onDelete: 'CASCADE' })
  declare rotulo: RotuloEnvio

  @ForeignKey(() => SolicitudTramites)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare solicitudTramiteId: number

  @BelongsTo(() => SolicitudTramites, { onDelete: 'CASCADE' })
  declare solicitudTramite: SolicitudTramites

  // Si alguien borra el documento del trámite, el rótulo sigue en el historial
  @ForeignKey(() => DocumentoSolicitud)
  @Column({ type: DataType.INTEGER })
  declare documentoId: number | null

  @BelongsTo(() => DocumentoSolicitud, { onDelete: 'SET NULL' })
  declare documento: DocumentoSolicitud
}

export default RotuloTramite
