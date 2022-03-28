/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { ElemID, ObjectType, toChange, InstanceElement, BuiltinTypes, ReferenceExpression, ChangeError } from '@salto-io/adapter-api'
import refToInstanceSameType from '../../src/change_validators/ref_to_instance_of_same_type'
import { API_NAME, CUSTOM_OBJECT, METADATA_TYPE } from '../../src/constants'

describe('ref to custom object instance of same type', () => {
  let changeErrors: Readonly<ChangeError[]>
  const customObject = new ObjectType({
    elemID: new ElemID('salesforce', 'co'),
    fields: {
      refField: {
        refType: BuiltinTypes.STRING,
      },
    },
    annotations: {
      [METADATA_TYPE]: CUSTOM_OBJECT,
      [API_NAME]: 'co',
    },
  })

  const otherObject = new ObjectType({
    elemID: new ElemID('salesforce', 'notCo'),
    annotations: {
      [METADATA_TYPE]: 'NotCustomObject',
      [API_NAME]: 'notCo',
    },
  })

  const coInstA = new InstanceElement('coInstA', customObject, {
    refField: 'a',
  })

  const coInstB = new InstanceElement('coInstB', customObject, {
    refField: new ReferenceExpression(coInstA.elemID, coInstA),
  })

  const otherInst = new InstanceElement('notCoInst', otherObject, {})

  it('Should have an error if an instance that is added has a ref to another added instance of same type', async () => {
    changeErrors = await refToInstanceSameType(
      [
        toChange({ after: coInstB }),
        toChange({ after: coInstA }),
      ]
    )
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0].severity).toEqual('Error')
    expect(changeErrors[0].elemID).toEqual(coInstB.elemID)
  })

  it('Should not send an error if the referenced inst has a modification change and not addition', async () => {
    changeErrors = await refToInstanceSameType(
      [
        toChange({ before: coInstB, after: coInstB }),
        toChange({ after: coInstA }),
      ]
    )
    expect(changeErrors).toHaveLength(0)
  })

  it('Should not send an error if the referenced inst is not custom object', async () => {
    coInstA.value.refField = new ReferenceExpression(otherInst.elemID, otherInst)
    changeErrors = await refToInstanceSameType(
      [
        toChange({ after: otherInst }),
        toChange({ after: coInstA }),
      ]
    )
    expect(changeErrors).toHaveLength(0)
  })
})
