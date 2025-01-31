import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {ignores: ['dist']},
  {
    rules: {
      'no-alert': 'error',
      'no-console': ['error', {allow: ['info', 'warn', 'error', 'table']}],
      'prefer-const': ['error', {'destructuring': 'all'}],
    },
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
];
