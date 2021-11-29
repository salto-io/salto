/*
*                      Copyright 2021 Salto Labs Ltd.
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
  ChangeError, ElemID, InstanceElement, ObjectType, toChange, TypeReference,
} from '@salto-io/adapter-api'
import validateOnlyFlagValidator from '../../src/change_validators/validate_only_flag'
import { CUSTOM_OBJECT } from '../../src/constants'

describe('CustomObject instance change validator when checkOnly flag is on', () => {
  describe('onUpdate', () => {
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

    const checkOnlyConfigElemID = new ElemID('salesforce', '_config')
    const checkOnlyConfig = new InstanceElement(
      '_config',
      new TypeReference(checkOnlyConfigElemID),
      { client: { deploy: { checkOnly: true } } },
    )

    const runChangeValidator = (before: InstanceElement, after: InstanceElement):
          Promise<ReadonlyArray<ChangeError>> =>
      validateOnlyFlagValidator([toChange({ before, after })], checkOnlyConfig)

    it('should have Error for CustomObject instance modification', async () => {
      const changeErrors = await runChangeValidator(beforeCustomObjInstance, afterCustomObjInstance)
      expect(changeErrors).toHaveLength(1)
      const [changeError] = changeErrors
      expect(changeError.elemID).toEqual(beforeCustomObjInstance.elemID)
      expect(changeError.severity).toEqual('Error')
    })

    it('should have no errors for regular instances', async () => {
      const changeErrors = await runChangeValidator(beforeInstance, afterInstance)
      expect(changeErrors).toHaveLength(0)
    })
  })
})
