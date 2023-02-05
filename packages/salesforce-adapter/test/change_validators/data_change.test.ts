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
  ChangeError, ElemID, InstanceElement, ObjectType, toChange, ChangeValidator,
} from '@salto-io/adapter-api'
import createDeployOnlyValidator from '../../src/change_validators/data_change'
import { CUSTOM_OBJECT } from '../../src/constants'

describe('dataChange deploy validator', () => {
  const customObj = new ObjectType({
    elemID: new ElemID('salesforce', 'customObj'),
    annotations: { metadataType: CUSTOM_OBJECT, apiName: 'obj__c' },
  })
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

  const typeObj = new ObjectType({
    elemID: new ElemID('salesforce', 'obj'),
  })
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

  let validator: ChangeValidator
  beforeEach(() => {
    validator = createDeployOnlyValidator
  })
  describe('with custom object instance change', () => {
    let changeErrors: ReadonlyArray<ChangeError>
    beforeEach(async () => {
      changeErrors = await validator([
        toChange({ before: beforeCustomObjInstance, after: afterCustomObjInstance }),
      ])
    })
    it('should have Info for CustomObject instance modification', async () => {
      expect(changeErrors).toHaveLength(1)
      const [changeError] = changeErrors
      expect(changeError.elemID).toEqual(beforeCustomObjInstance.elemID)
      expect(changeError.severity).toEqual('Info')
    })
  })

  describe('with regular instance change', () => {
    let changeErrors: ReadonlyArray<ChangeError>
    beforeEach(async () => {
      changeErrors = await validator([
        toChange({ before: beforeInstance, after: afterInstance }),
      ])
    })
    it('should have no errors', () => {
      expect(changeErrors).toHaveLength(0)
    })
  })
})
