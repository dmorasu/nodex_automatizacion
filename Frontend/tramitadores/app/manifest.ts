import type { MetadataRoute } from "next"

// Permite instalar la app en la pantalla de inicio del celular
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nodex Tramitadores",
    short_name: "Nodex",
    description: "Trámites asignados, gastos y soportes",
    start_url: "/inicio",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8fafc",
    theme_color: "#ffffff",
    lang: "es",
    icons: [
      { src: "/iconos/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/iconos/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/iconos/512", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ]
  }
}
