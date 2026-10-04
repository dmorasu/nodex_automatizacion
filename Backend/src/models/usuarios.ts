import {
  Table,
  Column,
  DataType,
  HasMany,
  BelongsToMany,
  Model,
  Unique
} from "sequelize-typescript";

import SolicitudTramites from "./solicitudTramites";
import Roles from "./gastos/roles";
import UsuarioRoles from "./gastos/usuarioRoles";



@Table({
  tableName: "Usuarios"
})

class Usuarios extends Model {

  @Column({
    type: DataType.STRING(100)
  })
  declare nombreUsuario: string;


  @Column({
    type: DataType.STRING(100)
  })
  declare contrasena: string;


  @Unique(true)
  @Column({
    type: DataType.STRING(100)
  })
  declare correoUsuario: string;


  @Column({
    type: DataType.STRING(100)
  })
  declare area: string;


  @HasMany(() => SolicitudTramites, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE"
  })
  declare solicitudTramites: SolicitudTramites;


  // Roles del módulo de gastos (tabla gastos.usuario_roles)
  @BelongsToMany(() => Roles, () => UsuarioRoles)
  declare roles: Roles[];


}

export default Usuarios;