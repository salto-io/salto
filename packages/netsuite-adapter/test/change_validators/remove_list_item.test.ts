/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { InstanceElement, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import removeListItemValidator from '../../src/change_validators/remove_list_item'
import { customTypes } from '../../src/types'
import { CUSTOM_LIST } from '../../src/constants'


describe('remove customlist item change validator', () => {
  const origInstance = new InstanceElement(
    'instance',
    customTypes[CUSTOM_LIST],
    {
      customvalues: {
        customvalue: [
          {
            scriptid: 'val_1',
            value: 'Value 1',
          },
          {
            scriptid: 'val_2',
            value: 'Value 2',
          },
        ],
      },
    }
  )
  let instance: InstanceElement
  beforeEach(() => {
    instance = origInstance.clone()
  })

  describe('When adding new customlist', () => {
    it('should have no change errors when adding a customlist', async () => {
      const changeErrors = await removeListItemValidator([toChange({ after: instance })])
      expect(changeErrors).toHaveLength(0)
    })
  })

  describe('When modifying customlist', () => {
    it('should have no change errors when adding a customvalue', async () => {
      const after = instance.clone()
      after.value.customvalues.customvalue = [
        ...instance.value.customvalues.customvalue,
        {
          scriptid: 'val_3',
          value: 'Value 3',
        },
      ]
      const changeErrors = await removeListItemValidator(
        [toChange({ before: instance, after })]
      )
      expect(changeErrors).toHaveLength(0)
    })

    it('should have no change error when modifying a customvalue', async () => {
      const after = instance.clone()
      after.value.customvalues.customvalue[0].value = 'Some Edited Value'
      const changeErrors = await removeListItemValidator(
        [toChange({ before: instance, after })]
      )
      expect(changeErrors).toHaveLength(0)
    })

    it('should have change error when removing a customvalue', async () => {
      const after = instance.clone()
      after.value.customvalues.customvalue.pop()
      const changeErrors = await removeListItemValidator(
        [toChange({ before: instance, after })]
      )
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[0].elemID).toEqual(instance.elemID)
    })

    it('should have change error when removing a reference', async () => {
      const before = new InstanceElement(
        'instance',
        customTypes[CUSTOM_LIST],
        {
          list: [
            new ReferenceExpression(customTypes[CUSTOM_LIST].elemID, 'id1'),
            new ReferenceExpression(customTypes[CUSTOM_LIST].elemID, 'id2'),
          ],
        }
      )

      const after = before.clone()
      after.value.list.pop()
      const changeErrors = await removeListItemValidator(
        [toChange({ before, after })]
      )
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[0].elemID).toEqual(before.elemID)
    })

    it('should have change error when removing a scriptid string', async () => {
      const before = new InstanceElement(
        'instance',
        customTypes[CUSTOM_LIST],
        {
          list: [
            '[scriptid=id1]',
            '[scriptid=id2]',
          ],
        }
      )

      const after = before.clone()
      after.value.list.pop()
      const changeErrors = await removeListItemValidator(
        [toChange({ before, after })]
      )
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[0].elemID).toEqual(before.elemID)
    })
  })
})
