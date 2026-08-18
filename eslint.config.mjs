import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

/**
 * ESLint flat config.
 *
 * Next 16 eliminó el comando `next lint`: el linter se corre directo con
 * `npm run lint` (eslint .). Desde esta versión `eslint-config-next` ya se
 * publica en formato flat, así que se importa tal cual — sin `FlatCompat`.
 */
const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "design_bundle/**",
      "next-env.d.ts",
    ],
  },
  ...coreWebVitals,
  ...typescript,
];

export default eslintConfig;
