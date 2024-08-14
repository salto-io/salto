/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { recipeSettingsNotSupportedValidator } from '../../src/change_validators/recipe_settings_not_suuported'
import { CONNECTION_TYPE, RECIPE_CODE_TYPE, RECIPE_TYPE, ROLE_TYPE, WORKATO } from '../../src/constants'

describe('not supported validators', () => {
  // RLM deployable types
  const recipeType = new ObjectType({ elemID: new ElemID(WORKATO, RECIPE_TYPE) })
  const recipeCodeType = new ObjectType({ elemID: new ElemID(WORKATO, RECIPE_CODE_TYPE) })
  const connectionType = new ObjectType({ elemID: new ElemID(WORKATO, CONNECTION_TYPE) })
  const roleType = new ObjectType({ elemID: new ElemID(WORKATO, ROLE_TYPE) })

  describe('recipeSettingsNotSupportedValidator', () => {
    it('should not get any change validation while deploying a connectionType', async () => {
      const changeErrors = await recipeSettingsNotSupportedValidator([
        toChange({
          after: new InstanceElement('connectionInstanceName', connectionType),
        }),
      ])
      expect(changeErrors).toHaveLength(0)
    })

    it('should get Warning while deploying recipe', async () => {
      const recipeInstance = new InstanceElement('recipeInstanceName', recipeType)
      const changeErrors = await recipeSettingsNotSupportedValidator([
        toChange({
          after: new InstanceElement('recipeInstanceName', roleType),
        }),
        toChange({
          before: new InstanceElement('recipeInstanceBeforeName', recipeType),
          after: recipeInstance,
        }),
      ])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Warning')
      expect(changeErrors[0].elemID).toBe(recipeInstance.elemID)
    })

    it('should get Warning while deploying recipe code', async () => {
      const recipCodeInstance = new InstanceElement('recipeCodeInstanceName', recipeCodeType)
      const changeErrors = await recipeSettingsNotSupportedValidator([
        toChange({
          after: recipCodeInstance,
        }),
      ])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Warning')
      expect(changeErrors[0].elemID).toBe(recipCodeInstance.elemID)
    })
  })
})
