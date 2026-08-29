import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import { globalIgnores } from "eslint/config";

// eslint-config-next@15 (pinned per CLAUDE.md's Next.js 15 stack rule)
// ships the legacy eslintrc-style config shape, not the flat-config array
// shape create-next-app's default scaffold assumes (that scaffold targets
// eslint-config-next@16). FlatCompat is Next.js's own documented bridge
// for this -- applied from the start this time, not discovered via a
// build failure the way it was on the previous repo.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
];

export default eslintConfig;
