/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      // Los soportes (fotos y PDF) se suben por server action: hasta 10 archivos de 15 MB
      bodySizeLimit: "160mb"
    }
  }
}

export default nextConfig
