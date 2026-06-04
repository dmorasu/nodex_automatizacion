// testWpp.ts
import 'dotenv/config'
import { sendWhatsApp } from './services/whatsappService'

const run = async () => {
  console.log('🚀 Iniciando prueba')

  await sendWhatsApp(
    '573108352957', // 🔥 cambia por tu número real
    '🔥 Prueba real desde Node'
  )

  console.log('✅ Fin prueba')
}

run().catch(err => {
  console.error('❌ ERROR:', err)
})