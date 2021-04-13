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
  ObjectType, ElemID, InstanceElement, Element, BuiltinTypes, isInstanceElement,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils } from '@salto-io/adapter-components'
import WorkatoClient from '../../src/client/client'
import { paginate } from '../../src/client/pagination'
import filterCreator from '../../src/filters/extract_fields'
import { DEFAULT_TYPES, DEFAULT_ID_FIELDS } from '../../src/config'
import { WORKATO } from '../../src/constants'

describe('Extract fields filter', () => {
  let client: WorkatoClient
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType

  const generateElements = (jsonCode: boolean): Element[] => {
    const recipeType = new ObjectType({
      elemID: new ElemID(WORKATO, 'recipe'),
      fields: {
        name: { type: BuiltinTypes.STRING },
        code: { type: BuiltinTypes.STRING },
      },
    })
    const connectionType = new ObjectType({
      elemID: new ElemID(WORKATO, 'connection'),
      fields: {
        name: { type: BuiltinTypes.STRING },
        application: { type: BuiltinTypes.STRING },
        code: { type: BuiltinTypes.STRING },
      },
    })
    const instances = [
      new InstanceElement(
        'recipe123',
        recipeType,
        {
          name: 'recipe123',
          code: jsonCode ? '{"flat":"a","nested":{"inner":"abc"}}' : { flat: 'a', nested: { inner: 'abc' } },
        },
      ),
      new InstanceElement(
        'recipe456',
        recipeType,
        {
          name: 'recipe456',
          code: jsonCode ? '{"nested":{"inner":"def","other":"ghi"}}' : { nested: { inner: 'def', other: 'ghi' } },
        },
      ),
      new InstanceElement(
        'conn',
        connectionType,
        {
          name: 'conn',
          code: 'ignore',
        },
      ),
    ]
    const typeWithNoInstances = new ObjectType({
      elemID: new ElemID(WORKATO, 'typeWithNoInstances'),
    })
    return [recipeType, connectionType, ...instances, typeWithNoInstances]
  }

  beforeAll(() => {
    client = new WorkatoClient({
      credentials: { username: 'a', token: 'b' },
    })
    filter = filterCreator({
      client,
      paginator: clientUtils.createPaginator({
        client,
        paginationFunc: paginate,
      }),
      config: {
        fetch: {
          includeTypes: ['connection', 'recipe'],
        },
        apiDefinitions: {
          typeDefaults: {
            transformation: {
              idFields: DEFAULT_ID_FIELDS,
            },
          },
          types: {
            ...DEFAULT_TYPES,
            nonexistentType: {
              request: {
                url: '/something',
              },
              transformation: {
                fieldsToOmit: [
                  { fieldName: 'created_at', fieldType: 'string' },
                  { fieldName: 'updated_at', fieldType: 'string' },
                  { fieldName: 'last_run_at' },
                  { fieldName: 'job_succeeded_count' },
                  { fieldName: 'job_failed_count' },
                ],
                standaloneFields: [
                  { fieldName: 'code', parseJSON: true },
                ],
              },
            },
            typeWithNoInstances: {
              transformation: {
                standaloneFields: [
                  { fieldName: 'something' },
                ],
              },
            },
            // override existing type with nonexistent standalone field
            connection: {
              request: {
                url: '/connections',
              },
              transformation: {
                standaloneFields: [
                  { fieldName: 'nonexistent' },
                ],
              },
            },
          },
        },
      },
    }) as FilterType
  })

  describe('extract code fields to their own instances when the value is an object', () => {
    let elements: Element[]
    let origInstances: InstanceElement[]
    let numElements: number

    beforeAll(async () => {
      elements = generateElements(false)
      origInstances = elements.filter(isInstanceElement).map(e => e.clone())
      numElements = elements.length
      await filter.onFetch(elements)
    })

    it('should add two types and two instances', () => {
      expect(elements.length).toEqual(numElements + 4)
    })
    it('should modify the recipe type', () => {
      const recipeType = elements[0] as ObjectType
      expect(recipeType.fields.code.type).toBeInstanceOf(ObjectType)
      const codeType = recipeType.fields.code.type as ObjectType
      expect(codeType.isEqual(new ObjectType({
        elemID: new ElemID(WORKATO, 'recipe__code'),
        fields: {
          flat: { type: BuiltinTypes.STRING },
          nested: { type: new ObjectType({
            elemID: new ElemID(WORKATO, 'recipe__code__nested'),
            fields: {
              inner: { type: BuiltinTypes.STRING },
            },
          }) },
        },
      }))).toBeTruthy()
    })

    it('should create new recipe__code instances and reference them', () => {
      expect(elements[2]).toBeInstanceOf(InstanceElement)
      expect(elements[3]).toBeInstanceOf(InstanceElement)
      const recipe123 = elements[2] as InstanceElement
      const recipe456 = elements[3] as InstanceElement
      expect(elements[6]).toBeInstanceOf(ObjectType)
      expect(elements[7]).toBeInstanceOf(ObjectType)
      expect(elements[8]).toBeInstanceOf(InstanceElement)
      expect(elements[9]).toBeInstanceOf(InstanceElement)
      const recipeCode = elements[6] as ObjectType
      const recipeCodeNested = elements[7] as ObjectType
      const recipe123Code = elements[8] as InstanceElement
      const recipe456Code = elements[9] as InstanceElement

      expect(Object.keys(recipeCode.fields)).toEqual(['flat', 'nested'])
      expect(Object.keys(recipeCodeNested.fields)).toEqual(['inner', 'other'])
      expect(recipe123Code.type).toEqual(recipeCode)
      expect(recipe456Code.type).toEqual(recipeCode)

      const origRecipe123 = origInstances[0]
      const origRecipe456 = origInstances[1]

      expect(recipe123Code.value).toEqual(origRecipe123.value.code)
      expect(recipe456Code.value).toEqual(origRecipe456.value.code)

      expect(recipe123.value.code).toBeInstanceOf(ReferenceExpression)
      expect(recipe456.value.code).toBeInstanceOf(ReferenceExpression)
      expect((recipe123.value.code as ReferenceExpression).elemId.getFullName()).toEqual(
        recipe123Code.elemID.getFullName()
      )
      expect((recipe456.value.code as ReferenceExpression).elemId.getFullName()).toEqual(
        recipe456Code.elemID.getFullName()
      )
    })

    it('should not modify the connection type', () => {
      const connectionType = elements[1] as ObjectType
      expect(connectionType.fields.code.type).toEqual(BuiltinTypes.STRING)
    })
  })

  describe('extract code fields to their own instances when the value is a serialized json of an object', () => {
    let elements: Element[]
    let origInstances: InstanceElement[]
    let numElements: number

    beforeAll(async () => {
      elements = generateElements(true)
      origInstances = elements.filter(isInstanceElement).map(e => e.clone())
      numElements = elements.length
      await filter.onFetch(elements)
    })

    it('should add two types and two instances', () => {
      expect(elements.length).toEqual(numElements + 4)
    })
    it('should modify the recipe type', () => {
      const recipeType = elements[0] as ObjectType
      expect(recipeType.fields.code.type).toBeInstanceOf(ObjectType)
      const codeType = recipeType.fields.code.type as ObjectType
      expect(codeType.isEqual(new ObjectType({
        elemID: new ElemID(WORKATO, 'recipe__code'),
        fields: {
          flat: { type: BuiltinTypes.STRING },
          nested: { type: new ObjectType({
            elemID: new ElemID(WORKATO, 'recipe__code__nested'),
            fields: {
              inner: { type: BuiltinTypes.STRING },
            },
          }) },
        },
      }))).toBeTruthy()
    })

    it('should create new recipe__code instances and reference them', () => {
      expect(elements[2]).toBeInstanceOf(InstanceElement)
      expect(elements[3]).toBeInstanceOf(InstanceElement)
      const recipe123 = elements[2] as InstanceElement
      const recipe456 = elements[3] as InstanceElement
      expect(elements[6]).toBeInstanceOf(ObjectType)
      expect(elements[7]).toBeInstanceOf(ObjectType)
      expect(elements[8]).toBeInstanceOf(InstanceElement)
      expect(elements[9]).toBeInstanceOf(InstanceElement)
      const recipeCode = elements[6] as ObjectType
      const recipeCodeNested = elements[7] as ObjectType
      const recipe123Code = elements[8] as InstanceElement
      const recipe456Code = elements[9] as InstanceElement

      expect(Object.keys(recipeCode.fields)).toEqual(['flat', 'nested'])
      expect(Object.keys(recipeCodeNested.fields)).toEqual(['inner', 'other'])
      expect(recipe123Code.type).toEqual(recipeCode)
      expect(recipe456Code.type).toEqual(recipeCode)

      const origRecipe123 = origInstances[0]
      const origRecipe456 = origInstances[1]

      expect(recipe123Code.value).toEqual(JSON.parse(origRecipe123.value.code))
      expect(recipe456Code.value).toEqual(JSON.parse(origRecipe456.value.code))

      expect(recipe123.value.code).toBeInstanceOf(ReferenceExpression)
      expect(recipe456.value.code).toBeInstanceOf(ReferenceExpression)
      expect((recipe123.value.code as ReferenceExpression).elemId.getFullName()).toEqual(
        recipe123Code.elemID.getFullName()
      )
      expect((recipe456.value.code as ReferenceExpression).elemId.getFullName()).toEqual(
        recipe456Code.elemID.getFullName()
      )
    })

    it('should not modify the connection type', () => {
      const connectionType = elements[1] as ObjectType
      expect(connectionType.fields.code.type).toEqual(BuiltinTypes.STRING)
    })
  })

  describe('keep original code fields when not all values are an object or a serialized object', () => {
    let elements: Element[]
    let origInstances: InstanceElement[]
    let numElements: number

    beforeAll(async () => {
      elements = generateElements(false)
      const recipe456 = elements[3] as InstanceElement
      recipe456.value.code = 'invalid'
      origInstances = elements.filter(isInstanceElement).map(e => e.clone())
      numElements = elements.length
      await filter.onFetch(elements)
    })

    it('should not modify elements', () => {
      expect(elements.length).toEqual(numElements)
    })
    it('should not modify the recipe type', () => {
      const recipeType = elements[0] as ObjectType
      expect(recipeType.fields.code.type).toEqual(BuiltinTypes.STRING)
      expect(elements[2]).toEqual(origInstances[0])
      expect(elements[3]).toEqual(origInstances[1])
      expect(elements[4]).toEqual(origInstances[2])
    })
  })

  describe('keep original code fields when not all values are an object or a serialized object, with {', () => {
    let elements: Element[]
    let origInstances: InstanceElement[]
    let numElements: number

    beforeAll(async () => {
      elements = generateElements(false)
      const recipe456 = elements[3] as InstanceElement
      recipe456.value.code = '{invalid'
      origInstances = elements.filter(isInstanceElement).map(e => e.clone())
      numElements = elements.length
      await filter.onFetch(elements)
    })

    it('should not modify elements', () => {
      expect(elements.length).toEqual(numElements)
    })
    it('should not modify the recipe type', () => {
      const recipeType = elements[0] as ObjectType
      expect(recipeType.fields.code.type).toEqual(BuiltinTypes.STRING)
      expect(elements[2]).toEqual(origInstances[0])
      expect(elements[3]).toEqual(origInstances[1])
      expect(elements[4]).toEqual(origInstances[2])
    })
  })
})
