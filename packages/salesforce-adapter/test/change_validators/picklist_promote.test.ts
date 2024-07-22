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
import {
  Change,
  ElemID,
  Field,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { Types } from '../../src/transformers/transformer'
import picklistPromoteValidator from '../../src/change_validators/picklist_promote'
import { API_NAME, VALUE_SET_FIELDS } from '../../src/constants'
import { createField } from '../utils'
import * as constants from '../../src/constants'
import { GLOBAL_VALUE_SET } from '../../src/filters/global_value_sets'

describe('picklist promote change validator', () => {
  describe('onUpdate', () => {
    const createGlobalValueSetInstanceElement = (): InstanceElement =>
      new InstanceElement(
        'global_value_set_test',
        new ObjectType({
          elemID: new ElemID(constants.SALESFORCE, 'global_value_set'),
          annotations: { [constants.METADATA_TYPE]: GLOBAL_VALUE_SET },
        }),
      )
    const gvs: InstanceElement = createGlobalValueSetInstanceElement()
    const createAfterField = (beforeField: Field): Field => {
      const afterField = beforeField.clone()
      afterField.annotations[VALUE_SET_FIELDS.VALUE_SET_NAME] =
        new ReferenceExpression(new ElemID(''), gvs)
      return afterField
    }
    const pickListFieldName = 'pick__c'
    let obj: ObjectType
    let beforeField: Field
    let afterField: Field
    let pickListChange: Change
    let gvsChange: Change

    beforeEach(() => {
      obj = new ObjectType({
        elemID: new ElemID('salesforce', 'obj'),
      })
      beforeField = createField(
        obj,
        Types.primitiveDataTypes.Picklist,
        pickListFieldName,
      )
      beforeField.name = pickListFieldName
      afterField = createAfterField(beforeField)
      pickListChange = toChange({ before: beforeField, after: afterField })
      gvsChange = toChange({ after: gvs })
    })

    it('should have created 2 errors (for picklist & value-set)', async () => {
      const changeErrors = await picklistPromoteValidator([
        pickListChange,
        gvsChange,
      ])
      expect(changeErrors).toHaveLength(2)
      const errorElementsNamesSet = new Set(
        changeErrors.map((changeErr) => changeErr.elemID.name),
      )
      expect(errorElementsNamesSet).toEqual(
        new Set(['pick__c', 'global_value_set_test']),
      )
    })

    it("should have created just picklist error when value-set change doesn't exist", async () => {
      const changeErrors = await picklistPromoteValidator([pickListChange])
      expect(changeErrors).toHaveLength(1)
      const errorElementsNamesSet = new Set(
        changeErrors.map((changeErr) => changeErr.elemID.name),
      )
      expect(new Set(['pick__c'])).toEqual(errorElementsNamesSet)
    })

    it("should have created just picklist error when extra change isn't reference", async () => {
      afterField.annotations[VALUE_SET_FIELDS.VALUE_SET_NAME] = 'some string'
      const changeErrors = await picklistPromoteValidator([
        pickListChange,
        gvsChange,
      ])
      expect(changeErrors).toHaveLength(1)
      const errorElementsNamesSet = new Set(
        changeErrors.map((changeErr) => changeErr.elemID.name),
      )
      expect(new Set(['pick__c'])).toEqual(errorElementsNamesSet)
    })

    it('should not have errors for non-custom picklist', async () => {
      beforeField.annotations[API_NAME] = 'pick'
      const changeErrors = await picklistPromoteValidator([
        pickListChange,
        gvsChange,
      ])
      expect(changeErrors).toHaveLength(0)
    })

    it('should not have errors for already global value-set picklist field', async () => {
      beforeField.annotations[VALUE_SET_FIELDS.VALUE_SET_NAME] = 'something'
      const changeErrors = await picklistPromoteValidator([
        pickListChange,
        gvsChange,
      ])
      expect(changeErrors).toHaveLength(0)
    })

    it('should not have errors for moving to a non-global value-set change', async () => {
      delete afterField.annotations[VALUE_SET_FIELDS.VALUE_SET_NAME]
      const changeErrors = await picklistPromoteValidator([pickListChange])
      expect(changeErrors).toHaveLength(0)
    })
  })
})
