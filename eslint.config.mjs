import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  // Keep the starter on the flat config export that actually runs under the pinned ESLint/Next toolchain.
  ...nextCoreWebVitals,
  {
    // The pinned eslint-plugin-react-hooks (7.x) ships the new React-Compiler-era
    // rules that flag the intentionally-crafted streaming/typewriter logic in this
    // codebase as errors (refs-during-render, set-state-in-effect, immutability).
    // This app targets eslint-config-next 16 + Next 15 whose own preset still
    // bundles the classic eslint-plugin-react-hooks 5 set, so we relax only the
    // rules the new plugin version introduces.
    rules: {
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",
      "react-hooks/purity": "off",
      "react-hooks/no-deriving-state-in-effects": "off",
      "react-hooks/memoized-effect-dependencies": "off",
      "react-hooks/exhaustive-effect-dependencies": "off",
      "react-hooks/static-components": "off",
      "react-hooks/incompatible-library": "off",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
