import js from '@eslint/js';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'server/data/**', 'server/uploads/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js', 'src/**/*.jsx', 'backend/**/*.js', 'tests/**/*.js', '*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', parserOptions: { ecmaFeatures: { jsx: true } }, globals: { window: 'readonly', document: 'readonly', localStorage: 'readonly', FormData: 'readonly', URLSearchParams: 'readonly', fetch: 'readonly', console: 'readonly', process: 'readonly', Buffer: 'readonly', Blob: 'readonly', URL: 'readonly', setTimeout: 'readonly' } },
    rules: { 'no-unused-vars': ['error', { args: 'all', argsIgnorePattern: '^_', varsIgnorePattern: '^[A-Z_]' }] }
  }
];
