/*
*                      Copyright 2023 Salto Labs Ltd.
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
import recipeOverwrittenValuesValidator from '../../src/change_validators/recipe_overwritten_values'
import { CONNECTION_TYPE, FOLDER_TYPE, RECIPE_CODE_TYPE, RECIPE_TYPE, WORKATO } from '../../src/constants'


describe('recipe overwritten values', () => {
  const recipeType = new ObjectType({ elemID: new ElemID(WORKATO, RECIPE_TYPE,) })
  const recipeCodeType = new ObjectType({ elemID: new ElemID(WORKATO, RECIPE_CODE_TYPE,) })
  const connectionType = new ObjectType({ elemID: new ElemID(WORKATO, CONNECTION_TYPE) })
  const folderType = new ObjectType({ elemID: new ElemID(WORKATO, FOLDER_TYPE) })


  describe('recipeOverwrittenValuesValidator', () => {
    it('should not have ChangeWarning when deploying a connection', async () => {
      const changeWarnings = await recipeOverwrittenValuesValidator(
        [toChange({
          after: new InstanceElement('connectionInstanceName', connectionType),
        })]
      )
      expect(changeWarnings).toHaveLength(0)
    })
    it('should not have ChangeWarning when deploying a deletion change', async () => {
      const changeWarnings = await recipeOverwrittenValuesValidator(
        [toChange({
          before: new InstanceElement('recipeCodeInstanceName', recipeCodeType),
        }),
        toChange({
          before: new InstanceElement('recipeInstanceName', recipeType),
        })]
      )
      expect(changeWarnings).toHaveLength(0)
    })

    it('should have ChangeWarning when deploying a valid RLM change', async () => {
      const recipeInstance = new InstanceElement('recipeInstanceName', recipeType)
      const changeWarnings = await recipeOverwrittenValuesValidator(
        [toChange({
          after: recipeInstance,
        })]
      )
      expect(changeWarnings).toHaveLength(1)
      expect(changeWarnings[0].severity).toEqual('Warning')
      expect(changeWarnings[0].elemID).toEqual(recipeInstance.elemID)
    })

    it('should have ChangeWarnings only on valid RLM changes', async () => {
      const recipeInstance = new InstanceElement('recipeInstanceName', recipeType)
      const recipeCodeInstance = new InstanceElement('recipeCodeInstanceName', recipeCodeType)
      const changeWarnings = await recipeOverwrittenValuesValidator(
        [toChange({
          after: recipeCodeInstance,
        }),
        toChange({
          before: new InstanceElement('recipeBeforeInstanceName', recipeType),
          after: recipeInstance,
        }),
        toChange({
          before: new InstanceElement('recipe1InstanceName', recipeType),
        }),
        toChange({
          after: new InstanceElement('connectionInstanceName', connectionType),
        }),
        toChange({
          before: new InstanceElement('folderBeforeInstanceName', folderType),
          after: new InstanceElement('folderAfterInstanceName', folderType),
        })]
      )
      expect(changeWarnings).toHaveLength(2)
      expect(changeWarnings[0].severity).toEqual('Warning')
      expect(changeWarnings[0].elemID).toEqual(recipeCodeInstance.elemID)
      expect(changeWarnings[1].severity).toEqual('Warning')
      expect(changeWarnings[1].elemID).toEqual(recipeInstance.elemID)
    })
  })
})
