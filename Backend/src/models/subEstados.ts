import {
    Table,
    Column,
    Model,
    DataType,
    ForeignKey,
    BelongsTo,
    HasMany
} from 'sequelize-typescript';

import Tramite from './tramite';
import SubEstadosSolicitud from './subEstadosSolicitud';

@Table({
    tableName: 'SubEstados'
})
class SubEstados extends Model {

    @Column({
        type: DataType.STRING(200),
        allowNull: false
    })
    declare nombre: string;

    @ForeignKey(() => Tramite)
    @Column(DataType.INTEGER)
    declare tramiteId: number;

    @BelongsTo(() => Tramite)
    declare tramite: Tramite;

    @HasMany(() => SubEstadosSolicitud)
    declare historial: SubEstadosSolicitud[];
}

export default SubEstados;