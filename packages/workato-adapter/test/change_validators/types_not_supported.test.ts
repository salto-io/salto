/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { typesNotSupportedValidator } from '../../src/change_validators/types_not_supported'
import { CONNECTION_TYPE, FOLDER_TYPE, RECIPE_CODE_TYPE, RECIPE_TYPE, ROLE_TYPE, WORKATO } from '../../src/constants'

describe('not supported validators', () => {
  // RLM deployable types
  const recipeType = new ObjectType({ elemID: new ElemID(WORKATO, RECIPE_TYPE) })
  const recipeCodeType = new ObjectType({ elemID: new ElemID(WORKATO, RECIPE_CODE_TYPE) })
  const connectionType = new ObjectType({ elemID: new ElemID(WORKATO, CONNECTION_TYPE) })
  // undeployable type
  const roleType = new ObjectType({ elemID: new ElemID(WORKATO, ROLE_TYPE) })
  const folderType = new ObjectType({ elemID: new ElemID(WORKATO, FOLDER_TYPE) })

  describe('typesNotSupportedValidator', () => {
    it('should not have ChangeError when deploying a RLM deployable new change', async () => {
      const changeErrors = await typesNotSupportedValidator([
        toChange({
          after: new InstanceElement('recipeInstanceName', recipeType),
        }),
      ])
      expect(changeErrors).toHaveLength(0)
    })
    it('should not have ChangeError when deploying a RLM deployable deletion and modification changes', async () => {
      const changeErrors = await typesNotSupportedValidator([
        toChange({
          before: new InstanceElement('recipeCodeInstanceName', recipeCodeType),
          after: new InstanceElement('recipeCodeInstanceName', recipeCodeType),
        }),
        toChange({
          before: new InstanceElement('connectionInstanceName', connectionType),
        }),
      ])
      expect(changeErrors).toHaveLength(0)
    })

    it('should have Error ChangeError when deploying a non deployable new change', async () => {
      const roleInstance = new InstanceElement('roleInstanceName', roleType)
      const changeErrors = await typesNotSupportedValidator([
        toChange({
          after: roleInstance,
        }),
      ])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[0].elemID).toEqual(roleInstance.elemID)
    })

    it('should have Error ChangeErrors only on non deployable changes', async () => {
      const roleInstance = new InstanceElement('roleInstanceName', roleType)
      const folderInstance = new InstanceElement('folderInstanceName', folderType)
      const changeErrors = await typesNotSupportedValidator([
        toChange({
          after: roleInstance,
        }),
        toChange({
          before: new InstanceElement('folderBeforeInstanceName', folderType),
          after: folderInstance,
        }),
        toChange({
          after: new InstanceElement('recipeInstanceName', recipeType),
        }),
      ])
      expect(changeErrors).toHaveLength(2)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[1].severity).toEqual('Error')
      expect(changeErrors.map(err => err.elemID)).toContain(roleInstance.elemID)
      expect(changeErrors.map(err => err.elemID)).toContain(folderInstance.elemID)
    })
  })
})
