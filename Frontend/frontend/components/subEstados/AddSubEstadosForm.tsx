"use client"

import { DialogTitle } from "@headlessui/react"
import { useRouter } from "next/navigation"
import { useFormState, useFormStatus } from "react-dom"
import { useEffect } from "react"
import { toast } from "react-toastify"

import CrearSubEstado from "@/actions/crear-subEstado"

import ErrorMessage from "../ui/ErrorMessage"
import SubEstadosCombobox from "./SubEstadosCombobox"

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <input
      type="submit"
      value={pending ? "Guardando..." : "Guardar"}
      disabled={pending}
      className="
        mt-5
        bg-violet-500
        text-white
        w-full
        p-3
        rounded-md
        disabled:bg-gray-400
        disabled:cursor-not-allowed
      "
    />
  )
}

export default function AddSubEstadoForm({
  closeModal,
  tramiteId,
  solicitudTramiteId
}: {
  closeModal: () => void
  tramiteId: number
  solicitudTramiteId: number
}) {

  const router = useRouter()

  const action =
    CrearSubEstado.bind(
      null,
      solicitudTramiteId
    )

  const [state, dispatch] =
    useFormState(action, {
      errors: [],
      success: ''
    })

  useEffect(() => {

    if (state.success) {

      toast.success(state.success)

      closeModal()

      router.refresh()
    }

  }, [state])

  return (
    <>
      <DialogTitle
        as="h3"
        className="font-black text-4xl text-violet-500 my-5"
      >
        Agregar SubEstado
      </DialogTitle>

      {state.errors.map(error => (
        <ErrorMessage key={error}>
          {error}
        </ErrorMessage>
      ))}

      <form
        action={dispatch}
        className="
          bg-gray-100
          shadow-lg
          rounded-lg
          p-10
          mt-10
        "
      >
        <SubEstadosCombobox
          tramiteId={tramiteId}
        />

        <SubmitButton />
      </form>
    </>
  )
}