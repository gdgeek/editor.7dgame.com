import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

export default [
  {
    files: ["plugin/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        THREE: "readonly",
        signals: "readonly",
      },
    },
    rules: {
      // 错误检测
      "no-undef": "error",
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "no-dupe-keys": "error",
      "no-duplicate-case": "error",
      "no-empty": "warn",
      "no-extra-semi": "error",
      "no-unreachable": "error",
      "no-unsafe-negation": "error",

      // 最佳实践
      "eqeqeq": ["warn", "smart"],
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-return-await": "warn",
      "no-self-compare": "error",
      "no-throw-literal": "error",
      "no-useless-return": "warn",

      // 代码风格 (仅警告)
      "no-trailing-spaces": "warn",
      "no-multiple-empty-lines": ["warn", { "max": 2 }],
      "semi": ["warn", "always"],

      // 禁用生产环境不需要的
      "no-console": ["warn", { "allow": ["warn", "error", "log"] }],
      "no-debugger": "error",
      "no-alert": "warn",
    },  },
  {
    files: ["plugin/**/*.ts"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parser: tsParser,
      globals: {
        ...globals.browser,
        THREE: "readonly",
        signals: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      // 错误检测
      "no-undef": "error",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "no-dupe-keys": "error",
      "no-duplicate-case": "error",
      "no-empty": "warn",
      "no-extra-semi": "error",
      "no-unreachable": "error",
      "no-unsafe-negation": "error",

      // TypeScript 特有规则
      "@typescript-eslint/no-explicit-any": "warn",

      // 最佳实践
      "eqeqeq": ["warn", "smart"],
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-return-await": "warn",
      "no-self-compare": "error",
      "no-throw-literal": "error",
      "no-useless-return": "warn",

      // 代码风格 (仅警告)
      "no-trailing-spaces": "warn",
      "no-multiple-empty-lines": ["warn", { "max": 2 }],
      "semi": ["warn", "always"],

      // 禁用生产环境不需要的
      "no-console": ["warn", { "allow": ["warn", "error", "log"] }],
      "no-debugger": "error",
      "no-alert": "warn",
    },
  },
];
