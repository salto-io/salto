/*
*                      Copyright 2024 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
const testDir = process.env.RUN_E2E_TESTS ? 'e2e_test' : 'test'

module.exports = {
  preset: 'ts-jest',
  transform: {
    '^.+.tsx?$': [
      'ts-jest',
      {
        tsconfig: `<rootDir>/${testDir}/tsconfig.json`,
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

