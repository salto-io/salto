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
const deepMerge = require('../../build_utils/deep_merge')

module.exports = deepMerge(require('../../jest.base.config.js'), {
  name: 'salto-lang-server',
  displayName: 'salto-lang-server',
  rootDir: `${__dirname}`,
  collectCoverageFrom: [
    // This file is only used as a bridge with vsc. The overhead of mocking vsc has bad ROI.
    '!**/extension.*',
    '!**/adapters.*',
    '!**/providers.*',
    '!**/events.*',
    '!**/commands.*',
    '!**/output.*',
  ],
  coverageThreshold: {
    // Slowly start increasing here, never decrease!
    global: {
      branches: 16.0,
      functions: 35.65,
      lines: 42.72,
      statements: 41.55,
    },
  },
})
