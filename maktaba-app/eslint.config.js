// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
    rules: {
      // Expo Router template uses `@/` path alias; Metro resolves it but eslint-plugin-import can't by default.
      'import/no-unresolved': 'off',
    },
  },
]);
