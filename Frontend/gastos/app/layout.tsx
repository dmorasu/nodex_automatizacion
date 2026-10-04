import type { Metadata } from "next"
import { Manrope } from "next/font/google"
import Notificaciones from "@/components/ui/Notificaciones"
import "./globals.css"

const manrope = Manrope({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Nodex Gastos",
  description: "Gestión de gastos, pagos y legalizaciones"
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <body className={manrope.className}>
        {children}
        <Notificaciones />
      </body>
    </html>
  )
}
