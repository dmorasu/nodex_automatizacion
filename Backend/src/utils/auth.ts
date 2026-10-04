import bcrypt from  'bcrypt'
import { Sequelize } from 'sequelize'

// Condición para buscar un usuario por correo sin importar mayúsculas/minúsculas
// (comparación exacta: no usa ILIKE, donde "_" y "%" serían comodines)
export const correoIgual = (correo: string) =>
  Sequelize.where(Sequelize.fn('lower', Sequelize.col('correoUsuario')), String(correo).trim().toLowerCase())


export const hashcontrasena =async (contrasena:string)=>{
    const salt = await bcrypt.genSalt(10)
    return await bcrypt.hash(contrasena,salt)
}

export const checkContrasena =async (contrasena:string,hash:string) =>{
    

    return await bcrypt.compare(contrasena,hash)
    
    
}