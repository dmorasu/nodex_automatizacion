/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      // Los documentos de los gastos se suben por server action (hasta 10 archivos)
      bodySizeLimit: "50mb"
    }
  }
}

export default nextConfig
