import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import globals from "globals";
import importPlugin from "eslint-plugin-import";
import jsdoc from "eslint-plugin-jsdoc";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

const typedFiles = ["**/*.{ts,tsx,mts,cts}"];
const documentedFiles = [
  "apps/api/src/**/*.{ts,tsx}",
  "packages/**/*.{ts,tsx}",
  "services/orchestrator/src/**/*.{ts,tsx}",
  "apps/web/auth.ts",
  "apps/web/app/api/**/*.{ts,tsx}"
];

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/coverage/**",
      "**/tmp/**",
      "**/artifacts/**",
      "**/test-results/**",
      "**/playwright-report/**",
      "**/*.d.ts",
      "eslint.config.mjs"
    ]
  },
  js.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser
      }
    }
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: typedFiles
  })),
  {
    files: typedFiles,
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser
      }
    },
    plugins: {
      import: importPlugin,
      jsdoc,
      "react-hooks": reactHooks
    },
    rules: {
      curly: ["error", "all"],
      eqeqeq: ["error", "always"],
      "object-shorthand": ["error", "always"],
      "prefer-template": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "inline-type-imports"
        }
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_"
        }
      ],
      "import/no-duplicates": "error",
      "import/order": [
        "error",
        {
          alphabetize: { order: "asc", caseInsensitive: true },
          groups: [["builtin", "external"], ["internal"], ["parent", "sibling", "index"], ["type"]],
          "newlines-between": "always"
        }
      ]
    }
  },
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    plugins: {
      "@next/next": nextPlugin,
      "react-hooks": reactHooks
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      ...reactHooks.configs.recommended.rules,
      "@next/next/no-html-link-for-pages": "off"
    }
  },
  {
    files: documentedFiles,
    plugins: {
      jsdoc
    },
    settings: {
      jsdoc: {
        mode: "typescript"
      }
    },
    rules: {
      "jsdoc/require-jsdoc": [
        "error",
        {
          publicOnly: true,
          require: {
            ArrowFunctionExpression: false,
            ClassDeclaration: false,
            FunctionDeclaration: true,
            FunctionExpression: false,
            MethodDefinition: false
          }
        }
      ],
      "jsdoc/require-description": "error"
    }
  }
);
