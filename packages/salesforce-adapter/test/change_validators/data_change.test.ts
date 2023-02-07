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
import {
  ChangeError, Change, InstanceElement, toChange, getChangeData,
} from '@salto-io/adapter-api'
import changeValidator from '../../src/change_validators/data_change'
import { mockTypes } from '../mock_elements'

describe('dataChange ChangeValidator', () => {
  let changeErrors: ReadonlyArray<ChangeError>
  describe('with data instance change', () => {
    let change: Change
    beforeEach(async () => {
      const beforeCustomObjInstance = new InstanceElement(
        'customObjInstance',
        mockTypes.Product2,
        { field: 'beforeValue' },
      )
      const afterCustomObjInstance = beforeCustomObjInstance.clone()
      afterCustomObjInstance.value.field = 'afterValue'
      change = toChange({ before: beforeCustomObjInstance, after: afterCustomObjInstance })
      changeErrors = await changeValidator([
        change,
      ])
    })
    it('should create a ChangeError with severity Info', async () => {
      expect(changeErrors).toEqual([
        expect.objectContaining({
          elemID: getChangeData(change).elemID,
          severity: 'Info',
        }),
      ])
    })
  })

  describe('with regular instance change', () => {
    beforeEach(async () => {
      const beforeInstance = new InstanceElement(
        'instance',
        mockTypes.ApexClass,
        { field: 'beforeValue' }
      )
      const afterInstance = beforeInstance.clone()
      afterInstance.value.field = 'afterValue'
      changeErrors = await changeValidator([
        toChange({ before: beforeInstance, after: afterInstance }),
      ])
    })
    it('should have no errors', () => {
      expect(changeErrors).toBeEmpty()
    })
  })
})
