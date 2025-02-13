/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { removalNotSupportedValidator } from '../../src/change_validators/removal_not_supported'
import { CONNECTION_TYPE, FOLDER_TYPE, RECIPE_CODE_TYPE, RECIPE_TYPE, ROLE_TYPE, WORKATO } from '../../src/constants'

describe('not supported validators', () => {
  // RLM deployable types
  const recipeType = new ObjectType({ elemID: new ElemID(WORKATO, RECIPE_TYPE) })
  const recipeCodeType = new ObjectType({ elemID: new ElemID(WORKATO, RECIPE_CODE_TYPE) })
  const connectionType = new ObjectType({ elemID: new ElemID(WORKATO, CONNECTION_TYPE) })
  // undeployable type
  const roleType = new ObjectType({ elemID: new ElemID(WORKATO, ROLE_TYPE) })
  const folderType = new ObjectType({ elemID: new ElemID(WORKATO, FOLDER_TYPE) })

  describe('removalNotSupportedValidator', () => {
    it('should not have ChangeError when deploying a new change', async () => {
      const changeErrors = await removalNotSupportedValidator([
        toChange({
          after: new InstanceElement('roleInstanceName', roleType),
        }),
      ])
      expect(changeErrors).toHaveLength(0)
    })
    it('should not have ChangeError when deploying a non deletion changes', async () => {
      const changeErrors = await removalNotSupportedValidator([
        toChange({
          before: new InstanceElement('recipeCodeInstanceName', recipeCodeType),
          after: new InstanceElement('recipeCodeInstanceName', recipeCodeType),
        }),
        toChange({
          after: new InstanceElement('connectionInstanceName', connectionType),
        }),
      ])
      expect(changeErrors).toHaveLength(0)
    })

    it('should have Error ChangeError when deploying a deletion change', async () => {
      const folderInstance = new InstanceElement('folderInstanceName', folderType)
      const changeErrors = await removalNotSupportedValidator([
        toChange({
          before: folderInstance,
        }),
      ])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[0].elemID).toEqual(folderInstance.elemID)
    })

    it('should have Error ChangeErrors only on deletion changes', async () => {
      const recipe1Instance = new InstanceElement('recipe1InstanceName', recipeType)
      const recipe2Instance = new InstanceElement('recipe2InstanceName', recipeType)
      const recipe3Instance = new InstanceElement('recipe3InstanceName', recipeType)
      const changeErrors = await removalNotSupportedValidator([
        toChange({
          after: recipe1Instance,
        }),
        toChange({
          before: new InstanceElement('recipe2BeforeInstanceName', folderType),
          after: recipe2Instance,
        }),
        toChange({
          before: recipe3Instance,
        }),
      ])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors.map(err => err.elemID)).toContain(recipe3Instance.elemID)
    })
  })
})
