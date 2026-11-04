import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo
} from "sequelize-typescript";

import Transportadora from "./trasnportadora";
import SolicitudTramites from "./solicitudTramites";

@Table({
  tableName: "Logistica",
  timestamps: true
})
export default class Logistica extends Model {

  @Column({
    type: DataType.STRING(50)
  })
  declare numeroGuia: string;


  @Column({
    type: DataType.STRING(50)
  })
  declare destinatario: string;


  @Column({
    type: DataType.DECIMAL(10,2)
  })
  declare valorEnvio: number;

  // 2026-11-04 · Pago contra entrega: lo paga quien recibe, así que no se registra valor del envío.
  // Sin contra entrega el valor es obligatorio (reglas en services/reglasLogistica.ts)
  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false
  })
  declare pagoContraEntrega: boolean;


  @Column({
    type: DataType.DATEONLY
  })
  declare fechaProgramacionLogistica: string;


  @Column({
    type: DataType.DATEONLY
  })
  declare fechaEntregaTransportadora: string;


  // 🔑 Foreign Key
  @ForeignKey(() => Transportadora)
  @Column({
    type: DataType.INTEGER
  })
  declare transportadoraId: number;


  // Relación
  @BelongsTo(() => Transportadora)
  declare transportadora: Transportadora;


  @ForeignKey(() => SolicitudTramites)
  @Column({ unique: true })
  declare solicitudTramiteId: number;


  @BelongsTo(() => SolicitudTramites)
  declare solicitudTramites: SolicitudTramites;

}