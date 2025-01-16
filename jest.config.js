/** @type {import('ts-jest').JestConfigWithTsJest} **/
export default {
  testEnvironment: 'node',
  transform: {'^.+.tsx?$': '@swc/jest'},
};
