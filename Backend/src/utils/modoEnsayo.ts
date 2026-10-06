// =====================================
// MODO ENSAYO (MODO_ENSAYO=si en el .env)
// Para un despliegue de prueba con una copia de la base de producción, que tiene teléfonos y
// correos reales: no se programan los WhatsApp automáticos, ningún WhatsApp sale a Twilio y
// todos los correos van solo a CORREO_ENSAYO (sin copias). En producción NO se define.
// =====================================

export const modoEnsayo = () => process.env.MODO_ENSAYO === 'si'

export const correoEnsayo = () => process.env.CORREO_ENSAYO?.trim() || null
