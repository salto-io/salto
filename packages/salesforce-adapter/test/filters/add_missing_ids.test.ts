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
  Element, ElemID, ObjectType, InstanceElement, BuiltinTypes, Field,
} from '@salto-io/adapter-api'
import { FilterWith } from '../../src/filter'
import SalesforceClient from '../../src/client/client'
import filterCreator from '../../src/filters/add_missing_ids'
import mockAdapter from '../adapter'
import {
  SALESFORCE, API_NAME, METADATA_TYPE, INSTANCE_FULL_NAME_FIELD, INTERNAL_ID_ANNOTATION,
  INTERNAL_ID_FIELD,
} from '../../src/constants'
import { buildFetchProfile } from '../../src/fetch_profile/fetch_profile'

describe('Internal IDs filter', () => {
  let client: SalesforceClient
  type FilterType = FilterWith<'onFetch'>
  let filter: FilterType
  const objTypeID = new ElemID(SALESFORCE, 'Obj')

  const generateElements = (): Element[] => {
    const objType = new ObjectType({
      annotations: { [METADATA_TYPE]: 'obj' },
      elemID: objTypeID,
      fields: {
        standard: { type: BuiltinTypes.STRING },
        custom: {
          annotations: {
            [API_NAME]: 'Obj.custom__c',
          },
          type: BuiltinTypes.STRING,
        },
        special: {
          annotations: {
            [API_NAME]: 'pre__Obj.special__c',
          },
          type: BuiltinTypes.STRING,
        },
      },
    })
    const instances = [
      new InstanceElement(
        'inst',
        objType,
        {
          standard: 'aaa',
          custom: 'bbb',
          [INSTANCE_FULL_NAME_FIELD]: 'inst',
        },
      ),
      new InstanceElement(
        'unknownInst',
        objType,
        {
          standard: 'aaa',
          custom: 'bbb',
          [INSTANCE_FULL_NAME_FIELD]: 'unknownInst',
        },
      ),
      new InstanceElement(
        'dontChange',
        objType,
        {
          standard: 'aaa',
          custom: 'bbb',
          [INTERNAL_ID_FIELD]: 'already defined',
          [INSTANCE_FULL_NAME_FIELD]: 'dontChange',
        },
      ),
    ]
    return [objType, ...instances]
  }

  beforeAll(() => {
    ({ client } = mockAdapter({
      adapterParams: {
      },
    }))
    filter = filterCreator({
      client,
      config: { fetchProfile: buildFetchProfile({}) },
    }) as FilterType
  })

  describe('resolve internal ids', () => {
    let elements: Element[]
    let numElements: number
    let mockListMetadataObjects: jest.Mock

    beforeAll(async () => {
      mockListMetadataObjects = jest.fn()
        .mockImplementationOnce(async () => ({ result: [
          {
            id: 'custom field id 456',
            namespacePrefix: 'pre',
            fullName: 'Obj.special__c',
          },
          {
            id: 'custom field id 123',
            fullName: 'Obj.custom__c',
            namespacePrefix: undefined,
          },
          // should not be looked up
          {
            id: 'should not be used',
            fullName: 'Obj.standard',
            namespacePrefix: undefined,
          },
        ] }))
        .mockImplementationOnce(async () => ({ result: [
          {
            id: 'instance id 431',
            fullName: 'inst',
          },
          {
            id: 'instance id 547',
            fullName: 'dontChange',
          },
        ] }))
      SalesforceClient.prototype.listMetadataObjects = mockListMetadataObjects

      elements = generateElements()
      numElements = elements.length
      await filter.onFetch(elements)
    })

    it('should not change # of elements', () => {
      expect(elements.length).toEqual(numElements)
    })
    it('should make the right requests from listMetadataObjects', () => {
      expect(mockListMetadataObjects).toHaveBeenCalledTimes(2)
      expect(mockListMetadataObjects.mock.calls[0][0].type).toEqual('CustomField')
      expect(mockListMetadataObjects.mock.calls[1][0].type).toEqual('obj')
    })

    it('should add id annotation for custom fields', () => {
      expect(elements[0]).toBeInstanceOf(ObjectType)
      const objType = elements[0] as ObjectType
      expect(objType.fields.custom).toBeInstanceOf(Field)
      expect(objType.fields.custom.annotations?.[INTERNAL_ID_ANNOTATION]).toEqual('custom field id 123')
      expect(objType.fields.special).toBeInstanceOf(Field)
      expect(objType.fields.special.annotations?.[INTERNAL_ID_ANNOTATION]).toEqual('custom field id 456')
    })

    it('should not add id annotation for standard field', () => {
      expect(elements[0]).toBeInstanceOf(ObjectType)
      const objType = elements[0] as ObjectType
      expect(objType.fields.standard?.annotations?.[INTERNAL_ID_ANNOTATION]).toBeUndefined()
    })

    it('should add id field for instance element', () => {
      expect(elements[1]).toBeInstanceOf(InstanceElement)
      const inst = elements[1] as InstanceElement
      expect(inst.value[INTERNAL_ID_FIELD]).toEqual('instance id 431')
    })

    it('should not add id field if instance is not found', () => {
      expect(elements[2]).toBeInstanceOf(InstanceElement)
      const inst = elements[2] as InstanceElement
      expect(inst.value[INTERNAL_ID_FIELD]).toBeUndefined()
    })

    it('should not add id field if id is already known', () => {
      expect(elements[3]).toBeInstanceOf(InstanceElement)
      const inst = elements[3] as InstanceElement
      expect(inst.value[INTERNAL_ID_FIELD]).toEqual('already defined')
    })

    it('should add id annotation for instance elements', () => {
      expect(elements[1]).toBeInstanceOf(InstanceElement)
      expect(elements[2]).toBeInstanceOf(InstanceElement)
      expect(elements[3]).toBeInstanceOf(InstanceElement)
      expect(elements[1].annotations?.[INTERNAL_ID_ANNOTATION]).toBeUndefined()
      expect(elements[2].annotations?.[INTERNAL_ID_ANNOTATION]).toBeUndefined()
      expect(elements[3].annotations?.[INTERNAL_ID_ANNOTATION]).toBeUndefined()
    })
  })
})
