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
const path = require('path')
const deepMerge = require('../../build_utils/deep_merge')

const configs = ['./tsconfig.json', './test/tsconfig.json']

module.exports = deepMerge(require('../../eslintrc.js'), require('../../eslint/adapter-api.rules.js'), {
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: configs.map(config => path.resolve(__dirname, config)),
  },
})
