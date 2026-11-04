import { Table, Column, DataType, Model, ForeignKey, BelongsTo, HasMany, AllowNull } from 'sequelize-typescript'
import Usuarios from '../usuarios'
import RotuloTramite from './rotuloTramite'

// Rótulos de envío generados desde Nodex (Ayudas Torre de Control, fase 3, 2026-11-04). Antes se
// hacían en el HTML "Generador de rótulos" y no quedaba registro. `datos` guarda el rótulo ya
// armado (remitente, destinatario, pago…) para volver a sacar el mismo PDF aunque cambien los
// datos del tramitador o de la sede. La crea sync().
@Table({ tableName: 'rotulos_envio', underscored: true, updatedAt: false })
class RotuloEnvio extends Model {

  @ForeignKey(() => Usuarios)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare usuarioId: number

  @BelongsTo(() => Usuarios)
  declare usuario: Usuarios

  // gpa | tram
  @AllowNull(false)
  @Column({ type: DataType.STRING(10) })
  declare origen: string

  // cliente | tram | gpa | tercero
  @AllowNull(false)
  @Column({ type: DataType.STRING(10) })
  declare destino: string

  @AllowNull(false)
  @Column({ type: DataType.STRING(255) })
  declare destinatario: string

  @AllowNull(false)
  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  declare contraentrega: boolean

  // GPA o DESTINATARIO: quién asume el costo del envío
  @AllowNull(false)
  @Column({ type: DataType.STRING(15) })
  declare paga: string

  @Column({ type: DataType.STRING(100) })
  declare transportadora: string | null

  // carta | peq
  @AllowNull(false)
  @Column({ type: DataType.STRING(10) })
  declare tamano: string

  @AllowNull(false)
  @Column({ type: DataType.JSONB })
  declare datos: Record<string, unknown>

  @HasMany(() => RotuloTramite)
  declare tramites: RotuloTramite[]
}

export default RotuloEnvio
