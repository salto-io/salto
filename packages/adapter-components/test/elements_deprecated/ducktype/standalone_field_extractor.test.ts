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
  InstanceElement,
  Element,
  BuiltinTypes,
  isInstanceElement,
  ReferenceExpression,
  ListType,
  isEqualElements,
} from '@salto-io/adapter-api'
import { extractStandaloneFields } from '../../../src/elements_deprecated/ducktype/standalone_field_extractor'

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
    const coverType = new ObjectType({
      elemID: new ElemID(ADAPTER_NAME, 'book__cover'),
      fields: {
        material: { refType: BuiltinTypes.STRING },
      },
    })
    const bookType = new ObjectType({
      elemID: new ElemID(ADAPTER_NAME, 'book'),
      fields: {
        cover: { refType: new ListType(coverType) },
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
        [ADAPTER_NAME, 'Records', 'recipe', 'recipe123', 'recipe123'],
      ),
      new InstanceElement(
        'recipe456',
        recipeType,
        {
          name: 'recipe456',
          code: jsonCode ? '{"nested":{"inner":"def","other":"ghi"}}' : { nested: { inner: 'def', other: 'ghi' } },
        },
        [ADAPTER_NAME, 'Records', 'recipe', 'recipe456', 'recipe456'],
      ),
      new InstanceElement('book1', bookType, {
        cover: [{ material: 'leather' }, { material: 'paper' }],
      }),
      new InstanceElement('conn', connectionType, {
        name: 'conn',
        code: 'ignore',
      }),
      new InstanceElement('recipe_empty', recipeType, {
        name: 'recipe_empty',
        code: jsonCode ? 'null' : undefined,
      }),
    ]
    const typeWithNoInstances = new ObjectType({
      elemID: new ElemID(ADAPTER_NAME, 'typeWithNoInstances'),
    })
    return [recipeType, coverType, bookType, connectionType, ...instances, typeWithNoInstances]
  }

  const transformationDefaultConfig = {
    idFields: ['id'],
  }
  const transformationConfigByType = {
    recipe: {
      standaloneFields: [{ fieldName: 'code', parseJSON: true }],
    },
    book: {
      standaloneFields: [{ fieldName: 'cover' }],
    },
    nonexistentType: {
      fieldsToOmit: [
        { fieldName: 'created_at', fieldType: 'string' },
        { fieldName: 'updated_at', fieldType: 'string' },
        { fieldName: 'last_run_at' },
        { fieldName: 'job_succeeded_count' },
        { fieldName: 'job_failed_count' },
      ],
      standaloneFields: [{ fieldName: 'code', parseJSON: true }],
    },
    typeWithNoInstances: {
      standaloneFields: [{ fieldName: 'something' }],
    },
    // override existing type with nonexistent standalone field
    connection: {
      standaloneFields: [{ fieldName: 'nonexistent' }],
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
      expect(elements.length).toEqual(numElements + 6)
    })
    it('should modify the recipe type if its code type is not an object type', async () => {
      const recipeType = elements[0] as ObjectType
      expect(await recipeType.fields.code.getType()).toBeInstanceOf(ObjectType)
      const codeType = (await recipeType.fields.code.getType()) as ObjectType
      expect(
        codeType.isEqual(
          new ObjectType({
            elemID: new ElemID(ADAPTER_NAME, 'recipe__code'),
            fields: {
              flat: { refType: BuiltinTypes.STRING },
              nested: {
                refType: new ObjectType({
                  elemID: new ElemID(ADAPTER_NAME, 'recipe__code__nested'),
                  fields: {
                    inner: { refType: BuiltinTypes.STRING },
                  },
                }),
              },
            },
          }),
        ),
      ).toBeTruthy()
    })

    it('should create new recipe__code instances and reference them', () => {
      expect(elements[4]).toBeInstanceOf(InstanceElement)
      expect(elements[5]).toBeInstanceOf(InstanceElement)
      const recipe123 = elements[4] as InstanceElement
      const recipe456 = elements[5] as InstanceElement
      expect(elements[10]).toBeInstanceOf(ObjectType)
      expect(elements[11]).toBeInstanceOf(ObjectType)
      expect(elements[12]).toBeInstanceOf(InstanceElement)
      expect(elements[13]).toBeInstanceOf(InstanceElement)
      const recipeCode = elements[10] as ObjectType
      const recipeCodeNested = elements[11] as ObjectType
      const recipe123Code = elements[12] as InstanceElement
      const recipe456Code = elements[13] as InstanceElement

      expect(Object.keys(recipeCode.fields)).toEqual(['flat', 'nested'])
      expect(Object.keys(recipeCodeNested.fields)).toEqual(['inner', 'other'])
      expect(recipe123Code.refType.elemID.isEqual(recipeCode.elemID)).toBeTruthy()
      expect(recipe123Code.path).toEqual([
        ADAPTER_NAME,
        'Records',
        'recipe',
        'recipe123',
        'code',
        'recipe123__unnamed_0',
      ])
      expect(recipe456Code.refType.elemID.isEqual(recipeCode.elemID)).toBeTruthy()
      expect(recipe456Code.path).toEqual([
        ADAPTER_NAME,
        'Records',
        'recipe',
        'recipe456',
        'code',
        'recipe456__unnamed_0',
      ])

      const origRecipe123 = origInstances[0]
      const origRecipe456 = origInstances[1]

      expect(recipe123Code.value).toEqual(origRecipe123.value.code)
      expect(recipe456Code.value).toEqual(origRecipe456.value.code)

      expect(recipe123.value.code).toBeInstanceOf(ReferenceExpression)
      expect(recipe456.value.code).toBeInstanceOf(ReferenceExpression)
      expect((recipe123.value.code as ReferenceExpression).elemID.getFullName()).toEqual(
        recipe123Code.elemID.getFullName(),
      )
      expect((recipe456.value.code as ReferenceExpression).elemID.getFullName()).toEqual(
        recipe456Code.elemID.getFullName(),
      )
    })

    it('should not modify the book type since cover type is already defined', async () => {
      const bookType = elements[2] as ObjectType
      const coverListType = (await bookType.fields.cover.getType()) as ListType
      expect(coverListType).toBeInstanceOf(ListType)
      const coverType = await coverListType.getInnerType()
      expect(coverType).toBeInstanceOf(ObjectType)
      expect(isEqualElements(coverType, elements[1])).toBeTruthy()
    })
    it('should create new book__cover instances and reference them', () => {
      expect(elements[4]).toBeInstanceOf(InstanceElement)
      const book1 = elements.filter(isInstanceElement).filter(e => e.elemID.typeName === 'book')[0]
      const book1Covers = elements.filter(isInstanceElement).filter(e => e.elemID.typeName === 'book__cover')

      const origBook1 = origInstances.filter(e => e.elemID.typeName === 'book')[0]

      expect(book1Covers[0].value).toEqual(origBook1.value.cover[0])
      expect(book1Covers[1].value).toEqual(origBook1.value.cover[1])

      expect(book1.value.cover[0]).toBeInstanceOf(ReferenceExpression)
      expect(book1.value.cover[1]).toBeInstanceOf(ReferenceExpression)
      expect((book1.value.cover[0] as ReferenceExpression).elemID.getFullName()).toEqual(
        book1Covers[0].elemID.getFullName(),
      )
      expect((book1.value.cover[1] as ReferenceExpression).elemID.getFullName()).toEqual(
        book1Covers[1].elemID.getFullName(),
      )
    })

    it('should not modify the connection type', () => {
      const connectionType = elements[3] as ObjectType
      expect(connectionType.fields.code.refType.elemID.isEqual(BuiltinTypes.STRING.elemID)).toBeTruthy()
    })
  })

  describe('extract code fields to their own instances when the value is an array of objects', () => {
    let elements: Element[]
    let origInstances: InstanceElement[]
    let numElements: number

    const generateElementsWithList = (): Element[] => {
      const recipeType = new ObjectType({
        elemID: new ElemID(ADAPTER_NAME, 'recipe'),
        fields: {
          name: { refType: BuiltinTypes.STRING },
          code: { refType: new ListType(BuiltinTypes.STRING) },
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
      const instance = new InstanceElement(
        'recipe123',
        recipeType,
        {
          name: 'recipe123',
          code: [
            { flat: 'a', nested: { inner: 'abc' } },
            { flat: 'b', nested: { inner: 'abc' } },
          ],
        },
        [ADAPTER_NAME, 'Records', 'recipe', 'recipe123', 'recipe123'],
      )

      return [recipeType, connectionType, instance]
    }

    beforeAll(async () => {
      elements = generateElementsWithList()
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

    it('should create new recipe__code instances and reference them', () => {
      expect(elements[2]).toBeInstanceOf(InstanceElement)
      const recipe123 = elements[2] as InstanceElement
      expect(elements[3]).toBeInstanceOf(ObjectType)
      expect(elements[4]).toBeInstanceOf(ObjectType)
      expect(elements[5]).toBeInstanceOf(InstanceElement)
      expect(elements[6]).toBeInstanceOf(InstanceElement)
      const recipeCode = elements[3] as ObjectType
      const recipe123Code1 = elements[5] as InstanceElement
      const recipe123Code2 = elements[6] as InstanceElement

      expect(recipe123Code1.refType.elemID.isEqual(recipeCode.elemID)).toBeTruthy()
      expect(recipe123Code2.refType.elemID.isEqual(recipeCode.elemID)).toBeTruthy()

      expect(recipe123Code1.path).toEqual([
        ADAPTER_NAME,
        'Records',
        'recipe',
        'recipe123',
        'code',
        'recipe123__unnamed_0',
      ])
      expect(recipe123Code2.path).toEqual([
        ADAPTER_NAME,
        'Records',
        'recipe',
        'recipe123',
        'code',
        'recipe123__unnamed_1',
      ])

      const origRecipe123 = origInstances[0]

      expect(recipe123Code1.value).toEqual(origRecipe123.value.code[0])
      expect(recipe123Code2.value).toEqual(origRecipe123.value.code[1])

      expect(recipe123.value.code[0]).toBeInstanceOf(ReferenceExpression)
      expect(recipe123.value.code[1]).toBeInstanceOf(ReferenceExpression)
      expect((recipe123.value.code[0] as ReferenceExpression).elemID.getFullName()).toEqual(
        recipe123Code1.elemID.getFullName(),
      )
      expect((recipe123.value.code[1] as ReferenceExpression).elemID.getFullName()).toEqual(
        recipe123Code2.elemID.getFullName(),
      )
    })

    it('should not modify the connection type', () => {
      const connectionType = elements[1] as ObjectType
      expect(connectionType.fields.code.refType.elemID.isEqual(BuiltinTypes.STRING.elemID)).toBeTruthy()
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
      expect(elements.length).toEqual(numElements + 6)
    })
    it('should modify the recipe type', async () => {
      const recipeType = elements[0] as ObjectType
      expect(await recipeType.fields.code.getType()).toBeInstanceOf(ObjectType)
      const codeType = (await recipeType.fields.code.getType()) as ObjectType
      expect(
        codeType.isEqual(
          new ObjectType({
            elemID: new ElemID(ADAPTER_NAME, 'recipe__code'),
            fields: {
              flat: { refType: BuiltinTypes.STRING },
              nested: {
                refType: new ObjectType({
                  elemID: new ElemID(ADAPTER_NAME, 'recipe__code__nested'),
                  fields: {
                    inner: { refType: BuiltinTypes.STRING },
                  },
                }),
              },
            },
          }),
        ),
      ).toBeTruthy()
    })

    it('should create new recipe__code instances and reference them', () => {
      expect(elements[4]).toBeInstanceOf(InstanceElement)
      expect(elements[5]).toBeInstanceOf(InstanceElement)
      const recipe123 = elements[4] as InstanceElement
      const recipe456 = elements[5] as InstanceElement
      expect(elements[10]).toBeInstanceOf(ObjectType)
      expect(elements[11]).toBeInstanceOf(ObjectType)
      expect(elements[12]).toBeInstanceOf(InstanceElement)
      expect(elements[13]).toBeInstanceOf(InstanceElement)
      const recipeCode = elements[10] as ObjectType
      const recipeCodeNested = elements[11] as ObjectType
      const recipe123Code = elements[12] as InstanceElement
      const recipe456Code = elements[13] as InstanceElement

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
        recipe123Code.elemID.getFullName(),
      )
      expect((recipe456.value.code as ReferenceExpression).elemID.getFullName()).toEqual(
        recipe456Code.elemID.getFullName(),
      )
    })
    it('should not create recipe__code instance when original value is "null"', () => {
      expect(elements[8]).toBeInstanceOf(InstanceElement)
      const recipeEmpty = elements[8] as InstanceElement
      expect(recipeEmpty.value.code).toBeUndefined()
    })

    it('should not modify the connection type', () => {
      const connectionType = elements[3] as ObjectType
      expect(connectionType.fields.code.refType.elemID.isEqual(BuiltinTypes.STRING.elemID)).toBeTruthy()
    })
  })

  describe('keep original code fields when not all values are an object or a serialized object', () => {
    let elements: Element[]
    let origInstances: InstanceElement[]
    let numElements: number

    beforeAll(async () => {
      elements = generateElements(false)
      const recipe456 = elements[5] as InstanceElement
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

    it('should not modify the recipe and connection elements', () => {
      expect(elements.length).toEqual(numElements + 2)
    })
    it('should not modify the recipe and connection instances', () => {
      const recipeType = elements[0] as ObjectType
      expect(recipeType.fields.code.refType.elemID.isEqual(BuiltinTypes.STRING.elemID)).toBeTruthy()
      expect(elements[4]).toEqual(origInstances[0])
      expect(elements[5]).toEqual(origInstances[1])
      expect(elements[7]).toEqual(origInstances[3])
      expect(elements[8]).toEqual(origInstances[4])
    })
  })

  describe('keep original code fields when not all values are an object or a serialized object, with {', () => {
    let elements: Element[]
    let origInstances: InstanceElement[]
    let numElements: number

    beforeAll(async () => {
      elements = generateElements(false)
      const recipe456 = elements[5] as InstanceElement
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

    it('should not modify the recipe and connection elements', () => {
      expect(elements.length).toEqual(numElements + 2)
    })
    it('should not modify the recipe and connection instances', () => {
      const recipeType = elements[0] as ObjectType
      expect(recipeType.fields.code.refType.elemID.isEqual(BuiltinTypes.STRING.elemID)).toBeTruthy()
      expect(elements[4]).toEqual(origInstances[0])
      expect(elements[5]).toEqual(origInstances[1])
      expect(elements[7]).toEqual(origInstances[3])
      expect(elements[8]).toEqual(origInstances[4])
    })
  })
})
