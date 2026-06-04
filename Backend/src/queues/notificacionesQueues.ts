// queues/notification.queue.ts
import { Queue } from 'bullmq'
import { connection } from '../config/redis'

export const notificationQueue = new Queue('notifications', {
  connection
})