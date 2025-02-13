/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { MICROSOFT_SECURITY, entraConstants } from '../../../src/constants'
import { builtInInstancesValidator } from '../../../src/change_validators/shared/built_in_instances_validator'

describe(builtInInstancesValidator.name, () => {
  describe(entraConstants.TOP_LEVEL_TYPES.AUTHENTICATION_STRENGTH_POLICY_TYPE_NAME, () => {
    it('should return change error for built-in authentication strength policy', async () => {
      const authenticationStrengthPolicyType = new ObjectType({
        elemID: new ElemID(MICROSOFT_SECURITY, entraConstants.TOP_LEVEL_TYPES.AUTHENTICATION_STRENGTH_POLICY_TYPE_NAME),
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
        elemID: new ElemID(MICROSOFT_SECURITY, entraConstants.TOP_LEVEL_TYPES.AUTHENTICATION_STRENGTH_POLICY_TYPE_NAME),
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

  describe(entraConstants.TOP_LEVEL_TYPES.ROLE_DEFINITION_TYPE_NAME, () => {
    it('should return change error for built-in role definition', async () => {
      const roleDefinitionType = new ObjectType({
        elemID: new ElemID(MICROSOFT_SECURITY, entraConstants.TOP_LEVEL_TYPES.ROLE_DEFINITION_TYPE_NAME),
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
      const roleDefinitionType = new ObjectType({
        elemID: new ElemID(MICROSOFT_SECURITY, entraConstants.TOP_LEVEL_TYPES.ROLE_DEFINITION_TYPE_NAME),
      })
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
