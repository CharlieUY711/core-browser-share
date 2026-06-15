import type { Linter } from "eslint";

const config: Linter.Config[] = [
  {
    extends: ["next/core-web-vitals"],
  },
];

export default config;
