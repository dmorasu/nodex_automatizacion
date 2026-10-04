"use client"

import { ToastContainer } from "react-toastify"
import "react-toastify/ReactToastify.css"

export default function Notificaciones() {
  return <ToastContainer position="top-center" autoClose={4000} newestOnTop />
}
