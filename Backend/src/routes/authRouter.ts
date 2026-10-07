import {Router} from 'express'
import { handleInputErrors } from '../middleware/validation'
import {body} from 'express-validator'
import { AuthController } from '../controllers/AuthController'
import { autenticacion } from '../middleware/auth'
import { contrasenaSegura } from '../utils/politicaContrasena'



const router = Router()

router.post('/create-account',
    body('nombreUsuario').notEmpty().withMessage('El nombre no puede estar vacio'),
    contrasenaSegura(),
    body('correoUsuario')
        .isEmail().withMessage('Correo no valido'),
    handleInputErrors,
    AuthController.createAccount)

router.post('/login',
    body('correoUsuario')
        .isEmail().withMessage("Correo no valido"),
    body('contrasena')
        .notEmpty().withMessage('La contraseña no puede estar vacia'),
    handleInputErrors,
    AuthController.login)


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