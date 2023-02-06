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
// import { CUSTOM_OBJECT } from '../../src/constants'

describe('dataChange deploy validator', () => {
  let changeErrors: ReadonlyArray<ChangeError>
  describe('with data instance change', () => {
    let change: Change
    beforeEach(async () => {
      const customObj = mockTypes.Product2
      const beforeCustomObjInstance = new InstanceElement(
        'customObjInstance',
        customObj,
        { field: 'beforeValue' },
      )
      const afterCustomObjInstance = new InstanceElement(
        'customObjInstance',
        customObj,
        { field: 'afterValue' },
      )
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
      const typeObj = mockTypes.ApexClass
      const beforeInstance = new InstanceElement(
        'instance',
        typeObj,
        { field: 'beforeValue' }
      )
      const afterInstance = new InstanceElement(
        'instance',
        typeObj,
        { field: 'afterValue' }
      )
      changeErrors = await changeValidator([
        toChange({ before: beforeInstance, after: afterInstance }),
      ])
    })
    it('should have no errors', () => {
      expect(changeErrors).toBeEmpty()
    })
  })
})
