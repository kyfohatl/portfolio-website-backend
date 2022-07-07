/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['./src/test/setup.ts'],
  // setupFilesAfterEnv: ['./src/test/teardown.ts']
};