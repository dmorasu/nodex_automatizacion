import {Router} from 'express'
import { handleInputErrors } from '../middleware/validation'
import {body} from 'express-validator'
import { AuthController } from '../controllers/AuthController'
import { autenticacion } from '../middleware/auth'
import { contrasenaSegura } from '../utils/politicaContrasena'



const router = Router()

// /create-account se quitó (2026-10-11): no hay registro público, los usuarios los crea el administrador

router.post('/login',
    body('correoUsuario')
        .isEmail().withMessage("Correo no valido"),
    body('contrasena')
        .notEmpty().withMessage('La contraseña no puede estar vacia'),
    handleInputErrors,
    AuthController.login)


router.post('/logout', autenticacion, AuthController.cerrarSesion)

router.get('/user',
    autenticacion,
    AuthController.usuario
)


router.post('/update-password',
    autenticacion,
    body('contrasenaActual').notEmpty().withMessage('La contraseña no puede estar vacia'),
    contrasenaSegura('contrasena', 'La contraseña nueva'),
    handleInputErrors,
    AuthController.updateContrasenaUsuario
)


export default router