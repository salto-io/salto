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
import { ObjectType, ElemID, Element, ReferenceExpression, isObjectType, ChangeDataType, Change, toChange, AdditionChange, ModificationChange } from '@salto-io/adapter-api'
import { FilterWith } from '../../../src/filter'
import SalesforceClient from '../../../src/client/client'
import mockAdapter from '../../adapter'
import filterCreator from '../../../src/filters/cpq/lookup_object'
import { SALESFORCE, CPQ_PRODUCT_RULE, CPQ_LOOKUP_OBJECT_NAME, API_NAME, METADATA_TYPE, CUSTOM_OBJECT, FIELD_ANNOTATIONS, CPQ_CONFIGURATION_ATTRIBUTE, CPQ_DEFAULT_OBJECT_FIELD, CPQ_QUOTE_NO_PRE, CPQ_QUOTE } from '../../../src/constants'
import { Types } from '../../../src/transformers/transformer'

describe('lookup_object filter', () => {
  let client: SalesforceClient
  type FilterType = FilterWith<'onFetch' | 'onDeploy' | 'preDeploy'>
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
  const mockQuoteElemID = new ElemID(SALESFORCE, CPQ_QUOTE)
  const mockQuote = new ObjectType({
    elemID: mockQuoteElemID,
    annotations: {
      [API_NAME]: CPQ_QUOTE,
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
  const mockConfigurationAttributeElemID = new ElemID(SALESFORCE, CPQ_CONFIGURATION_ATTRIBUTE)
  const mockConfigurationAttribute = new ObjectType({
    elemID: mockConfigurationAttributeElemID,
    fields: {
      [CPQ_DEFAULT_OBJECT_FIELD]: {
        type: Types.primitiveDataTypes.Picklist,
        annotations: {
          [API_NAME]: CPQ_DEFAULT_OBJECT_FIELD,
          valueSet: [{
            fullName: CPQ_QUOTE_NO_PRE,
          },
          {
            fullName: existingObjectName,
          },
          {
            fullName: 'nonExistingObject',
          },
          ],
        },
      },
    },
    annotations: {
      [API_NAME]: CPQ_CONFIGURATION_ATTRIBUTE,
      [METADATA_TYPE]: CUSTOM_OBJECT,
    },
  })

  describe('onFetch', () => {
    beforeAll(async () => {
      ({ client } = mockAdapter({
        adapterParams: {
        },
      }))
      filter = filterCreator({ client, config: {} }) as FilterType
      elements = [
        mockObject.clone(),
        mockProductRuleObject.clone(),
        mockConfigurationAttribute.clone(),
        mockQuote.clone(),
      ]
      await filter.onFetch(elements)
    })

    it('Should not add or remove elements', () => {
      expect(elements).toHaveLength(4)
      expect(elements.find(e => e.elemID.isEqual(mockObjectElemID))).toBeDefined()
      expect(elements.find(e => e.elemID.isEqual(mockProductRuleElemID))).toBeDefined()
      expect(elements.find(e => e.elemID.isEqual(mockConfigurationAttributeElemID))).toBeDefined()
      expect(elements.find(e => e.elemID.isEqual(mockQuoteElemID))).toBeDefined()
    })

    it('Should not change elements not defined as ones with lookup', () => {
      expect(elements.find(e => e.elemID.isEqual(mockObjectElemID))).toStrictEqual(mockObject)
      expect(elements.find(e => e.elemID.isEqual(mockQuoteElemID))).toStrictEqual(mockQuote)
    })

    describe('Object with no valuesMapping defined', () => {
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

    describe('Object with valuesMapping defined', () => {
      it('Should change lookup field value set fullName value to a ref if custom object exists (mapped and not) and keep string if not', () => {
        const mockConfigurationAttr = elements
          .find(e => e.elemID.isEqual(mockConfigurationAttributeElemID))
        expect(mockConfigurationAttr).toBeDefined()
        expect(isObjectType(mockConfigurationAttr)).toBeTruthy()
        const defaultObjectField = (mockConfigurationAttr as ObjectType)
          .fields[CPQ_DEFAULT_OBJECT_FIELD]
        expect(defaultObjectField).toBeDefined()
        expect(
          defaultObjectField.annotations[FIELD_ANNOTATIONS.VALUE_SET][0].fullName
        ).toEqual(new ReferenceExpression(mockQuoteElemID))
        expect(
          defaultObjectField.annotations[FIELD_ANNOTATIONS.VALUE_SET][1].fullName
        ).toEqual(new ReferenceExpression(mockObjectElemID))
        expect(
          defaultObjectField.annotations[FIELD_ANNOTATIONS.VALUE_SET][2].fullName
        ).toEqual('nonExistingObject')
      })
    })
  })

  describe('preDeploy', () => {
    let changes: Change<ChangeDataType>[]
    const mockAfterResolveConfigurationAttribute = new ObjectType({
      elemID: mockConfigurationAttributeElemID,
      fields: {
        [CPQ_DEFAULT_OBJECT_FIELD]: {
          type: Types.primitiveDataTypes.Picklist,
          annotations: {
            [API_NAME]: CPQ_DEFAULT_OBJECT_FIELD,
            valueSet: [{
              fullName: CPQ_QUOTE,
            },
            {
              fullName: existingObjectName,
            },
            {
              fullName: 'nonExistingObject',
            },
            ],
          },
        },
      },
      annotations: {
        [API_NAME]: CPQ_CONFIGURATION_ATTRIBUTE,
        [METADATA_TYPE]: CUSTOM_OBJECT,
      },
    })
    describe('Modification changes', () => {
      beforeAll(async () => {
        changes = [
          toChange({
            before: mockAfterResolveConfigurationAttribute.clone(),
            after: mockAfterResolveConfigurationAttribute.clone(),
          }),
        ]
        await filter.preDeploy(changes)
      })
      it('Should map back to the service name instead of api if theres mapping and keep same if not', () => {
        expect(changes[0]).toBeDefined()
        const afterData = (changes[0] as ModificationChange<ObjectType>).data.after
        expect(afterData.fields[CPQ_DEFAULT_OBJECT_FIELD].annotations.valueSet[0].fullName)
          .toEqual(CPQ_QUOTE_NO_PRE)
        expect(afterData.fields[CPQ_DEFAULT_OBJECT_FIELD].annotations.valueSet[1].fullName)
          .toEqual(existingObjectName)
        expect(afterData.fields[CPQ_DEFAULT_OBJECT_FIELD].annotations.valueSet[2].fullName)
          .toEqual('nonExistingObject')
      })
    })
    describe('Addition changes', () => {
      beforeAll(async () => {
        changes = [
          toChange({
            after: mockAfterResolveConfigurationAttribute.clone(),
          }),
        ]
        await filter.preDeploy(changes)
      })
      it('Should map back to the service name instead of api if theres mapping and keep same if not', () => {
        expect(changes[0]).toBeDefined()
        const afterData = (changes[0] as AdditionChange<ObjectType>).data.after
        expect(afterData.fields[CPQ_DEFAULT_OBJECT_FIELD].annotations.valueSet[0].fullName)
          .toEqual(CPQ_QUOTE_NO_PRE)
        expect(afterData.fields[CPQ_DEFAULT_OBJECT_FIELD].annotations.valueSet[1].fullName)
          .toEqual(existingObjectName)
        expect(afterData.fields[CPQ_DEFAULT_OBJECT_FIELD].annotations.valueSet[2].fullName)
          .toEqual('nonExistingObject')
      })
    })
  })

  describe('onDeploy', () => {
    let changes: Change<ChangeDataType>[]
    describe('Modification changes', () => {
      beforeAll(async () => {
        changes = [
          toChange({
            before: mockConfigurationAttribute.clone(),
            after: mockConfigurationAttribute.clone(),
          }),
        ]
        await filter.onDeploy(changes)
      })
      it('Should map to api name if theres mapping and keep same if not', () => {
        expect(changes[0]).toBeDefined()
        const afterData = (changes[0] as ModificationChange<ObjectType>).data.after
        expect(afterData.fields[CPQ_DEFAULT_OBJECT_FIELD].annotations.valueSet[0].fullName)
          .toEqual(CPQ_QUOTE)
        expect(afterData.fields[CPQ_DEFAULT_OBJECT_FIELD].annotations.valueSet[1].fullName)
          .toEqual(existingObjectName)
        expect(afterData.fields[CPQ_DEFAULT_OBJECT_FIELD].annotations.valueSet[2].fullName)
          .toEqual('nonExistingObject')
      })
    })
    describe('Addition changes', () => {
      beforeAll(async () => {
        changes = [
          toChange({
            after: mockConfigurationAttribute.clone(),
          }),
        ]
        await filter.onDeploy(changes)
      })
      it('Should map to api name if theres mapping and keep same if not', () => {
        expect(changes[0]).toBeDefined()
        const afterData = (changes[0] as AdditionChange<ObjectType>).data.after
        expect(afterData.fields[CPQ_DEFAULT_OBJECT_FIELD].annotations.valueSet[0].fullName)
          .toEqual(CPQ_QUOTE)
        expect(afterData.fields[CPQ_DEFAULT_OBJECT_FIELD].annotations.valueSet[1].fullName)
          .toEqual(existingObjectName)
        expect(afterData.fields[CPQ_DEFAULT_OBJECT_FIELD].annotations.valueSet[2].fullName)
          .toEqual('nonExistingObject')
      })
    })
  })
})
