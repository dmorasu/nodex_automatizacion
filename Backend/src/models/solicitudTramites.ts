import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  HasMany,
  HasOne,
  BeforeCreate,
  AfterSave
} from "sequelize-typescript";
import type { Transaction } from "sequelize";

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
import Estados from "./estados";

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

  // Analista encargado del trámite (id de Usuarios). Al crear toma el analista por defecto
  // del municipio; el Administrador de Torre de control lo puede cambiar.
  // Va sin @BelongsTo a propósito: una segunda asociación con Usuarios obligaría a poner
  // `as` en todos los include de Usuarios que ya existen. El nombre se lee con
  // ATRIBUTO_NOMBRE_ANALISTA (services/analistasTramites.ts).
  @Column({ type: DataType.INTEGER })
  declare analistaAsignado: number | null;

  // ── Ubicación de la dirección (rutas de mensajeros) ──
  @Column({ type: DataType.DOUBLE })
  declare latitud: number | null;

  @Column({ type: DataType.DOUBLE })
  declare longitud: number | null;

  // GOOGLE (convertida automáticamente) o MANUAL (punto puesto en el mapa)
  @Column({ type: DataType.STRING(20) })
  declare ubicacionFuente: string | null;

  // false si Google solo la ubicó de forma aproximada (barrio, calle o centro del municipio)
  @Column({ type: DataType.BOOLEAN })
  declare ubicacionPrecisa: boolean | null;

  // Texto que se convirtió: si la dirección cambia, se vuelve a ubicar
  @Column({ type: DataType.TEXT })
  declare ubicacionDireccion: string | null;

  @BeforeCreate
  static async asignarAnalistaDelMunicipio(solicitud: SolicitudTramites) {
    if (solicitud.analistaAsignado || !solicitud.municipiosId) return
    const municipio = await Municipios.findByPk(solicitud.municipiosId, { attributes: ['id', 'analistaId'] })
    solicitud.analistaAsignado = municipio?.analistaId ?? null
  }

  // Aviso push al tramitador cada vez que le asignan el trámite, venga de donde venga
  // (crear, editar, asignar, Excel o gestión masiva). Si hay transacción, sale al confirmarla.
  @AfterSave
  static avisarTramitadorAsignado(solicitud: SolicitudTramites, opciones: { transaction?: Transaction | null }) {
    if (!solicitud.changed('tramitadorId') || !solicitud.tramitadorId) return
    // El formulario puede mandar el id como texto ("5"): no es un cambio si es el mismo
    if (Number(solicitud.previous('tramitadorId')) === Number(solicitud.tramitadorId)) return

    const id = solicitud.id
    const tramitadorId = Number(solicitud.tramitadorId)
    // require diferido: el servicio usa otros modelos y arriba se cargaría en círculo
    const avisar = () => {
      const { avisarTramiteAsignado } = require('../services/tramitadores/avisosPush') as {
        avisarTramiteAsignado: (solicitudTramiteId: number, tramitadorId: number) => Promise<void>
      }
      void avisarTramiteAsignado(id, tramitadorId)
    }
    if (opciones.transaction) opciones.transaction.afterCommit(avisar)
    else avisar()
  }

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


@ForeignKey(() => Estados)
@Column({
  type: DataType.INTEGER,
  allowNull: true
})
declare estadoActualTramite: number;

@BelongsTo(() => Estados, {
  foreignKey: "estadoActualTramite"
})
declare estadoActual: Estados;

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
