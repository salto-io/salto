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
import { ObjectType, ElemID, InstanceElement, Element, BuiltinTypes, isInstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import { extractStandaloneFields } from '../../../src/elements/ducktype/standalone_field_extractor'

const ADAPTER_NAME = 'myAdapter'

describe('Extract standalone fields', () => {
  const generateElements = (jsonCode: boolean): Element[] => {
    const recipeType = new ObjectType({
      elemID: new ElemID(ADAPTER_NAME, 'recipe'),
      fields: {
        name: { refType: BuiltinTypes.STRING },
        code: { refType: BuiltinTypes.STRING },
      },
    })
    const connectionType = new ObjectType({
      elemID: new ElemID(ADAPTER_NAME, 'connection'),
      fields: {
        name: { refType: BuiltinTypes.STRING },
        application: { refType: BuiltinTypes.STRING },
        code: { refType: BuiltinTypes.STRING },
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
      elemID: new ElemID(ADAPTER_NAME, 'typeWithNoInstances'),
    })
    return [recipeType, connectionType, ...instances, typeWithNoInstances]
  }

  const transformationDefaultConfig = {
    idFields: ['id'],
  }
  const transformationConfigByType = {
    recipe: {
      standaloneFields: [
        { fieldName: 'code', parseJSON: true },
      ],
    },
    nonexistentType: {
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
    typeWithNoInstances: {
      standaloneFields: [
        { fieldName: 'something' },
      ],
    },
    // override existing type with nonexistent standalone field
    connection: {
      standaloneFields: [
        { fieldName: 'nonexistent' },
      ],
    },
  }

  describe('extract code fields to their own instances when the value is an object', () => {
    let elements: Element[]
    let origInstances: InstanceElement[]
    let numElements: number

    beforeAll(async () => {
      elements = generateElements(false)
      origInstances = elements.filter(isInstanceElement).map(e => e.clone())
      numElements = elements.length
      await extractStandaloneFields({
        elements,
        adapterName: ADAPTER_NAME,
        transformationConfigByType,
        transformationDefaultConfig,
      })
    })

    it('should add two types and two instances', () => {
      expect(elements.length).toEqual(numElements + 4)
    })
    it('should modify the recipe type', async () => {
      const recipeType = elements[0] as ObjectType
      expect(await recipeType.fields.code.getType()).toBeInstanceOf(ObjectType)
      const codeType = await recipeType.fields.code.getType() as ObjectType
      expect(codeType.isEqual(new ObjectType({
        elemID: new ElemID(ADAPTER_NAME, 'recipe__code'),
        fields: {
          nested: { refType: new ObjectType({
            elemID: new ElemID(ADAPTER_NAME, 'recipe__code__nested'),
            fields: {
              inner: { refType: BuiltinTypes.STRING },
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
      expect(recipe123Code.refType.elemID.isEqual(recipeCode.elemID)).toBeTruthy()
      expect(recipe456Code.refType.elemID.isEqual(recipeCode.elemID)).toBeTruthy()

      const origRecipe123 = origInstances[0]
      const origRecipe456 = origInstances[1]

      expect(recipe123Code.value).toEqual(origRecipe123.value.code)
      expect(recipe456Code.value).toEqual(origRecipe456.value.code)

      expect(recipe123.value.code).toBeInstanceOf(ReferenceExpression)
      expect(recipe456.value.code).toBeInstanceOf(ReferenceExpression)
      expect((recipe123.value.code as ReferenceExpression).elemID.getFullName()).toEqual(
        recipe123Code.elemID.getFullName()
      )
      expect((recipe456.value.code as ReferenceExpression).elemID.getFullName()).toEqual(
        recipe456Code.elemID.getFullName()
      )
    })

    it('should not modify the connection type', () => {
      const connectionType = elements[1] as ObjectType
      expect(connectionType.fields.code.refType.elemID.isEqual(BuiltinTypes.STRING.elemID))
        .toBeTruthy()
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
      await extractStandaloneFields({
        elements,
        adapterName: ADAPTER_NAME,
        transformationConfigByType,
        transformationDefaultConfig,
      })
    })

    it('should add two types and two instances', () => {
      expect(elements.length).toEqual(numElements + 4)
    })
    it('should modify the recipe type', async () => {
      const recipeType = elements[0] as ObjectType
      expect(await recipeType.fields.code.getType()).toBeInstanceOf(ObjectType)
      const codeType = await recipeType.fields.code.getType() as ObjectType
      expect(codeType.isEqual(new ObjectType({
        elemID: new ElemID(ADAPTER_NAME, 'recipe__code'),
        fields: {
          flat: { refType: BuiltinTypes.STRING },
          nested: { refType: new ObjectType({
            elemID: new ElemID(ADAPTER_NAME, 'recipe__code__nested'),
            fields: {
              inner: { refType: BuiltinTypes.STRING },
            },
          }) },
        },
      })).toBeTruthy()
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
      expect(recipe123Code.refType.elemID.isEqual(recipeCode.elemID)).toBeTruthy()
      expect(recipe456Code.refType.elemID.isEqual(recipeCode.elemID)).toBeTruthy()

      const origRecipe123 = origInstances[0]
      const origRecipe456 = origInstances[1]

      expect(recipe123Code.value).toEqual(JSON.parse(origRecipe123.value.code))
      expect(recipe456Code.value).toEqual(JSON.parse(origRecipe456.value.code))

      expect(recipe123.value.code).toBeInstanceOf(ReferenceExpression)
      expect(recipe456.value.code).toBeInstanceOf(ReferenceExpression)
      expect((recipe123.value.code as ReferenceExpression).elemID.getFullName()).toEqual(
        recipe123Code.elemID.getFullName()
      )
      expect((recipe456.value.code as ReferenceExpression).elemID.getFullName()).toEqual(
        recipe456Code.elemID.getFullName()
      )
    })

    it('should not modify the connection type', () => {
      const connectionType = elements[1] as ObjectType
      expect(connectionType.fields.code.refType.elemID.isEqual(BuiltinTypes.STRING.elemID))
        .toBeTruthy()
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
      await extractStandaloneFields({
        elements,
        adapterName: ADAPTER_NAME,
        transformationConfigByType,
        transformationDefaultConfig,
      })
    })

    it('should not modify elements', () => {
      expect(elements.length).toEqual(numElements)
    })
    it('should not modify the recipe type', () => {
      const recipeType = elements[0] as ObjectType
      expect(recipeType.fields.code.refType.elemID.isEqual(BuiltinTypes.STRING.elemID)).toBeTruthy()
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
      await extractStandaloneFields({
        elements,
        adapterName: ADAPTER_NAME,
        transformationConfigByType,
        transformationDefaultConfig,
      })
    })

    it('should not modify elements', () => {
      expect(elements.length).toEqual(numElements)
    })
    it('should not modify the recipe type', () => {
      const recipeType = elements[0] as ObjectType
      expect(recipeType.fields.code.refType.elemID.isEqual(BuiltinTypes.STRING.elemID)).toBeTruthy()
      expect(elements[2]).toEqual(origInstances[0])
      expect(elements[3]).toEqual(origInstances[1])
      expect(elements[4]).toEqual(origInstances[2])
    })
  })
})
