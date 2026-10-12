import jwt from 'jsonwebtoken'

// Sesión del sistema interno (Trámites y Gastos): 7 días. Lleva la versión de sesión del usuario
// (v): al cambiar o restablecer la contraseña o al cerrar sesión se sube y los tokens anteriores
// dejan de servir. La cookie de las apps dura lo mismo (DURACION_SESION_SEGUNDOS).
export const DURACION_SESION_SEGUNDOS = 7 * 24 * 60 * 60

export const generateJWT = (id: number, versionSesion: number) =>
  jwt.sign({ id, v: versionSesion }, process.env.JWT_SECRET, { expiresIn: DURACION_SESION_SEGUNDOS })
