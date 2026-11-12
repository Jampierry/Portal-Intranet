// ESLint (config plana). Foco em erros reais; estilo fica com o editor.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'dados-privados/**', 'MCP/**', 'Plano de implantação/**', 'docs/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-control-regex': 'off', // usado de propósito para limpar caracteres de controle
      'no-irregular-whitespace': ['error', { skipStrings: true, skipComments: true, skipTemplates: true, skipRegExps: true, skipJSXText: true }],
      'no-useless-escape': 'warn',
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  { files: ['web/src/**/*.{ts,tsx}'], plugins: { 'react-hooks': reactHooks }, rules: { 'react-hooks/rules-of-hooks': 'error', 'react-hooks/exhaustive-deps': 'warn' } },
);
