import { Table, Column, DataType, Model, AllowNull, ForeignKey, BelongsTo } from 'sequelize-typescript'
import SolicitudTramites from './solicitudTramites'

// Cada placa de un trámite en su propia fila (2026-11-12). El trámite puede tener hasta 10 placas
// (los viejos pueden tener más: se escribían todas en un solo campo). SolicitudTramites.placa sigue
// guardando el texto legible ("ABC123, DEF456") que usan los correos, WhatsApp, rótulos y gastos;
// esta tabla es el índice para buscar por cualquiera de las placas. La llena el hook del trámite
// (services/placasTramite.ts) y el ajuste de esquema la completa con los trámites anteriores.
@Table({
  tableName: 'solicitud_tramite_placas',
  underscored: true,
  timestamps: false,
  indexes: [
    { name: 'solicitud_tramite_placas_tramite_placa', unique: true, fields: ['solicitud_tramite_id', 'placa'] },
    // varchar_pattern_ops: sirve para la placa exacta y para "empieza por" (LIKE 'ABC%')
    { name: 'solicitud_tramite_placas_placa', fields: [{ name: 'placa', operator: 'varchar_pattern_ops' }] }
  ]
})
class PlacaTramite extends Model {

  @ForeignKey(() => SolicitudTramites)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER, onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  declare solicitudTramiteId: number

  @BelongsTo(() => SolicitudTramites, { onDelete: 'CASCADE' })
  declare solicitudTramite: SolicitudTramites

  // Normalizada: mayúsculas, sin espacios, guiones ni otros signos (ABC123)
  @AllowNull(false)
  @Column({ type: DataType.STRING(20) })
  declare placa: string

  // Posición en que se escribió (1 = la primera)
  @AllowNull(false)
  @Column({ type: DataType.SMALLINT })
  declare orden: number
}

export default PlacaTramite
