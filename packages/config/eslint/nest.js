// @ts-check
const base = require("./base");

/** @type {import("eslint").Linter.Config[]} */
module.exports = [
  ...base,
  {
    rules: {
      "@typescript-eslint/interface-name-prefix": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
    },
  },
];
