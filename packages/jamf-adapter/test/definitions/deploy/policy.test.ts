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

import { definitions } from '@salto-io/adapter-components'
import { POLICY_TYPE_NAME } from '../../../src/constants'
import { adjustPolicyOnDeploy } from '../../../src/definitions/deploy/policy'

describe('adjustPolicyOnDeploy', () => {
  it('should throw an error if value is not a record', async () => {
    const value = 'not a record'
    await expect(
      adjustPolicyOnDeploy({ value, context: {} as definitions.deploy.ChangeAndContext, typeName: POLICY_TYPE_NAME }),
    ).rejects.toThrow('Expected value to be a record')
  })
  describe('adjustScriptStructureBeforeDeploy', () => {
    it('should change scripts array to object with size and script fields', async () => {
      const value = { scripts: ['script1', 'script2'] }
      expect(
        await adjustPolicyOnDeploy({
          value,
          context: {} as definitions.deploy.ChangeAndContext,
          typeName: POLICY_TYPE_NAME,
        }),
      ).toEqual({ value: { scripts: { size: 2, script: ['script1', 'script2'] } } })
    })
    it('should not change anything if scripts is not an array', async () => {
      const value = { scripts: 'not an array' }
      expect(
        await adjustPolicyOnDeploy({
          value,
          context: {} as definitions.deploy.ChangeAndContext,
          typeName: POLICY_TYPE_NAME,
        }),
      ).toEqual({ value: { scripts: 'not an array' } })
    })
  })
})
