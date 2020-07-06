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
const deepMerge = require('../../build_utils/deep_merge')

module.exports = deepMerge(
  require('../../jest.base.config.js'),
  {
    name: 'monitoring',
    displayName: 'monitoring',
    rootDir: `${__dirname}`,
    collectCoverageFrom: [
      '!<rootDir>/dist/src/callbacks.js',
      '!<rootDir>/dist/src/index.js',
      '!<rootDir>/package_native.js',
      '!<rootDir>/dist/bundle.js'
    ],
    coverageThreshold: {
      // Slowly start increasing here, never decrease!
      global: {
        branches: 0,
        functions: 10.53,
        lines: 13.14,
        statements: 12.39,
      },
    },
  }
)

