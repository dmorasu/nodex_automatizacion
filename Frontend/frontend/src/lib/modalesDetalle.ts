// Los modales del detalle del trámite se abren y cierran con parámetros en la dirección
// (?addLogistica=true&showModal=true). Con router.push / replace cada cambio volvía a
// pedir al servidor todo el detalle y el modal tardaba en abrir y en cerrar (Next 16 ya
// no reutiliza la página). Cambiar solo la dirección del navegador lo hace al instante:
// Next mantiene useSearchParams al día y, al guardar, revalidatePath ya trae los datos nuevos.

export const abrirModal = (pathname: string, modal: string) =>
  window.history.pushState(null, "", `${pathname}?${modal}=true&showModal=true`)

export const cambiarModal = (pathname: string, modal: string) =>
  window.history.replaceState(null, "", `${pathname}?${modal}=true&showModal=true`)

export const cerrarModal = (pathname: string) =>
  window.history.replaceState(null, "", pathname)
