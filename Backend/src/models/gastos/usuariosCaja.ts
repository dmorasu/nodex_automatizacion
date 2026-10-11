import { Table, Column, DataType, Model, AllowNull, ForeignKey, BelongsTo, Unique } from 'sequelize-typescript'
import Usuarios from '../usuarios'
import Bolsas from './bolsas'

// Caja que maneja cada Auxiliar de Tesorería - Caja menor (ej: la asistente de Bogotá): solo ve,
// paga, legaliza y reembolsa esa caja. Quien crea un gasto elige la caja en el formulario.
// Tabla propia de Gastos para no tocar la de usuarios (la comparte Nodex Trámites).
@Table({
  tableName: 'gastos_usuarios_caja',
  underscored: true
})
class UsuariosCaja extends Model {

  @Unique
  @ForeignKey(() => Usuarios)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare usuarioId: number

  @BelongsTo(() => Usuarios)
  declare usuario: Usuarios

  @ForeignKey(() => Bolsas)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare bolsaId: number

  @BelongsTo(() => Bolsas)
  declare bolsa: Bolsas
}

export default UsuariosCaja
