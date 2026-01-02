import globals from "globals";

export default [
  {
    files: ["js/mrpp/**/*.js", "js/utils/**/*.js"],
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
      "no-console": ["warn", { "allow": ["warn", "error"] }],
      "no-debugger": "error",
      "no-alert": "warn",
    },  },
];
