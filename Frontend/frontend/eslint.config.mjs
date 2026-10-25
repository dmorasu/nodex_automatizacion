import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

// Next 16 ya no trae `next lint`: se corre ESLint directo con la configuración de Next
const eslintConfig = [
  ...nextVitals,
  ...nextTs,
  // Reglas nuevas de React 19 que marcan código que funciona: quedan como aviso
  // para no reescribir componentes en la migración
  { rules: { "react-hooks/set-state-in-effect": "warn" } },
  // Es para el Pages Router: aquí marcaba las descargas de Excel de /api/backend,
  // que sí deben ser <a> (next lint de la 14 no la aplicaba en el App Router)
  { rules: { "@next/next/no-html-link-for-pages": "off" } },
  { ignores: [".next/**", "node_modules/**", "public/**", "next-env.d.ts"] }
]

export default eslintConfig
