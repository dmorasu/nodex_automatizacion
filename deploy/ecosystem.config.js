// PM2 · Nodex (PRODUCCIÓN). Es el mismo ensayo de nodex5.0 que pasó a producción el 2026-10-23
// (base nodex, sin modo ensayo); solo cambian los nombres para que en `pm2 list` no diga "ensayo".
// Uso, desde la raíz del repositorio en el servidor:
//   pm2 start deploy/ecosystem.config.js
//   pm2 save
// Puertos: API 9000 · Trámites 9001 · Gastos 9002 · Tramitadores 9003 (solo 127.0.0.1;
// al público se llega por Nginx con HTTPS).
const path = require('path')
const raiz = path.join(__dirname, '..')

module.exports = {
  apps: [
    {
      name: 'nodex-api',
      cwd: path.join(raiz, 'Backend'),
      script: 'dist/index.js',
      // Una sola instancia: el programador de WhatsApp y cachés viven en memoria
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'production', PORT: 9000 }
    },
    {
      name: 'nodex-worker',
      cwd: path.join(raiz, 'Backend'),
      script: 'dist/workers/notificacionesWorker.js',
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'production' }
    },
    {
      name: 'nodex-tramites',
      cwd: path.join(raiz, 'Frontend/frontend'),
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 9001 -H 127.0.0.1',
      env: { NODE_ENV: 'production' }
    },
    {
      name: 'nodex-gastos',
      cwd: path.join(raiz, 'Frontend/gastos'),
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 9002 -H 127.0.0.1',
      env: { NODE_ENV: 'production' }
    },
    {
      name: 'nodex-tramitadores',
      cwd: path.join(raiz, 'Frontend/tramitadores'),
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 9003 -H 127.0.0.1',
      env: { NODE_ENV: 'production' }
    }
  ]
}
