/*
*                      Copyright 2021 Salto Labs Ltd.
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
function resolveMatcher() {
  return process.env['RUN_TS_JEST']
      ? resolveTsMatcher()
      : resolveJsMatcher()
}

function resolveTsMatcher() {
  return process.env['RUN_E2E_TESTS']
      ? '<rootDir>/e2e_test/**/*.test.ts'
      : '<rootDir>/test/**/*.test.ts'
}

function resolveJsMatcher() {
  return process.env['RUN_E2E_TESTS']
      ? '<rootDir>/dist/e2e_test/**/*.test.js'
      : '<rootDir>/dist/test/**/*.test.js'
}
module.exports = {
  verbose: true,
  testEnvironment: 'node',
  testMatch: [resolveMatcher()],
  testRunner: "jest-circus/runner",
  collectCoverage: true,
  coverageReporters: ['json', 'lcov', 'text', 'clover', 'json-summary'],
  collectCoverageFrom: [
    '**/dist/**/*.js',
    '**/dist/**/*.jsx',
    '!**/node_modules/**',
    '!*.config.js',
    '!coverage/**',
    '!dist/test/**',
    '!dist/e2e_test/**',
  ],
}

