/** @type {import('next').NextConfig} */
// `next build` revisa los tipos y el lint: si hay errores, no compila (así no llegan a producción).
// Antes se ignoraban con eslint.ignoreDuringBuilds y typescript.ignoreBuildErrors.
// Sin el encabezado X-Powered-By (no anunciar con qué está hecha la app)
const nextConfig = {
  poweredByHeader: false
}

module.exports = nextConfig
