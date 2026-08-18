"use client"

import {
  Frown,
  Meh,
  Smile,
  Star
} from "lucide-react"


type Props = {
  value: number
  onChange: (value: number) => void
}


export default function RatingInput({
  value,
  onChange
}: Props) {


  const opciones = [

    {
      value: 1,
      label: "Malo",
      icon: Frown
    },

    {
      value: 2,
      label: "Regular",
      icon: Meh
    },

    {
      value: 3,
      label: "Bueno",
      icon: Smile
    },

    {
      value: 4,
      label: "Excelente",
      icon: Star
    }

  ]


  return (

    <div className="
      grid
      grid-cols-2
      sm:grid-cols-4
      gap-2
      w-full
    ">

      {opciones.map((opcion) => {

        const selected =
          value === opcion.value

        const Icon =
          opcion.icon


        return (

          <button
            key={opcion.value}
            type="button"
            onClick={() =>
              onChange(opcion.value)
            }
            className={`
              group

              flex
              flex-col
              items-center
              justify-center
              gap-1

              min-h-[64px]
              px-2
              py-2

              rounded-lg
              border

              text-xs
              font-medium

              transition-all

              ${
                selected

                  ? `
                    bg-sky-500
                    border-sky-500
                    text-white
                    shadow-sm
                  `

                  : `
                    bg-white
                    border-slate-200
                    text-slate-500

                    hover:bg-sky-50
                    hover:border-sky-200
                    hover:text-sky-600
                  `
              }
            `}
          >

            <Icon
              size={18}
              className={`
                transition

                ${
                  selected
                    ? "text-white"
                    : "text-slate-400 group-hover:text-sky-500"
                }
              `}
            />


            <span className="text-xs">
              {opcion.label}
            </span>

          </button>

        )

      })}

    </div>

  )
}