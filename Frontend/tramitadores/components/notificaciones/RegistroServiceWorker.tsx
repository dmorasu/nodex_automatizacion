"use client"

import { useEffect } from "react"
import { registrarServiceWorker } from "@/src/lib/push"

// Registra (o actualiza) el service worker que recibe las notificaciones push
export default function RegistroServiceWorker() {
  useEffect(() => {
    void registrarServiceWorker()
  }, [])
  return null
}
