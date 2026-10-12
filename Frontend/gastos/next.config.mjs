/** @type {import('next').NextConfig} */
const nextConfig = {
  // Sin el encabezado X-Powered-By (no anunciar con qué está hecha la app)
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // Los documentos de los gastos se suben por server action (hasta 10 archivos)
      bodySizeLimit: "50mb"
    }
  }
}

export default nextConfig
