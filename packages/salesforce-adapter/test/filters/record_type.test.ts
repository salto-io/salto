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
import {
  ObjectType, InstanceElement, ElemID, ReferenceExpression,
  INSTANCE_ANNOTATIONS,
} from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/record_type'
import {
  SALESFORCE, RECORD_TYPE_METADATA_TYPE, METADATA_TYPE, BUSINESS_PROCESS_METADATA_TYPE,
  INSTANCE_FULL_NAME_FIELD,
} from '../../src/constants'
import { FilterWith } from '../../src/filter'

describe('record type filter', () => {
  const customObjName = 'MockCustomObject'
  const customObjElemID = new ElemID(SALESFORCE, customObjName)

  const buisnessProcessName = 'Process Name'
  const recordTypeType = new ObjectType({
    elemID: new ElemID(SALESFORCE, RECORD_TYPE_METADATA_TYPE),
    annotations: { [METADATA_TYPE]: RECORD_TYPE_METADATA_TYPE },
  })
  const recordTypeInstance = new InstanceElement(
    `${customObjName}_BLA`,
    recordTypeType,
    {
      [INSTANCE_FULL_NAME_FIELD]: `${customObjName}.BLA`,
      businessProcess: buisnessProcessName,
    },
    undefined,
    { [INSTANCE_ANNOTATIONS.PARENT]: new ReferenceExpression(customObjElemID) }
  )
  const fakeRecordTypeInstance = new InstanceElement(
    `${customObjName}_BLA`,
    recordTypeType,
    {
      [INSTANCE_FULL_NAME_FIELD]: `${customObjName}.BLA`,
      businessProcess: 'NONE',
    },
    undefined,
    { [INSTANCE_ANNOTATIONS.PARENT]: new ReferenceExpression(customObjElemID) }
  )
  const buisnessProcessType = new ObjectType({
    elemID: new ElemID(SALESFORCE, BUSINESS_PROCESS_METADATA_TYPE),
    annotations: { [METADATA_TYPE]: BUSINESS_PROCESS_METADATA_TYPE },
  })
  const buisnessProcessInstance = new InstanceElement(
    `${customObjName}-${buisnessProcessName}`,
    buisnessProcessType,
    {
      [INSTANCE_FULL_NAME_FIELD]: `${customObjName}-${buisnessProcessName}`,
    },
    undefined,
    { [INSTANCE_ANNOTATIONS.PARENT]: new ReferenceExpression(customObjElemID) }
  )

  describe('on fetch', () => {
    let postFilter: InstanceElement
    let postFilterNoObj: InstanceElement

    beforeAll(async () => {
      const filter = filterCreator() as FilterWith<'onFetch'>
      const testElements = [
        recordTypeInstance.clone(),
        fakeRecordTypeInstance.clone(),
        buisnessProcessInstance.clone(),
        buisnessProcessType.clone(),
        recordTypeType.clone(),
      ]
      await filter.onFetch(testElements)
      postFilter = testElements[0] as InstanceElement
      postFilterNoObj = testElements[1] as InstanceElement
    })

    describe('fields reference', () => {
      it('should transform businessProcess to reference', async () => {
        expect(postFilter.value.businessProcess)
          .toEqual(new ReferenceExpression(buisnessProcessInstance.elemID))
      })

      it('should keep businessProcess as is if no custom object', async () => {
        expect(postFilterNoObj.value.businessProcess).toBe('NONE')
      })
    })
  })
})
