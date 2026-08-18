import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  HasMany,
  HasOne
} from "sequelize-typescript";

import Usuarios from "./usuarios";
import Tarifa from "./tarifa";
import Clientes from "./clientes";
import Tramitador from "./tramitador";
import Logistica from "./logistica";
import Programacion from "./programacion";
import Operaciones from "./operaciones";
import Entidad from "./entidad";
import Municipios from "./municipios";
import EstadosTramites from "./estadosTramites";
import Trazabilidad from "./trazabilidad";
import CuentaCobros from "./cuentaCobro";
import Tramite from "./tramite";
import EvaluacionSolicitud from "./evaluacionSolicitud"
import SubEstadosSolicitud from './subEstadosSolicitud';
import DocumentoSolicitud from "./documentosSolicitud";

@Table({
  tableName: "SolicitudTramites",
})
class SolicitudTramites extends Model {

  @Column({ type: DataType.DATE })
  declare fechaAsignacion: Date;

  @Column({ type: DataType.DATE })
  declare fechaDiligenciamiento: Date;

  @Column({ type: DataType.DATE })
  declare fechaEntregaResultado: Date;

  @Column({ type: DataType.STRING(100) })
  declare matriculaInmobiliaria: string;

  @Column({ type: DataType.TEXT })
  declare detalleSolicitud: string;

  @Column({ type: DataType.STRING(200) })
  declare placa: string;

  
  @Column({ type: DataType.STRING(100) })
  declare direccionTramite: string;



  @Column({ type: DataType.TEXT })
  declare documentosAportados: string;

  @Column({ type: DataType.TEXT })
  declare descripcionTramite: string;

  // ===== Relaciones Base =====

  @ForeignKey(() => Usuarios)
  declare usuarioId: number;

  @BelongsTo(() => Usuarios)
  declare usuario: Usuarios;

  @ForeignKey(() => Tarifa)
  declare tarifaId: number;

  @BelongsTo(() => Tarifa)
  declare tarifa: Tarifa;

  @ForeignKey(() => Clientes)
  declare clienteId: number;

  @BelongsTo(() => Clientes)
  declare clientes: Clientes;

  @ForeignKey(() => Tramitador)
  declare tramitadorId: number;

  @BelongsTo(() => Tramitador)
  declare tramitador: Tramitador;

  @ForeignKey(() => Operaciones)
  declare operacionesId: number;

  @BelongsTo(() => Operaciones)
  declare operaciones: Operaciones;

  @ForeignKey(() => Entidad)
  declare entidadId: number;

  @BelongsTo(() => Entidad)
  declare entidad: Entidad;

  @ForeignKey(() => Municipios)
  declare municipiosId: number;

  @BelongsTo(() => Municipios)
  declare municipios: Municipios;

  @ForeignKey(()=>Tramite)
declare tramiteId:number

@BelongsTo(()=>Tramite)
declare tramite: Tramite

  // ===== Relaciones 1 - N =====

  @HasOne(() => EvaluacionSolicitud, {
  foreignKey: "solicitudTramiteId"
})
declare evaluacion: EvaluacionSolicitud

  @HasMany(() => DocumentoSolicitud, {
  foreignKey: "solicitudTramiteId",
})
declare documentos: DocumentoSolicitud[];

  @HasMany(() => EstadosTramites, { foreignKey: "solicitudTramiteId" })
  declare estadosTramites: EstadosTramites[];

  @HasMany(() => Trazabilidad, { foreignKey: "solicitudTramiteId" })
  declare trazabilidad: Trazabilidad[];

  @HasMany(() => SubEstadosSolicitud,{
    foreignKey:'solicitudTramiteId'
})
declare subEstadosSolicitud: SubEstadosSolicitud[];

  // ===== Relaciones 1 - 1 =====

  @HasOne(() => Programacion, { foreignKey: "solicitudTramiteId" })
  declare programacion: Programacion;

  @HasOne(() => Logistica, { foreignKey: "solicitudTramiteId" })
  declare logistica: Logistica;

  @HasOne(() => CuentaCobros, { foreignKey: "solicitudTramiteId" })
  declare cuentaCobro: CuentaCobros;
}

export default SolicitudTramites;
