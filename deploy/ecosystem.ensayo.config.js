// PM2 · Nodex (ENSAYO) en el mismo servidor que la producción actual (4000/3000).
// Uso, desde la raíz del repositorio en el servidor:
//   pm2 start deploy/ecosystem.ensayo.config.js
//   pm2 save
// Puertos: API 9000 · Trámites 9001 · Gastos 9002 · Tramitadores 9003 (solo 127.0.0.1;
// al público se llega por Nginx con HTTPS). Los nombres empiezan por "nodex-ensayo-" para no
// confundirse con los procesos de producción en `pm2 list`.
const path = require('path')
const raiz = path.join(__dirname, '..')

module.exports = {
  apps: [
    {
      name: 'nodex-ensayo-api',
      cwd: path.join(raiz, 'Backend'),
      script: 'dist/index.js',
      // Una sola instancia: el programador de WhatsApp y cachés viven en memoria
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'production', PORT: 9000 }
    },
    {
      name: 'nodex-ensayo-worker',
      cwd: path.join(raiz, 'Backend'),
      script: 'dist/workers/notificacionesWorker.js',
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'production' }
    },
    {
      name: 'nodex-ensayo-tramites',
      cwd: path.join(raiz, 'Frontend/frontend'),
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 9001 -H 127.0.0.1',
      env: { NODE_ENV: 'production' }
    },
    {
      name: 'nodex-ensayo-gastos',
      cwd: path.join(raiz, 'Frontend/gastos'),
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 9002 -H 127.0.0.1',
      env: { NODE_ENV: 'production' }
    },
    {
      name: 'nodex-ensayo-tramitadores',
      cwd: path.join(raiz, 'Frontend/tramitadores'),
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 9003 -H 127.0.0.1',
      env: { NODE_ENV: 'production' }
    }
  ]
}
