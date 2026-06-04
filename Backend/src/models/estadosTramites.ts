import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo
} from 'sequelize-typescript';

import Estados from './estados';
import SolicitudTramites from './solicitudTramites';
import TiposRechazo from './tiposRechazos';

@Table({
  tableName: 'EstadosTramites'
})
class EstadosTramites extends Model {

  @ForeignKey(() => Estados)
  @Column(DataType.INTEGER)
  declare estadoId: number;

  @BelongsTo(() => Estados)
  declare estado: Estados;

  @ForeignKey(() => SolicitudTramites)
  @Column(DataType.INTEGER)
  declare solicitudTramiteId: number;

  @BelongsTo(() => SolicitudTramites)
  declare solicitudTramites: SolicitudTramites;

  @ForeignKey(() => TiposRechazo)
  @Column({
    type: DataType.INTEGER,
    allowNull: true
  })
  declare tipoRechazoId: number;

  @BelongsTo(() => TiposRechazo)
  declare tipoRechazo: TiposRechazo;
}

export default EstadosTramites;