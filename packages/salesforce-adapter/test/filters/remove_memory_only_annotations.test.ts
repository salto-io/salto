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
  Element, ElemID, ObjectType, InstanceElement, BuiltinTypes, Field,
} from '@salto-io/adapter-api'
import { FilterWith } from '../../src/filter'
import SalesforceClient from '../../src/client/client'
import filterCreator from '../../src/filters/remove_memory_only_annotations'
import mockAdapter from '../adapter'
import { SALESFORCE, API_NAME, METADATA_TYPE, INTERNAL_ID_ANNOTATION, INSTANCE_FULL_NAME_FIELD } from '../../src/constants'

describe('Remove memory-only annotations filter', () => {
  let client: SalesforceClient
  type FilterType = FilterWith<'onFetch'>
  let filter: FilterType
  const objTypeID = new ElemID(SALESFORCE, 'Obj')

  const generateElements = (): Element[] => {
    const objType = new ObjectType({
      annotationTypes: {
        [INTERNAL_ID_ANNOTATION]: BuiltinTypes.STRING,
        [METADATA_TYPE]: BuiltinTypes.STRING,
      },
      annotations: {
        [METADATA_TYPE]: 'obj',
        // won't exist but this is the only example right now
        [INTERNAL_ID_ANNOTATION]: 'some id',
      },
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
            [INTERNAL_ID_ANNOTATION]: 'some id',
          },
          type: BuiltinTypes.STRING,
        },
      },
    })
    const instanceName = 'inst'
    const instance = new InstanceElement(
      instanceName,
      objType,
      {
        standard: 'aaa',
        custom: 'bbb',
        [INSTANCE_FULL_NAME_FIELD]: 'inst',
      },
      undefined,
      {
        [INTERNAL_ID_ANNOTATION]: 'some id',
      }
    )
    return [objType, instance]
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

    beforeAll(async () => {
      elements = generateElements()
      numElements = elements.length
      await filter.onFetch(elements)
    })

    it('should not change # of elements', () => {
      expect(elements.length).toEqual(numElements)
    })

    it('should remove memory-only annotation from field if it exists', () => {
      expect(elements[0]).toBeInstanceOf(ObjectType)
      const objType = elements[0] as ObjectType
      expect(objType.fields.custom).toBeInstanceOf(Field)
      expect(Object.keys(objType.fields.custom.annotations)).not.toContain(INTERNAL_ID_ANNOTATION)
      expect(Object.keys(objType.fields.custom.annotations)).toHaveLength(1)
      expect(objType.fields.special).toBeInstanceOf(Field)
      expect(Object.keys(objType.fields.special.annotations)).not.toContain(INTERNAL_ID_ANNOTATION)
      expect(Object.keys(objType.fields.special.annotations)).toHaveLength(1)
    })

    it('should remove memory-only annotation and annotationType from object type', () => {
      expect(elements[0]).toBeInstanceOf(ObjectType)
      const objType = elements[0] as ObjectType
      expect(Object.keys(objType.annotations)).not.toContain(INTERNAL_ID_ANNOTATION)
      expect(Object.keys(objType.annotations)).toHaveLength(1)
      expect(Object.keys(objType.annotationTypes)).not.toContain(INTERNAL_ID_ANNOTATION)
      expect(Object.keys(objType.annotationTypes)).toHaveLength(1)
    })
  })
})
