import {
    Table,
    Model,
    ForeignKey,
    BelongsTo,
    Column,
    DataType
} from 'sequelize-typescript';

import SolicitudTramites from './solicitudTramites';
import SubEstados from './subEstados';

@Table({
    tableName: 'SubEstadosSolicitud'
})
class SubEstadosSolicitud extends Model {

    @ForeignKey(() => SolicitudTramites)
    @Column(DataType.INTEGER)
    declare solicitudTramiteId: number;

    @BelongsTo(() => SolicitudTramites)
    declare solicitudTramite: SolicitudTramites;

    @ForeignKey(() => SubEstados)
    @Column(DataType.INTEGER)
    declare subEstadoId: number;

    @BelongsTo(() => SubEstados)
    declare subEstado: SubEstados;

    @Column({
        type: DataType.TEXT,
        allowNull: true
    })
    declare observacion: string;
}

export default SubEstadosSolicitud;