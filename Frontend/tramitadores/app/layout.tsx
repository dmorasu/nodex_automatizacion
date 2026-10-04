import type { Metadata, Viewport } from "next"
import { Manrope } from "next/font/google"
import Notificaciones from "@/components/ui/Notificaciones"
import "./globals.css"

const manrope = Manrope({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Nodex Tramitadores",
  description: "Trámites asignados, gastos y soportes de los tramitadores",
  applicationName: "Nodex Tramitadores",
  appleWebApp: { capable: true, title: "Nodex", statusBarStyle: "default" },
  icons: { icon: [{ url: "/iconos/32", sizes: "32x32" }, { url: "/iconos/192", sizes: "192x192" }], apple: "/iconos/180" }
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Usa toda la pantalla (incluida la zona de la cámara); los márgenes seguros se respetan con env(safe-area-inset-*)
  viewportFit: "cover",
  themeColor: "#ffffff"
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={manrope.className}>
        {children}
        <Notificaciones />
      </body>
    </html>
  )
}
