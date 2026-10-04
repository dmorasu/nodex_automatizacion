import {Table, Column,DataType,BelongsTo,ForeignKey,Model,HasMany} from 'sequelize-typescript'
import SolicitudTramites from './solicitudTramites'

@Table({
    tableName:'Municipios'

})


class Municipios extends Model{
    @Column({
        type: DataType.STRING(100)
    })
    declare nombreMunicipio:string

    @Column({
        type: DataType.STRING(100)
    })
    declare departamento:string

    @Column({
        type: DataType.STRING(100)
    })
    declare regional:string

    @Column({
        type: DataType.DOUBLE
    })
    declare longitud:number

    @Column({
        type: DataType.DOUBLE
    })
    declare latitud:number
    @Column({
        type: DataType.STRING(100)
    })
    declare responsable:string

    // Analista por defecto (id de Usuarios) que toman los trámites nuevos de este municipio.
    // Reemplaza a `responsable` (texto), que se conserva por las notificaciones existentes.
    @Column({
        type: DataType.INTEGER
    })
    declare analistaId:number | null

    @HasMany(()=>SolicitudTramites,{
        onUpdate:'CASCADE',
        onDelete:'CASCADE'
    })
    declare solicitudTramites: SolicitudTramites

}
   
export default Municipios