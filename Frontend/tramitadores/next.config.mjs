/** @type {import('next').NextConfig} */
const nextConfig = {
  // Sin el encabezado X-Powered-By (no anunciar con qué está hecha la app)
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // Los soportes (fotos y PDF) se suben por server action: hasta 10 archivos de 15 MB
      bodySizeLimit: "160mb"
    }
  }
}

export default nextConfig
