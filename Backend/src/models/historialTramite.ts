import { Table, Column, Model, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript'
import SolicitudTramites from './solicitudTramites'

export type CambioCampo = { campo: string, antes: string | null, despues: string | null }

// Bitácora de lo que se cambia en un trámite (quién, cuándo, qué valor tenía y cuál quedó).
// La llenan los hooks de services/historialTramites.ts. Programación, logística y cuenta de
// cobro guardan una sola fila que se sobrescribe: sin esta tabla no quedaría rastro.
// Índices en @Table con nombres de columna (underscored: true).
@Table({
  tableName: 'historial_tramites',
  underscored: true,
  updatedAt: false,
  indexes: [{ name: 'historial_tramites_tramite', fields: ['solicitud_tramite_id', 'created_at'] }]
})
class HistorialTramite extends Model {

  @ForeignKey(() => SolicitudTramites)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare solicitudTramiteId: number

  @BelongsTo(() => SolicitudTramites, { onDelete: 'CASCADE' })
  declare solicitudTramite: SolicitudTramites

  // DATOS (del trámite), PROGRAMACION, LOGISTICA, CUENTA_COBRO, ESTADO, SUBESTADO, TRAZABILIDAD
  @Column({ type: DataType.STRING(30), allowNull: false })
  declare seccion: string

  // CREADO, MODIFICADO o ELIMINADO
  @Column({ type: DataType.STRING(20), allowNull: false })
  declare accion: string

  // Id del registro afectado (estado, subestado, trazabilidad...) para unirlo con su tabla
  @Column({ type: DataType.INTEGER })
  declare registroId: number | null

  // Valores ya en texto legible (nombres en vez de ids): el historial no cambia si después
  // se renombra un cliente o un tramitador
  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: [] })
  declare cambios: CambioCampo[]

  @Column({ type: DataType.INTEGER })
  declare usuarioId: number | null

  @Column({ type: DataType.INTEGER })
  declare tramitadorId: number | null

  @Column({ type: DataType.STRING(150) })
  declare nombreUsuario: string | null

  // WEB, MASIVO, APP_TRAMITADOR o SISTEMA (utils/contextoPeticion)
  @Column({ type: DataType.STRING(20), allowNull: false })
  declare origen: string
}

export default HistorialTramite
