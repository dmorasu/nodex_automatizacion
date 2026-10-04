import { Table, Column, DataType, Model, Unique, AllowNull, Default, BelongsToMany } from 'sequelize-typescript'
import Usuarios from '../usuarios'
import UsuarioRoles from './usuarioRoles'

@Table({
  tableName: 'gastos_roles',
  underscored: true
})
class Roles extends Model {

  @Unique
  @AllowNull(false)
  @Column({ type: DataType.STRING(50) })
  declare codigo: string

  @AllowNull(false)
  @Column({ type: DataType.STRING(100) })
  declare nombre: string

  @Column({ type: DataType.STRING(200) })
  declare descripcion: string

  @Default(true)
  @Column({ type: DataType.BOOLEAN })
  declare activo: boolean

  @BelongsToMany(() => Usuarios, () => UsuarioRoles)
  declare usuarios: Usuarios[]
}

export default Roles
