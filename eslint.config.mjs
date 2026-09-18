import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Le contenu du hub est en français : l'apostrophe est dans presque
      // chaque phrase. JSX la rend correctement, l'échapper ne ferait
      // qu'abîmer la lisibilité des textes.
      "react/no-unescaped-entities": "off",
    },
  },
]);

export default eslintConfig;
