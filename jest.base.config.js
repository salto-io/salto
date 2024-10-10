/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
const testDir = process.env.RUN_E2E_TESTS ? 'e2e_test' : 'test'

module.exports = {
  preset: 'ts-jest',
  transform: {
    '^.+.tsx?$': [
      'ts-jest',
      {
        tsconfig: `<rootDir>/tsconfig.json`,
        isolatedModules: true,
      }
    ]
  },
  verbose: true,
  testEnvironment: 'node',
  testMatch: [`<rootDir>/${testDir}/**/*.test.ts`],
  testRunner: "jest-circus/runner",
  collectCoverage: process.env.RUN_E2E_TESTS ? false : true,
  coverageReporters: ['json', 'lcov', 'text', 'clover', 'json-summary'],
  collectCoverageFrom: [
    '**/*.ts',
    '**/*.tsx',
    '!**/node_modules/**',
    '!*.config.ts',
    '!coverage/**',
    '!test/**',
    '!e2e_test/**',
    '!**/*.d.ts',
    '!**/dist/**',
  ],
}

