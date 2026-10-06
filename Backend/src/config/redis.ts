// El .env se carga aquí mismo: este módulo puede importarse antes que config/db
import 'dotenv/config'
import IORedis from 'ioredis'

// REDIS_DB separa entornos en el mismo Redis: si producción y un ensayo comparten servidor,
// cada uno usa su base (0, 1, …) y un worker nunca toma los trabajos del otro.
export const connection = new IORedis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT) || 6379,
  db: Number(process.env.REDIS_DB) || 0,
  maxRetriesPerRequest: null // 🔥 OBLIGATORIO para BullMQ
})
