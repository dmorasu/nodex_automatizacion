// Posición actual del celular para marcar inicio/fin de ruta o de diligencia. Si no se puede
// leer a tiempo, se marca igual sin ubicación (la hora es lo importante).
export const posicionActual = (): Promise<{ latitud?: number, longitud?: number }> =>
  new Promise(resolver => {
    if (!("geolocation" in navigator)) return resolver({})
    navigator.geolocation.getCurrentPosition(
      p => resolver({ latitud: p.coords.latitude, longitud: p.coords.longitude }),
      () => resolver({}),
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 8_000 }
    )
  })
