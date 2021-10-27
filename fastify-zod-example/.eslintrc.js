module.exports = {
  root: true,
  parser: `@typescript-eslint/parser`,
  plugins: [
    `@typescript-eslint/eslint-plugin`,
    `eslint-plugin-import`,
    `eslint-plugin-prettier`,
  ],
  extends: [
    `plugin:@typescript-eslint/recommended`,
    `prettier`,
    `plugin:prettier/recommended`,
    `plugin:import/errors`,
    `plugin:import/warnings`,
    `plugin:import/typescript`,
  ],
  settings: {
    "import/parsers": {
      "@typescript-eslint/parser": [`.ts`, `.d.ts`],
    },
  },
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: `module`,
  },
  rules: {
    "prettier/prettier": [1, { trailingComma: `all`, endOfLine: `auto` }],
    "object-shorthand": [1, `always`],
    quotes: [1, `backtick`],
    "@typescript-eslint/no-unused-vars": [1, { argsIgnorePattern: `^_` }],
    "@typescript-eslint/naming-convention": [
      `error`,
      {
        selector: `variableLike`,
        format: [`strictCamelCase`, `UPPER_CASE`, `PascalCase`, `snake_case`],
        leadingUnderscore: `allow`,
      },
    ],
    "@typescript-eslint/explicit-function-return-type": [
      1,
      {
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
      },
    ],
    "import/order": [
      1,
      {
        groups: [
          `builtin`,
          `external`,
          `internal`,
          `parent`,
          `sibling`,
          `index`,
        ],
        "newlines-between": `always`,
      },
    ],
  },
};
