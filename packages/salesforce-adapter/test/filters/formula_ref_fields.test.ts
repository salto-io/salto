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
import { BuiltinTypes, ElemID, InstanceElement, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import { METADATA_TYPE, SALESFORCE } from '../src/constants'
import { mockTypes } from './mock_elements'
import { FilterWith } from './filters/mocks'
import { defaultFilterContext } from './utils'
import filterCreator from '../src/filters/formula_ref_fields'

describe('Formula reference fields', () => {
  let filter: FilterWith<'onFetch'>

  beforeAll(() => {
    const config = { ...defaultFilterContext }
    filter = filterCreator({ config }) as FilterWith<'onFetch'>
  })

  const objectType = new ObjectType({
    elemID: new ElemID(SALESFORCE, 'FlowCondition'),
    annotations: { [METADATA_TYPE]: 'FlowCondition' },
    fields: {
      leftValueReference: {
        refType: BuiltinTypes.STRING,
      },
    },
  })
  const referringInstance = new InstanceElement('SomeFlowCondition', objectType, {
    leftValueReference: '$Label.SomeLabel',
  })

  describe('when there is a valid reference', () => {
    const referredInstance = new InstanceElement('SomeLabel', mockTypes.CustomLabel, { fullName: 'SomeLabel' })
    const elements = [objectType, referringInstance, referredInstance].map(element => element.clone())

    beforeEach(async () => {
      await filter.onFetch(elements)
    })

    it('should replace the field value with a reference expression', () => {
      const referringInstanceAfterTest = elements.find(elem =>
        elem.elemID.isEqual(referringInstance.elemID),
      ) as InstanceElement
      expect(referringInstanceAfterTest.value.leftValueReference).toEqual(
        new ReferenceExpression(referredInstance.elemID),
      )
    })
  })
  describe('when the reference is not valid', () => {
    const elements = [objectType, referringInstance].map(element => element.clone())

    beforeEach(async () => {
      await filter.onFetch(elements)
    })

    it('should replace the field value with a reference expression', () => {
      const referringInstanceAfterTest = elements.find(elem =>
        elem.elemID.isEqual(referringInstance.elemID),
      ) as InstanceElement
      expect(referringInstanceAfterTest.value.leftValueReference).toEqual(referringInstance.value.leftValueReference)
    })
  })
})
