import { Table, Column, Model, DataType } from 'sequelize-typescript'

// Áreas de los usuarios (Vehículos, TI, Gestión de activos...). Agrupan a los usuarios: al buscar,
// cada uno encuentra los trámites y gastos que crearon los de su misma área.
// Se administran en Nodex Trámites → Catálogos → Áreas.
@Table({
  tableName: 'Areas'
})
class Areas extends Model {

  @Column({
    type: DataType.STRING(100),
    allowNull: false
  })
  declare nombre: string

}

export default Areas
