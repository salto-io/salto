/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import {
  CONNECTION_TYPE,
  DEPLOY_USING_RLM_GROUP,
  RECIPE_CODE_TYPE,
  RECIPE_TYPE,
  ROLE_TYPE,
  WORKATO,
} from '../src/constants'
import { getRLMGroupId } from '../src/group_change'

describe('Group changes function', () => {
  // RLM deployable types
  const recipeType = new ObjectType({ elemID: new ElemID(WORKATO, RECIPE_TYPE) })
  const recipeCodeType = new ObjectType({ elemID: new ElemID(WORKATO, RECIPE_CODE_TYPE) })
  const connectionType = new ObjectType({ elemID: new ElemID(WORKATO, CONNECTION_TYPE) })
  // undeployable type
  const roleType = new ObjectType({ elemID: new ElemID(WORKATO, ROLE_TYPE) })

  const newRecipeChange = toChange({
    after: new InstanceElement('recipeInstanceName', recipeType),
  })
  const recipeCodeModificationChange = toChange({
    before: new InstanceElement('recipeCodeInstanceName', recipeCodeType),
    after: new InstanceElement('recipeCodeInstanceName', recipeCodeType),
  })
  const connectionDeletionChange = toChange({
    before: new InstanceElement('connectionInstanceName', connectionType),
  })
  const newRoleChange = toChange({
    after: new InstanceElement('roleInstanceName', roleType),
  })

  describe('getRLMGroupId', () => {
    it('should get a new recipe change and return rlm group type', async () => {
      expect(await getRLMGroupId(newRecipeChange)).toBe(DEPLOY_USING_RLM_GROUP)
    })
    it('should get a recipeCode modification change and return rlm group type', async () => {
      expect(await getRLMGroupId(recipeCodeModificationChange)).toBe(DEPLOY_USING_RLM_GROUP)
    })
    it('should get a deletion change and return undefined', async () => {
      expect(await getRLMGroupId(connectionDeletionChange)).toBe(undefined)
    })
    it('should get a new role change and return undefined', async () => {
      expect(await getRLMGroupId(newRoleChange)).toBe(undefined)
    })
  })
})
