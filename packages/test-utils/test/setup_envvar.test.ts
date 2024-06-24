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
import { setupEnvVar } from '../src/setup_envvar'

describe('setupEnvVar', () => {
  const testEnvVarName = 'random_env_var_name_that_is_unlikely_to_exist'
  describe('when value is defined before the setup', () => {
    beforeAll(() => {
      process.env[testEnvVarName] = 'value'
    })
    afterAll(() => {
      expect(process.env[testEnvVarName]).toEqual('value')
      delete process.env[testEnvVarName]
    })
    describe('when set as before each', () => {
      describe('when set with undefined', () => {
        setupEnvVar(testEnvVarName, undefined)
        it('should unset an existing env var', () => {
          expect(process.env[testEnvVarName]).toBeUndefined()
          process.env[testEnvVarName] = 'mid'
        })
        it('should should unset between tests as well', () => {
          expect(process.env[testEnvVarName]).toBeUndefined()
        })
      })
      describe('when set with a value', () => {
        setupEnvVar(testEnvVarName, () => 'test', 'each')
        it('should set the value', () => {
          expect(process.env[testEnvVarName]).toEqual('test')
          process.env[testEnvVarName] = 'not test'
        })
        it('should re-set between tests', () => {
          expect(process.env[testEnvVarName]).toEqual('test')
        })
      })
    })
  })
  describe('when set as before all', () => {
    setupEnvVar(testEnvVarName, 'all_val', 'all')
    it('should set before the first test', () => {
      expect(process.env[testEnvVarName]).toEqual('all_val')
      process.env[testEnvVarName] = 'between_tests'
    })
    it('should not re-set between tests', () => {
      expect(process.env[testEnvVarName]).toEqual('between_tests')
    })
  })
})
