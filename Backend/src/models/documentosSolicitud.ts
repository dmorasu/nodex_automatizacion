import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from "sequelize-typescript";

import SolicitudTramites from "./solicitudTramites";
import Usuarios from "./usuarios";

@Table({
  tableName: "DocumentosSolicitud",
})
class DocumentoSolicitud extends Model {

  @ForeignKey(() => SolicitudTramites)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare solicitudTramiteId: number;

  @BelongsTo(() => SolicitudTramites)
  declare solicitudTramite: SolicitudTramites;


  @ForeignKey(() => Usuarios)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare usuarioId: number;

  @BelongsTo(() => Usuarios)
  declare usuario: Usuarios;


  @Column({
    type: DataType.STRING(255),
    allowNull: false,
  })
  declare nombreOriginal: string;


  @Column({
    type: DataType.STRING(255),
    allowNull: false,
  })
  declare nombreArchivo: string;


  @Column({
    type: DataType.STRING(500),
    allowNull: false,
  })
  declare rutaArchivo: string;


  @Column({
    type: DataType.STRING(100),
    allowNull: false,
  })
  declare tipoArchivo: string;


  @Column({
    type: DataType.BIGINT,
    allowNull: false,
  })
  declare tamano: number;
}

export default DocumentoSolicitud;