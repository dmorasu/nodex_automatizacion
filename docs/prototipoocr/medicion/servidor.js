// Servidor local para las pruebas: sirve la carpeta de la medición (html, archivos, node_modules)
const http = require('http'), fs = require('fs'), path = require('path')
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.json': 'application/json', '.gz': 'application/gzip' }
module.exports = (DIR, extra = {}) => http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0])
  const archivo = extra[url] || path.join(DIR, url)
  if (!extra[url] && !path.resolve(archivo).startsWith(path.resolve(DIR))) { res.writeHead(403); return res.end() }
  fs.readFile(archivo, (e, buf) => {
    if (e) { res.writeHead(404); return res.end() }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(archivo).toLowerCase()] || 'application/octet-stream' })
    res.end(buf)
  })
})
