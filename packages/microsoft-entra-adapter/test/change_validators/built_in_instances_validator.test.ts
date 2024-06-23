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

import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { ADAPTER_NAME, AUTHENTICATION_STRENGTH_POLICY_TYPE_NAME, ROLE_DEFINITION_TYPE_NAME } from '../../src/constants'
import { builtInInstancesValidator } from '../../src/change_validators'

describe(`${builtInInstancesValidator.name}`, () => {
  describe(AUTHENTICATION_STRENGTH_POLICY_TYPE_NAME, () => {
    it('should return change error for built-in authentication strength policy', async () => {
      const authenticationStrengthPolicyType = new ObjectType({
        elemID: new ElemID(ADAPTER_NAME, AUTHENTICATION_STRENGTH_POLICY_TYPE_NAME),
      })
      const authenticationStrengthPolicy = new InstanceElement(
        'testAuthenticationStrengthPolicy',
        authenticationStrengthPolicyType,
        { policyType: 'builtIn' },
      )
      const changes = [
        toChange({
          before: authenticationStrengthPolicy.clone(),
        }),
      ]
      const res = await builtInInstancesValidator(changes)
      expect(res).toHaveLength(1)
      expect(res[0].detailedMessage).toEqual('Built-in elements cannot be modified or removed')
    })

    it('should not return change error for non built-in authentication strength policy', async () => {
      const authenticationStrengthPolicyType = new ObjectType({
        elemID: new ElemID(ADAPTER_NAME, AUTHENTICATION_STRENGTH_POLICY_TYPE_NAME),
      })
      const authenticationStrengthPolicy = new InstanceElement(
        'testAuthenticationStrengthPolicy',
        authenticationStrengthPolicyType,
        { policyType: 'notBuiltIn' },
      )
      const changes = [
        toChange({
          before: authenticationStrengthPolicy.clone(),
        }),
      ]
      const res = await builtInInstancesValidator(changes)
      expect(res).toHaveLength(0)
    })
  })

  describe(ROLE_DEFINITION_TYPE_NAME, () => {
    it('should return change error for built-in role definition', async () => {
      const roleDefinitionType = new ObjectType({
        elemID: new ElemID(ADAPTER_NAME, ROLE_DEFINITION_TYPE_NAME),
      })
      const roleDefinition = new InstanceElement('testRoleDefinition', roleDefinitionType, { isBuiltIn: true })
      const changes = [
        toChange({
          before: roleDefinition.clone(),
        }),
      ]
      const res = await builtInInstancesValidator(changes)
      expect(res).toHaveLength(1)
      expect(res[0].detailedMessage).toEqual('Built-in elements cannot be modified or removed')
    })

    it('should not return change error for non built-in role definition', async () => {
      const roleDefinitionType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, ROLE_DEFINITION_TYPE_NAME) })
      const roleDefinition = new InstanceElement('testRoleDefinition', roleDefinitionType, { isBuiltIn: false })
      const changes = [
        toChange({
          before: roleDefinition.clone(),
        }),
      ]
      const res = await builtInInstancesValidator(changes)
      expect(res).toHaveLength(0)
    })
  })
})
