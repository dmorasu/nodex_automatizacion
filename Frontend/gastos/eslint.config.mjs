import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

// Next 16 ya no trae `next lint`: se corre ESLint directo con la configuración de Next
const eslintConfig = [
  ...nextVitals,
  ...nextTs,
  // Reglas nuevas de React 19 que marcan código que funciona: quedan como aviso
  // para no reescribir componentes en la migración
  { rules: { "react-hooks/set-state-in-effect": "warn" } },
  { ignores: [".next/**", "node_modules/**", "public/**", "next-env.d.ts"] }
]

export default eslintConfig
