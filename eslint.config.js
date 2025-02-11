import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {ignores: ['dist']},
  {
    rules: {
      'no-alert': 'error',
      'no-console': ['error', {allow: ['info', 'warn', 'error', 'table']}],
      'no-restricted-syntax': [
        'error', {
          'selector':
              'CallExpression[callee.object.name="test"][callee.property.name="only"]',
          'message':
              'Do not use test.only as it may accidentally skip other tests.'
        }
      ],
      'prefer-const': ['error', {'destructuring': 'all'}],
    },
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
];
