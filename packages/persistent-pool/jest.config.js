/*
*                      Copyright 2020 Salto Labs Ltd.
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
module.exports = {
  verbose: true,
  testEnvironment: 'node',
  name: 'persistent-pool',
  displayName: 'persistent-pool',
  rootDir: `${__dirname}`,
  testMatch: ['<rootDir>/dist/test/**/*.test.js'],
  testRunner: "jest-circus/runner",
  collectCoverage: true,
  coverageReporters: ['json', 'lcov', 'text', 'clover', 'json-summary'],
  collectCoverageFrom: [
    'dist/**/*.js',
    'dist/**/*.jsx',
    '!**/node_modules/**',
    '!*.config.js',
    '!coverage/**',
    '!dist/test/**',
    '!<rootDir>/dist/src/index.js',
  ],
  testEnvironment: './dist/test/lib/dynamodb/environment',
  coverageThreshold: !process.env.NO_COVERAGE_THRESHOLD
      ? require('./coverage_thresholds.json')
      : {},
}

