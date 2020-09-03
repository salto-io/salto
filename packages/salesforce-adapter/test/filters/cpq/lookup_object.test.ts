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
import { ObjectType, ElemID, Element, ReferenceExpression, isObjectType } from '@salto-io/adapter-api'
import { FilterWith } from '../../../src/filter'
import SalesforceClient from '../../../src/client/client'
import mockAdapter from '../../adapter'
import filterCreator from '../../../src/filters/cpq/lookup_object'
import { SALESFORCE, CPQ_PRODUCT_RULE, CPQ_LOOKUP_OBJECT_NAME, API_NAME, METADATA_TYPE, CUSTOM_OBJECT, FIELD_ANNOTATIONS } from '../../../src/constants'
import { Types } from '../../../src/transformers/transformer'

describe('lookup_object filter', () => {
  let client: SalesforceClient
  type FilterType = FilterWith<'onFetch'>
  let filter: FilterType
  let elements: Element[]
  const existingObjectName = 'existingObject'
  const mockObjectElemID = new ElemID(SALESFORCE, existingObjectName)
  const mockObject = new ObjectType({
    elemID: mockObjectElemID,
    annotations: {
      [API_NAME]: existingObjectName,
      [METADATA_TYPE]: CUSTOM_OBJECT,
    },
  })
  const mockProductRuleElemID = new ElemID(SALESFORCE, CPQ_PRODUCT_RULE)
  const mockProductRuleObject = new ObjectType({
    elemID: mockProductRuleElemID,
    fields: {
      [CPQ_LOOKUP_OBJECT_NAME]: {
        type: Types.primitiveDataTypes.Picklist,
        annotations: {
          [API_NAME]: CPQ_LOOKUP_OBJECT_NAME,
          valueSet: [{
            fullName: existingObjectName,
          }, {
            fullName: 'nonExistingObject',
          },
          ],
        },
      },
    },
    annotations: {
      [API_NAME]: CPQ_PRODUCT_RULE,
      [METADATA_TYPE]: CUSTOM_OBJECT,
    },
  })
  beforeAll(async () => {
    ({ client } = mockAdapter({
      adapterParams: {
      },
    }))
    filter = filterCreator({ client, config: {} }) as FilterType
    elements = [mockObject.clone(), mockProductRuleObject.clone()]
    await filter.onFetch(elements)
  })

  it('Should not add or remove elements', () => {
    expect(elements).toHaveLength(2)
    expect(elements.find(e => e.elemID.isEqual(mockObjectElemID))).toBeDefined()
    expect(elements.find(e => e.elemID.isEqual(mockProductRuleElemID))).toBeDefined()
  })

  it('Should not change elements not defined as ones with lookup', () => {
    expect(elements.find(e => e.elemID.isEqual(mockObjectElemID))).toStrictEqual(mockObject)
  })

  it('Should change lookup field value set fullName value to a ref if custom object exists and keep string if not', () => {
    const mockProductElm = elements.find(e => e.elemID.isEqual(mockProductRuleElemID))
    expect(mockProductElm).toBeDefined()
    expect(isObjectType(mockProductElm)).toBeTruthy()
    const lookupObjetField = (mockProductElm as ObjectType).fields[CPQ_LOOKUP_OBJECT_NAME]
    expect(lookupObjetField).toBeDefined()
    expect(
      lookupObjetField.annotations[FIELD_ANNOTATIONS.VALUE_SET][0].fullName
    ).toEqual(new ReferenceExpression(mockObjectElemID))
    expect(
      lookupObjetField.annotations[FIELD_ANNOTATIONS.VALUE_SET][1].fullName
    ).toEqual('nonExistingObject')
  })
})
