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

    @HasMany(()=>SolicitudTramites,{
        onUpdate:'CASCADE',
        onDelete:'CASCADE'
    })
    declare solicitudTramites: SolicitudTramites

}
   
export default Municipios