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
import {
  ObjectType,
  ElemID,
  BuiltinTypes,
  Element,
  InstanceElement,
} from '@salto-io/adapter-api'
import { makeFilter } from '../../src/filters/remove_fields_and_values'
import * as constants from '../../src/constants'
import { defaultFilterContext } from '../utils'
import { FilterWith } from './mocks'

describe('remove fields filter', () => {
  const mockObjId = new ElemID(constants.SALESFORCE, 'typeRemoval')
  const mockType = new ObjectType({
    elemID: mockObjId,
    fields: {
      existing: { refType: BuiltinTypes.STRING },
      remove: { refType: BuiltinTypes.STRING },
    },
    annotations: {
      [constants.METADATA_TYPE]: 'typeRemoval',
    },
  })
  const mockNestedType = new ObjectType({
    elemID: new ElemID(constants.SALESFORCE, 'nested'),
    fields: {
      existing: { refType: BuiltinTypes.STRING },
      remove: { refType: BuiltinTypes.STRING },
    },
    annotations: {
      [constants.METADATA_TYPE]: 'nested',
    },
  })

  const mockObjIdWithInstance = new ElemID(
    constants.SALESFORCE,
    'typeWithInstance',
  )
  const mockTypeWithInstance = new ObjectType({
    elemID: mockObjIdWithInstance,
    fields: {
      existing: { refType: BuiltinTypes.STRING },
      removeAlsoFromInstance: { refType: BuiltinTypes.STRING },
      removeAlsoFromInstance2: { refType: BuiltinTypes.STRING },
      withNested: { refType: mockNestedType },
    },
    annotations: {
      [constants.METADATA_TYPE]: 'typeWithInstance',
    },
  })
  const mockInstance = new InstanceElement(
    'instanceWithValueToRemove',
    mockTypeWithInstance,
    {
      existing: 'existing',
      doesntExistInType: 'doesntExistInType',
      removeAlsoFromInstance: 'removeAlsoFromInstance',
      removeAlsoFromInstance2: 'removeAlsoFromInstance2',
      withNested: {
        existing: 'existing',
        remove: 'remove',
      },
    },
  )

  const filter = makeFilter(
    new Map([
      ['typeRemoval', ['remove']],
      [
        'typeWithInstance',
        ['removeAlsoFromInstance', 'removeAlsoFromInstance2'],
      ],
      ['nested', ['remove']],
    ]),
  )({ config: defaultFilterContext }) as FilterWith<'onFetch'>

  let testElements: Element[]

  beforeEach(() => {
    testElements = [
      mockType.clone(),
      mockTypeWithInstance.clone(),
      mockNestedType.clone(),
      mockInstance.clone(),
    ]
  })

  describe('on fetch', () => {
    beforeEach(() => filter.onFetch(testElements))

    it('should remove field', () => {
      const testType = testElements[0] as ObjectType
      expect(testType.fields.existing).toBeDefined()
      expect(testType.fields.existing.isEqual(mockType.fields.existing)).toBe(
        true,
      )
      expect(testType.fields.remove).toBeUndefined()
    })

    it('should not remove field when the ID is not of the right object', () => {
      const testType = testElements[1] as ObjectType
      expect(testType.fields.existing).toBeDefined()
      expect(
        testType.fields.existing.isEqual(mockTypeWithInstance.fields.existing),
      ).toBe(true)
    })

    it('should remove multiple fields from type and corresponding instance', () => {
      const testType = testElements[1] as ObjectType
      expect(testType.fields.removeAlsoFromInstance).toBeUndefined()
      expect(testType.fields.removeAlsoFromInstance2).toBeUndefined()

      const testInstance = testElements[3] as InstanceElement
      expect(testInstance.value.existing).toEqual(mockInstance.value.existing)
      expect(testInstance.value.removeAlsoFromInstance).toBeUndefined()
      expect(testInstance.value.removeAlsoFromInstance2).toBeUndefined()
      expect(testInstance.value.withNested).toBeDefined()
      expect(testInstance.value.withNested.existing).toEqual(
        mockInstance.value.withNested.existing,
      )
      expect(testInstance.value.withNested.remove).toBeUndefined()
    })

    it('should remove from nested type and corresponding instance', () => {
      const testNestedType = testElements[2] as ObjectType
      expect(testNestedType.fields.existing).toBeDefined()
      expect(
        testNestedType.fields.existing.isEqual(mockNestedType.fields.existing),
      ).toBe(true)
      expect(testNestedType.fields.remove).toBeUndefined()

      const testInstance = testElements[3] as InstanceElement
      expect(testInstance.value.withNested).toBeDefined()
      expect(testInstance.value.withNested.existing).toEqual(
        mockInstance.value.withNested.existing,
      )
      expect(testInstance.value.withNested.remove).toBeUndefined()
    })

    it('should not remove values that does not exist on type', () => {
      const testInstance = testElements[3] as InstanceElement
      expect(testInstance.value.doesntExistInType).toBeDefined()
      expect(testInstance.value.doesntExistInType).toEqual(
        mockInstance.value.doesntExistInType,
      )
    })
  })
})
