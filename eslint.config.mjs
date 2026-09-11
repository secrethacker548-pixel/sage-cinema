import next from 'eslint-config-next/core-web-vitals';

const eslintConfig = [
  {
    ignores: ['.next/**', 'dist/**', 'out/**', 'node_modules/**', 'old_assets/**', 'sw.js'],
  },
  ...next,
];

export default eslintConfig;
