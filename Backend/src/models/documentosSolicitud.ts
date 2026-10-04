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
import Tramitador from "./tramitador";

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


  // Quién lo subió: un usuario de Nodex Trámites o un tramitador desde su app (uno de los dos)
  @ForeignKey(() => Usuarios)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare usuarioId: number | null;

  @BelongsTo(() => Usuarios)
  declare usuario: Usuarios;

  @ForeignKey(() => Tramitador)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare tramitadorId: number | null;

  @BelongsTo(() => Tramitador)
  declare tramitador: Tramitador;

  // Clase de documento que indica el tramitador al subirlo: SOPORTE, FACTURA u OTRO
  // (los subidos desde Nodex Trámites no lo llevan)
  @Column({
    type: DataType.STRING(30),
    allowNull: true,
  })
  declare tipoDocumento: string | null;


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