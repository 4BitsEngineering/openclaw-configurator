import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

// Migración de `next lint` (deprecado en Next 15.5) a la CLI de ESLint 9 (flat
// config). `next/core-web-vitals` + `next/typescript` cargados vía FlatCompat,
// que es lo que genera create-next-app para Next 15.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      // scripts/*.mjs son utilidades de build (sync/test) en JS plano.
      "scripts/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default eslintConfig;
