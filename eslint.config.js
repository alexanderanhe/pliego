import js from "@eslint/js";
import ts from "typescript-eslint";
import a11y from "eslint-plugin-jsx-a11y";
export default ts.config(
  {
    ignores: [
      "build/**",
      ".react-router/**",
      "node_modules/**",
      "playwright-report/**",
      "test-results/**",
      "public/sw.js",
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "jsx-a11y": a11y },
    rules: {
      ...a11y.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
