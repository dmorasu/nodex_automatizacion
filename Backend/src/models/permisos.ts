import {
  Table,
  Column,
  DataType,
  Model,
  HasMany,
  BelongsToMany
} from "sequelize-typescript";

import RolesPermisos from "./rolesPermisos";
import Roles from "./roles"

@Table({
  tableName: "Permisos"
})
class Permisos extends Model {

  @Column({
    type: DataType.STRING(150),
    allowNull: false,
    unique: true
  })
  declare codigo: string;

  @Column({
    type: DataType.STRING(150),
    allowNull: false
  })
  declare nombre: string;

  @Column({
    type: DataType.TEXT
  })
  declare descripcion: string;

  @HasMany(() => RolesPermisos, {
    foreignKey: "permisoId"
  })
  declare rolesPermisos: RolesPermisos[];

  @BelongsToMany(() => Roles, {
    through: () => RolesPermisos,
    foreignKey: "permisoId",
    otherKey: "rolId"
  })
  declare roles: Roles[];
}

export default Permisos;