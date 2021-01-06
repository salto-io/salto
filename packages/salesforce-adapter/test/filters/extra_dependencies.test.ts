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
import { Element, ElemID, ObjectType, InstanceElement, BuiltinTypes, ReferenceExpression, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { createRefToElmWithValue } from '@salto-io/adapter-utils'
import { FilterWith } from '../../src/filter'
import SalesforceClient from '../../src/client/client'
import filterCreator from '../../src/filters/extra_dependencies'
import mockAdapter from '../adapter'
import {
  SALESFORCE, API_NAME, METADATA_TYPE, INSTANCE_FULL_NAME_FIELD, FIELD_ANNOTATIONS,
  CUSTOM_FIELD, INTERNAL_ID_FIELD, INTERNAL_ID_ANNOTATION,
} from '../../src/constants'
import { SalesforceRecord } from '../../src/client/types'

describe('Internal IDs filter', () => {
  let client: SalesforceClient
  type FilterType = FilterWith<'onFetch'>
  let filter: FilterType
  const objTypeID = new ElemID(SALESFORCE, 'Obj')
  const otherObjTypeID = new ElemID(SALESFORCE, 'OtherO')

  const generateElements = (): Element[] => {
    const objType = new ObjectType({
      annotations: { [METADATA_TYPE]: 'obj' },
      elemID: objTypeID,
      fields: {
        standard: {
          refType: createRefToElmWithValue(BuiltinTypes.STRING),
        },
        custom: {
          annotations: {
            [API_NAME]: 'Obj.custom__c',
            [INTERNAL_ID_ANNOTATION]: 'custom id',
          },
          refType: createRefToElmWithValue(BuiltinTypes.STRING),
        },
        special: {
          annotations: {
            [API_NAME]: 'Obj.special__c',
            [FIELD_ANNOTATIONS.REFERENCE_TO]: [
              new ReferenceExpression(new ElemID(SALESFORCE, 'OtherO', 'field', 'moreSpecial')),
            ],
            [INTERNAL_ID_ANNOTATION]: 'special id',
          },
          refType: createRefToElmWithValue(BuiltinTypes.STRING),
        },
      },
    })
    const otherObjType = new ObjectType({
      annotations: { [METADATA_TYPE]: 'OtherO' },
      elemID: otherObjTypeID,
      fields: {
        moreSpecial: {
          annotations: {
            [API_NAME]: 'OtherO.moreSpecial__c',
            [INTERNAL_ID_ANNOTATION]: 'more special id',
          },
          refType: createRefToElmWithValue(BuiltinTypes.STRING),
        },
      },
    })
    const instances = [
      new InstanceElement(
        'inst1',
        objType,
        {
          standard: 'aaa',
          custom: new ReferenceExpression(objType.fields.custom.elemID),
          [INTERNAL_ID_FIELD]: 'inst1 id',
          [INSTANCE_FULL_NAME_FIELD]: 'inst1',
        },
      ),
      new InstanceElement(
        'inst2',
        objType,
        {
          standard: 'aaa',
          custom: 'Obj.custom__c',
          [INTERNAL_ID_FIELD]: 'inst2 id',
          [INSTANCE_FULL_NAME_FIELD]: 'inst2',
        },
      ),
    ]
    return [objType, otherObjType, ...instances]
  }

  beforeAll(() => {
    ({ client } = mockAdapter({
      adapterParams: {
      },
    }))
    filter = filterCreator({ client, config: {} }) as FilterType
  })

  describe('resolve internal ids', () => {
    let elements: Element[]
    let numElements: number
    let mockQueryAll: jest.Mock

    async function *mockQueryAllImpl(): AsyncIterable<SalesforceRecord[]> {
      yield [
        {
          MetadataComponentType: 'obj',
          MetadataComponentId: 'inst1 id',
          MetadataComponentName: 'n1',
          RefMetadataComponentType: CUSTOM_FIELD,
          RefMetadataComponentId: 'custom id',
          RefMetadataComponentName: 'n2',
        },
        {
          MetadataComponentType: 'obj',
          MetadataComponentId: 'inst1 id',
          MetadataComponentName: 'n3',
          RefMetadataComponentType: CUSTOM_FIELD,
          RefMetadataComponentId: 'special id',
          RefMetadataComponentName: 'n4',
        },
        {
          MetadataComponentType: 'obj',
          MetadataComponentId: 'inst2 id',
          MetadataComponentName: 'n5',
          RefMetadataComponentType: CUSTOM_FIELD,
          RefMetadataComponentId: 'custom id',
          RefMetadataComponentName: 'n6',
        },
      ] as unknown as SalesforceRecord[]
      yield [
        {
          MetadataComponentType: 'obj',
          MetadataComponentId: 'inst2 id',
          MetadataComponentName: 'n7',
          RefMetadataComponentType: CUSTOM_FIELD,
          RefMetadataComponentId: 'more special id',
          RefMetadataComponentName: 'n8',
        },
        {
          MetadataComponentType: 'obj',
          MetadataComponentId: 'inst2 id',
          MetadataComponentName: 'n7',
          RefMetadataComponentType: CUSTOM_FIELD,
          RefMetadataComponentId: 'unknown field',
          RefMetadataComponentName: 'n8',
        },
        {
          MetadataComponentType: 'obj',
          MetadataComponentId: 'unknown src id',
          MetadataComponentName: 'n1',
          RefMetadataComponentType: CUSTOM_FIELD,
          RefMetadataComponentId: 'custom id',
          RefMetadataComponentName: 'n2',
        },
      ] as unknown as SalesforceRecord[]
    }

    beforeAll(async () => {
      mockQueryAll = jest.fn()
        .mockImplementationOnce(mockQueryAllImpl)
      SalesforceClient.prototype.queryAll = mockQueryAll

      elements = generateElements()
      numElements = elements.length
      await filter.onFetch(elements)
    })

    it('should not change # of elements', () => {
      expect(elements.length).toEqual(numElements)
    })

    it('should add _generated_dependencies when reference does not already exist', () => {
      expect(elements[2]).toBeInstanceOf(InstanceElement)
      const inst1Deps = elements[2].annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]
      // "custom" is already referenced using a reference expression on a field
      expect(inst1Deps).toHaveLength(1)
      expect(inst1Deps[0]).toBeInstanceOf(ReferenceExpression)
      expect(inst1Deps[0].elemID.getFullName()).toEqual('salesforce.Obj.field.special')

      expect(elements[3]).toBeInstanceOf(InstanceElement)
      const inst2Deps = elements[3].annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]
      // "moreSpecial" is not referenced from an instance so it is included
      // "unknown" is not a real field so it's not included
      expect(inst2Deps).toHaveLength(2)
      expect(inst2Deps[0]).toBeInstanceOf(ReferenceExpression)
      expect(inst2Deps[0].elemID.getFullName()).toEqual('salesforce.Obj.field.custom')
      expect(inst2Deps[1].elemID.getFullName()).toEqual('salesforce.OtherO.field.moreSpecial')
    })
  })
})
