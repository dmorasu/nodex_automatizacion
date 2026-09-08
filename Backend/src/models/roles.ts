import {
  Table,
  Column,
  DataType,
  Model,
  HasMany,
  BelongsToMany
} from "sequelize-typescript";

import UsuariosRoles from "./usuariosroles";
import RolesPermisos from "./rolesPermisos";
import Permisos from "./permisos";
import Usuarios from "./usuarios";

@Table({
  tableName: "Roles"
})
class Roles extends Model {

  @Column({
    type: DataType.STRING(100),
    allowNull: false
  })
  declare nombre: string;

  @Column({
    type: DataType.TEXT
  })
  declare descripcion: string;

  @HasMany(() => UsuariosRoles, {
    foreignKey: "rolId"
  })
  declare usuariosRoles: UsuariosRoles[];

  @HasMany(() => RolesPermisos, {
    foreignKey: "rolId"
  })
  declare rolesPermisos: RolesPermisos[];

  @BelongsToMany(() => Usuarios, {
    through: () => UsuariosRoles,
    foreignKey: "rolId",
    otherKey: "usuarioId"
  })
  declare usuarios: Usuarios[];

  @BelongsToMany(() => Permisos, {
    through: () => RolesPermisos,
    foreignKey: "rolId",
    otherKey: "permisoId"
  })
  declare permisos: Permisos[];
}

export default Roles;