import { Table, Column, DataType, Model, ForeignKey, AllowNull } from 'sequelize-typescript'
import Usuarios from '../usuarios'
import Roles from './roles'

// Un usuario puede tener varios roles (ej: Legalización y Contabilidad)
@Table({
  tableName: 'gastos_usuario_roles',
  underscored: true,
  indexes: [{ unique: true, fields: ['usuario_id', 'rol_id'] }]
})
class UsuarioRoles extends Model {

  @ForeignKey(() => Usuarios)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare usuarioId: number

  @ForeignKey(() => Roles)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare rolId: number
}

export default UsuarioRoles
