// Service worker de Nodex Tramitadores: recibe las notificaciones push aunque la app esté
// cerrada y, al tocarlas, abre la pantalla que corresponde. No guarda páginas en caché.
// El backend envía { titulo, cuerpo, url, etiqueta } (services/tramitadores/avisosPush.ts).

self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", evento => evento.waitUntil(self.clients.claim()))

self.addEventListener("push", evento => {
  let aviso = {}
  try {
    aviso = evento.data ? evento.data.json() : {}
  } catch {
    aviso = { cuerpo: evento.data ? evento.data.text() : "" }
  }

  evento.waitUntil(
    self.registration.showNotification(aviso.titulo || "Nodex Tramitadores", {
      body: aviso.cuerpo || "",
      icon: "/iconos/192.png",
      badge: "/iconos/192.png",
      lang: "es",
      // Misma etiqueta = reemplaza la anterior (ej: el recordatorio de reintegros de cada día)
      tag: aviso.etiqueta || undefined,
      renotify: Boolean(aviso.etiqueta),
      data: { url: aviso.url || "/inicio" }
    })
  )
})

self.addEventListener("notificationclick", evento => {
  evento.notification.close()
  const destino = new URL(evento.notification.data?.url || "/inicio", self.location.origin).href

  evento.waitUntil((async () => {
    // Si la app ya está abierta, la trae al frente en esa pantalla; si no, la abre
    const ventanas = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
    const abierta = ventanas.find(ventana => new URL(ventana.url).origin === self.location.origin)
    if (abierta) {
      await abierta.focus()
      return abierta.navigate(destino).catch(() => self.clients.openWindow(destino))
    }
    return self.clients.openWindow(destino)
  })())
})
