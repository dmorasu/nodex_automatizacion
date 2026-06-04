import {
  Table,
  Column,
  Model,
  DataType,
  HasMany
} from "sequelize-typescript";

import EstadosTramites from "./estadosTramites";

@Table({
  tableName: "TiposRechazo"
})
class TiposRechazo extends Model {

  @Column({
    type: DataType.STRING(200),
    allowNull: false
  })
  declare nombre: string;

  @HasMany(() => EstadosTramites)
  declare estadosTramites: EstadosTramites[];
}

export default TiposRechazo;