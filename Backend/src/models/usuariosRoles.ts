import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo
} from "sequelize-typescript";

import Usuarios from "./usuarios";
import Roles from "./roles";

@Table({
  tableName: "UsuariosRoles"
})
class UsuariosRoles extends Model {

  @ForeignKey(() => Usuarios)
  @Column({
    type: DataType.INTEGER,
    allowNull: false
  })
  declare usuarioId: number;

  @BelongsTo(() => Usuarios)
  declare usuario: Usuarios;

  @ForeignKey(() => Roles)
  @Column({
    type: DataType.INTEGER,
    allowNull: false
  })
  declare rolId: number;

  @BelongsTo(() => Roles)
  declare rol: Roles;
}

export default UsuariosRoles;