"use client"

import dynamic from "next/dynamic"

// Los modales del detalle solo se cargan en el navegador. Next 16 no permite
// `ssr: false` en una página de servidor, por eso la carga se hace desde aquí.
const ModalContainerCliente = dynamic(() => import("./ModalContainer"), { ssr: false })

export default ModalContainerCliente
