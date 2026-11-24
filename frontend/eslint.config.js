import javascriptRules from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import typescriptRules from "typescript-eslint";

export default typescriptRules.config(
  { ignores: ["dist"] },
  {
    extends: [javascriptRules.configs.recommended, ...typescriptRules.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // Rendering raw HTML is how cross-site scripting gets in; Kushlof never does it.
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: "Do not render raw HTML. Use plain text or a sandboxed iframe.",
        },
      ],
    },
  },
);
