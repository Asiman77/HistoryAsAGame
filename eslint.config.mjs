import next from "eslint-config-next";

const config = [
  ...next,
  { ignores: [".next/**", "out/**", "node_modules/**", "playwright-report/**", "public/vendor/**"] },
];

export default config;
