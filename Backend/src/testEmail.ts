import 'dotenv/config'
import { sendEmail } from './services/emailServices'

const run = async () => {
  await sendEmail(
    'dmora@gomezpinedaabogados.com',
    '🔥 Prueba desde Node',
    '<h1>Correo funcionando correctamente</h1>'
  )
}

run().catch(console.error)