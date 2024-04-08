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

import _ from 'lodash'
import {
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  Element,
  BuiltinTypes,
  isInstanceElement,
  TemplateExpression,
  isReferenceExpression,
  TemplatePart,
  CORE_ANNOTATIONS,
  isObjectType,
} from '@salto-io/adapter-api'
import {
  addReferencesToInstanceNames,
  referencedInstanceNamesFilterCreatorDeprecated,
  createReferenceIndex,
} from '../../src/filters/referenced_instance_names_deprecated'
import { FilterWith } from '../../src/filter_utils'
import { Paginator } from '../../src/client'
import { createMockQuery } from '../../src/fetch/query'
import { NameMappingOptions } from '../../src/definitions'

const ADAPTER_NAME = 'myAdapter'

describe('referenced instances', () => {
  const generateElements = (): Element[] => {
    const recipeType = new ObjectType({
      elemID: new ElemID(ADAPTER_NAME, 'recipe'),
      fields: {
        name: { refType: BuiltinTypes.STRING },
        book_id: { refType: BuiltinTypes.NUMBER },
      },
    })
    const bookType = new ObjectType({
      elemID: new ElemID(ADAPTER_NAME, 'book'),
      fields: {
        id: { refType: BuiltinTypes.NUMBER },
        parent_book_id: { refType: BuiltinTypes.NUMBER },
      },
    })
    const groupType = new ObjectType({
      elemID: new ElemID(ADAPTER_NAME, 'group'),
      fields: {
        name: { refType: BuiltinTypes.STRING },
        fav_recipe: { refType: BuiltinTypes.NUMBER },
      },
    })
    const statusType = new ObjectType({
      elemID: new ElemID(ADAPTER_NAME, 'status'),
      fields: {
        name: { refType: BuiltinTypes.STRING },
        fav_recipe: { refType: BuiltinTypes.NUMBER },
        template_with_refs: { refType: BuiltinTypes.STRING },
      },
    })
    const emailType = new ObjectType({
      elemID: new ElemID(ADAPTER_NAME, 'email'),
      fields: {
        name: { refType: BuiltinTypes.STRING },
        email: { refType: BuiltinTypes.STRING },
      },
    })
    const noIdFieldsType = new ObjectType({
      elemID: new ElemID(ADAPTER_NAME, 'noIdFields'),
      fields: {},
    })
    const nestingParentType = new ObjectType({
      elemID: new ElemID(ADAPTER_NAME, 'nestingParent'),
      fields: {},
    })
    const notNestingParentType = new ObjectType({
      elemID: new ElemID(ADAPTER_NAME, 'notNestingParent'),
      fields: {},
    })
    const standaloneNestedFieldType = new ObjectType({
      elemID: new ElemID(ADAPTER_NAME, 'standaloneNestedField'),
      fields: {
        name: { refType: BuiltinTypes.STRING },
      },
    })
    const standaloneDoubleNestedFieldType = new ObjectType({
      elemID: new ElemID(ADAPTER_NAME, 'nestingParent__standaloneNestedField__standaloneDoubleNestedField'),
      fields: {
        name: { refType: BuiltinTypes.STRING },
      },
    })
    const notStandaloneNestedFieldType = new ObjectType({
      elemID: new ElemID(ADAPTER_NAME, 'notStandaloneNestedField'),
      fields: {
        name: { refType: BuiltinTypes.STRING },
      },
    })
    const rootBook = new InstanceElement('rootBook', bookType, {
      id: 123,
      parent_book_id: 'ROOT',
    })
    const anotherBook = new InstanceElement('book', bookType, {
      id: 456,
      parent_book_id: new ReferenceExpression(rootBook.elemID, rootBook),
    })
    const recipes = [
      new InstanceElement('recipe123', recipeType, {
        name: 'recipe123',
        book_id: new ReferenceExpression(rootBook.elemID, rootBook),
      }),
      new InstanceElement('recipe456', recipeType, {
        name: 'recipe456',
        book_id: new ReferenceExpression(anotherBook.elemID, anotherBook),
      }),
    ]
    const sameRecipeOne = new InstanceElement('sameRecipe', recipeType, {
      name: '12345',
      book_id: new ReferenceExpression(rootBook.elemID, rootBook),
    })
    const sameRecipeTwo = new InstanceElement('sameRecipe', recipeType, {
      name: '54321',
      book_id: new ReferenceExpression(rootBook.elemID, rootBook),
    })
    const lastRecipe = new InstanceElement(
      'last',
      recipeType,
      {
        name: 'lastRecipe',
        book_id: new ReferenceExpression(anotherBook.elemID, anotherBook),
      },
      undefined,
      {
        _parent: [new ReferenceExpression(recipes[0].elemID, recipes[0])],
      },
    )
    const groups = [
      new InstanceElement('group1', groupType, {
        name: 'groupOne',
        fav_recipe: new ReferenceExpression(recipes[0].elemID, recipes[0]),
      }),
      new InstanceElement('group2', groupType, {
        name: 'groupTwo',
        fav_recipe: new ReferenceExpression(recipes[0].elemID, recipes[0]),
      }),
      new InstanceElement('group3', groupType, {
        name: 'groupThree',
        fav_recipe: new ReferenceExpression(recipes[1].elemID, recipes[1]),
      }),
    ]
    const folderType = new ObjectType({
      elemID: new ElemID(ADAPTER_NAME, 'folder'),
      fields: {
        name: { refType: BuiltinTypes.STRING },
      },
    })
    const folderOne = new InstanceElement(
      'folderOne',
      folderType,
      {
        name: 'Desktop',
      },
      undefined,
      {
        _parent: [new ReferenceExpression(lastRecipe.elemID, lastRecipe)],
      },
    )
    const folderTwo = new InstanceElement(
      'folderTwo',
      folderType,
      {
        name: 'Documents',
      },
      undefined,
      {
        _parent: [new ReferenceExpression(lastRecipe.elemID, lastRecipe)],
      },
    )
    const status = new InstanceElement('StAtUs', statusType, {
      name: 'StAtUs',
      fav_recipe: new ReferenceExpression(recipes[0].elemID.createNestedID('name'), recipes[0].value.name),
      template_with_refs: new TemplateExpression({
        parts: [
          'aaa',
          new ReferenceExpression(recipes[0].elemID, recipes[0]),
          new ReferenceExpression(recipes[1].elemID, recipes[1]),
          'bbb',
          new ReferenceExpression(recipes[0].elemID, recipes[0]),
          new ReferenceExpression(anotherBook.elemID, anotherBook),
          'ccc',
        ],
      }),
    })
    const emailsWithTemplates = [
      new InstanceElement('email1', emailType, {
        name: 'aaa',
        email: new TemplateExpression({ parts: ['username@', new ReferenceExpression(groups[0].elemID)] }),
      }),
      new InstanceElement('email2', emailType, {
        name: 'aaa',
        email: new TemplateExpression({
          parts: ['username@', new ReferenceExpression(groups[0].elemID.createNestedID('x', 'y'))],
        }),
      }),
    ]
    const noIdFieldsParent = new InstanceElement('no_idFieldsParent', bookType)
    const noIdFieldsWithParent = new InstanceElement('no_idFieldsWithParent', noIdFieldsType, {}, [], {
      [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(noIdFieldsParent.elemID, noIdFieldsParent),
    })
    const nestingParent = new InstanceElement('nestingParent', nestingParentType, {}, [
      'adapterName',
      'Records',
      'existing',
      'path',
      'to',
      'nestingParent',
      'nestingParent',
    ])
    const standaloneNestedField = new InstanceElement(
      'standaloneNestedField',
      standaloneNestedFieldType,
      { name: 'upstandingName' },
      ['will', 'change', 'to', 'hierarchy', 'nestingParent', 'standaloneNestedField'],
      { [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(nestingParent.elemID, nestingParent) },
    )
    const nestedNestedStandaloneField = new InstanceElement(
      'nestedNestedStandaloneField',
      standaloneDoubleNestedFieldType,
      { name: 'nestedNestedName' },
      ['will', 'change', 'to', 'hierarchy', 'nestingParent', 'standaloneNestedField', 'nestedNestedStandaloneField'],
      { [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(standaloneNestedField.elemID, standaloneNestedField) },
    )
    const notNestingParent = new InstanceElement('notNestingParent', notNestingParentType)
    const notStandaloneNestedField = new InstanceElement(
      'notStandaloneNestedField',
      notStandaloneNestedFieldType,
      { name: 'fishyName' },
      ['adapterName', 'Records', 'this', 'will', 'disappear!'],
      { [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(notNestingParent.elemID, notNestingParent) },
    )

    return [
      recipeType,
      bookType,
      ...recipes,
      anotherBook,
      rootBook,
      sameRecipeOne,
      sameRecipeTwo,
      lastRecipe,
      groupType,
      ...groups,
      folderType,
      folderOne,
      folderTwo,
      statusType,
      status,
      ...emailsWithTemplates,
      noIdFieldsParent,
      noIdFieldsWithParent,
      nestingParent,
      notNestingParent,
      standaloneNestedField,
      notStandaloneNestedField,
      nestedNestedStandaloneField,
    ]
  }
  const lowercaseName: NameMappingOptions = 'lowercase'
  const config = {
    apiDefinitions: {
      types: {
        book: {
          transformation: {
            idFields: ['id', '&parent_book_id'],
          },
        },
        recipe: {
          transformation: {
            idFields: ['name', '&book_id'],
            extendsParentId: true,
          },
        },
        group: {
          transformation: {
            idFields: ['name'],
          },
        },
        folder: {
          transformation: {
            idFields: ['name'],
            extendsParentId: true,
          },
        },
        status: {
          transformation: {
            idFields: ['name', '&fav_recipe'],
            nameMapping: lowercaseName,
          },
        },
        email: {
          transformation: {
            idFields: ['name', '&email'],
          },
        },
        noIdFields: {
          transformation: {
            idFields: [],
            extendsParentId: true,
          },
        },
        nestingParent: {
          transformation: {
            standaloneFields: [{ fieldName: 'standaloneNestedField' }],
            nestStandaloneInstances: true,
          },
        },
        notNestingParent: {
          transformation: {
            standaloneFields: [{ fieldName: 'notStandaloneNestedField' }],
            nestStandaloneInstances: false,
          },
        },
        standaloneNestedField: {
          transformation: {
            extendsParentId: true,
            nestStandaloneInstances: true,
            standaloneFields: [{ fieldName: 'standaloneDoubleNestedField' }],
          },
        },
        nestingParent__standaloneNestedField__standaloneDoubleNestedField: {
          transformation: {
            extendsParentId: true,
            nestStandaloneInstances: true,
          },
        },
        notStandaloneNestedField: {
          transformation: {
            extendsParentId: true,
          },
        },
      },
      typeDefaults: {
        transformation: {
          idFields: ['id'],
        },
      },
      supportedTypes: {},
    },
  }
  let elements: Element[]

  describe('referencedInstanceNames filter', () => {
    type FilterType = FilterWith<'onFetch'>
    let filter: FilterType

    beforeEach(async () => {
      jest.clearAllMocks()
      filter = referencedInstanceNamesFilterCreatorDeprecated()({
        client: {} as unknown,
        paginator: undefined as unknown as Paginator,
        config,
        fetchQuery: createMockQuery(),
      }) as FilterType
    })
    it('should rename the elements correctly when the filter is called', async () => {
      elements = generateElements()
      await filter.onFetch(elements)
      expect(
        elements
          .filter(isInstanceElement)
          .map(e => e.elemID.getFullName())
          .sort(),
      ).toEqual([
        'myAdapter.book.instance.123_ROOT',
        'myAdapter.book.instance.456_123_ROOT',
        'myAdapter.book.instance.no_idFieldsParent',
        'myAdapter.email.instance.aaa_username_group1@um',
        'myAdapter.email.instance.aaa_username_group1_x_y@umvv',
        'myAdapter.folder.instance.recipe123_123_ROOT__lastRecipe_456_123_ROOT__Desktop',
        'myAdapter.folder.instance.recipe123_123_ROOT__lastRecipe_456_123_ROOT__Documents',
        'myAdapter.group.instance.group1',
        'myAdapter.group.instance.group2',
        'myAdapter.group.instance.group3',
        'myAdapter.nestingParent.instance.nestingParent',
        'myAdapter.nestingParent__standaloneNestedField__standaloneDoubleNestedField.instance.nestingParent__standaloneNestedField__nestedNestedStandaloneField',
        'myAdapter.noIdFields.instance.no_idFieldsParent',
        'myAdapter.notNestingParent.instance.notNestingParent',
        'myAdapter.notStandaloneNestedField.instance.notNestingParent__notStandaloneNestedField',
        'myAdapter.recipe.instance.recipe123_123_ROOT',
        'myAdapter.recipe.instance.recipe123_123_ROOT__lastRecipe_456_123_ROOT',
        'myAdapter.recipe.instance.recipe456_456_123_ROOT',
        'myAdapter.recipe.instance.sameRecipe',
        'myAdapter.recipe.instance.sameRecipe',
        'myAdapter.standaloneNestedField.instance.nestingParent__standaloneNestedField',
        'myAdapter.status.instance.status_recipe123_123_root_name@uuuv',
      ])
    })
  })

  describe('addReferencesToInstanceNames function', () => {
    const transformationDefaultConfig = config.apiDefinitions.typeDefaults.transformation
    const transformationConfigByType = {
      recipe: config.apiDefinitions.types.recipe.transformation,
      book: config.apiDefinitions.types.book.transformation,
      group: config.apiDefinitions.types.group.transformation,
      folder: config.apiDefinitions.types.folder.transformation,
      nestingParent: config.apiDefinitions.types.nestingParent.transformation,
      notNestingParent: config.apiDefinitions.types.notNestingParent.transformation,
      standaloneNestedField: config.apiDefinitions.types.standaloneNestedField.transformation,
      nestingParent__standaloneNestedField__standaloneDoubleNestedField:
        config.apiDefinitions.types.nestingParent__standaloneNestedField__standaloneDoubleNestedField.transformation,
      notStandaloneNestedField: config.apiDefinitions.types.notStandaloneNestedField.transformation,
    }

    it('should change name and references correctly', async () => {
      elements = generateElements().filter(e => !['status', 'email'].includes(e.elemID.typeName))
      const result = await addReferencesToInstanceNames(
        elements.slice(0, 6).concat(elements.slice(8)),
        transformationConfigByType,
        transformationDefaultConfig,
      )
      const sortedResult = result
        .filter(isInstanceElement)
        .map(i => i.elemID.getFullName())
        .sort()
      expect(result.length).toEqual(21)
      expect(sortedResult).toEqual([
        'myAdapter.book.instance.123_ROOT',
        'myAdapter.book.instance.456_123_ROOT',
        'myAdapter.book.instance.no_idFieldsParent',
        'myAdapter.folder.instance.recipe123_123_ROOT__lastRecipe_456_123_ROOT__Desktop',
        'myAdapter.folder.instance.recipe123_123_ROOT__lastRecipe_456_123_ROOT__Documents',
        'myAdapter.group.instance.group1',
        'myAdapter.group.instance.group2',
        'myAdapter.group.instance.group3',
        'myAdapter.nestingParent.instance.nestingParent',
        'myAdapter.nestingParent__standaloneNestedField__standaloneDoubleNestedField.instance.nestingParent__standaloneNestedField__nestedNestedStandaloneField',
        'myAdapter.noIdFields.instance.no_idFieldsWithParent',
        'myAdapter.notNestingParent.instance.notNestingParent',
        'myAdapter.notStandaloneNestedField.instance.notNestingParent__notStandaloneNestedField',
        'myAdapter.recipe.instance.recipe123_123_ROOT',
        'myAdapter.recipe.instance.recipe123_123_ROOT__lastRecipe_456_123_ROOT',
        'myAdapter.recipe.instance.recipe456_456_123_ROOT',
        'myAdapter.standaloneNestedField.instance.nestingParent__standaloneNestedField',
      ])
    })
    it('should update references to the renamed instance correctly', async () => {
      elements = generateElements()
      const result = await addReferencesToInstanceNames(
        elements,
        transformationConfigByType,
        transformationDefaultConfig,
      )
      const updatedRecipe = result.filter(isInstanceElement).find(inst => inst.elemID.name === 'recipe456_456_123_ROOT')
      const updatedGroup = result.filter(isInstanceElement).find(inst => inst.elemID.name === 'group3')
      const updatedReference = updatedGroup?.value.fav_recipe
      expect(updatedReference).toBeInstanceOf(ReferenceExpression)
      expect((updatedReference as ReferenceExpression).elemID).toEqual(updatedRecipe?.elemID)
      // verify reference value was updates as well
      expect((updatedReference as ReferenceExpression).value.value.book_id.elemID).toEqual(
        updatedRecipe?.value.book_id.elemID,
      )
    })
    it('should change references correctly inside template expressions', async () => {
      elements = generateElements()
      const result = await addReferencesToInstanceNames(
        elements,
        transformationConfigByType,
        transformationDefaultConfig,
      )
      const updatedStatus = result.filter(isInstanceElement).find(inst => inst.elemID.typeName === 'status')
      expect(updatedStatus).toBeInstanceOf(InstanceElement)
      expect(updatedStatus?.value.template_with_refs).toBeInstanceOf(TemplateExpression)
      expect(
        (updatedStatus?.value.template_with_refs.parts ?? []).map((val: TemplatePart) =>
          isReferenceExpression(val) ? val.elemID.getFullName() : val,
        ),
      ).toEqual([
        'aaa',
        'myAdapter.recipe.instance.recipe123_123_ROOT',
        'myAdapter.recipe.instance.recipe456_456_123_ROOT',
        'bbb',
        'myAdapter.recipe.instance.recipe123_123_ROOT',
        'myAdapter.book.instance.456_123_ROOT',
        'ccc',
      ])
    })
    it('should not change name for duplicate elemIDs', async () => {
      elements = generateElements().filter(e => !['status', 'email', 'group'].includes(e.elemID.typeName))
      const result = await addReferencesToInstanceNames(
        elements,
        transformationConfigByType,
        transformationDefaultConfig,
      )
      expect(result.length).toEqual(19)
      expect(result.map(e => e.elemID.getFullName()).sort()).toEqual([
        'myAdapter.book',
        'myAdapter.book.instance.123_ROOT',
        'myAdapter.book.instance.456_123_ROOT',
        'myAdapter.book.instance.no_idFieldsParent',
        'myAdapter.folder',
        'myAdapter.folder.instance.recipe123_123_ROOT__lastRecipe_456_123_ROOT__Desktop',
        'myAdapter.folder.instance.recipe123_123_ROOT__lastRecipe_456_123_ROOT__Documents',
        'myAdapter.nestingParent.instance.nestingParent',
        'myAdapter.nestingParent__standaloneNestedField__standaloneDoubleNestedField.instance.nestingParent__standaloneNestedField__nestedNestedStandaloneField',
        'myAdapter.noIdFields.instance.no_idFieldsWithParent',
        'myAdapter.notNestingParent.instance.notNestingParent',
        'myAdapter.notStandaloneNestedField.instance.notNestingParent__notStandaloneNestedField',
        'myAdapter.recipe',
        'myAdapter.recipe.instance.recipe123_123_ROOT',
        'myAdapter.recipe.instance.recipe123_123_ROOT__lastRecipe_456_123_ROOT',
        'myAdapter.recipe.instance.recipe456_456_123_ROOT',
        'myAdapter.recipe.instance.sameRecipe',
        'myAdapter.recipe.instance.sameRecipe',
        'myAdapter.standaloneNestedField.instance.nestingParent__standaloneNestedField',
      ])
    })
    it('should preserve the path of a nestStandaloneInstances instance and update others', async () => {
      elements = generateElements()
      const result = await addReferencesToInstanceNames(
        elements,
        transformationConfigByType,
        transformationDefaultConfig,
      )
      const updatedStandaloneNestedField = result
        .filter(isInstanceElement)
        .find(inst => inst.elemID.typeName === 'standaloneNestedField')
      // The double last couple is because the type has it's own standalone field
      expect(updatedStandaloneNestedField?.path).toEqual([
        'myAdapter',
        'Records',
        'existing',
        'path',
        'to',
        'nestingParent',
        'standaloneNestedField',
        'nestingParent__standaloneNestedField',
        'nestingParent__standaloneNestedField',
      ])
      const updatedNotStandaloneNestedField = result
        .filter(isInstanceElement)
        .find(inst => inst.elemID.typeName === 'notStandaloneNestedField')
      expect(updatedNotStandaloneNestedField?.path).toEqual([
        'myAdapter',
        'Records',
        'notStandaloneNestedField',
        'notNestingParent__notStandaloneNestedField',
      ])
    })
    it('should update the path of a double nested instance', async () => {
      elements = generateElements()
      const result = await addReferencesToInstanceNames(
        elements,
        transformationConfigByType,
        transformationDefaultConfig,
      )
      const updatedNestedNestedStandaloneField = result
        .filter(isInstanceElement)
        .find(
          inst => inst.elemID.typeName === 'nestingParent__standaloneNestedField__standaloneDoubleNestedField',
        )?.path
      expect(updatedNestedNestedStandaloneField).toEqual([
        'myAdapter',
        'Records',
        'existing',
        'path',
        'to',
        'nestingParent',
        'standaloneNestedField',
        'nestingParent__standaloneNestedField',
        'standaloneDoubleNestedField',
        'nestingParent__standaloneNestedField__nestedNestedStandaloneField',
      ])
    })
    it('should create the correct reference map', () => {
      elements = generateElements()
      const bookOrRecipeIns = elements
        .filter(isInstanceElement)
        .filter(e => e.elemID.typeName === 'book' || e.elemID.typeName === 'recipe')
        .map(i => i.elemID.getFullName())
      const allIns = elements.filter(isInstanceElement)
      const res = createReferenceIndex(allIns, new Set(bookOrRecipeIns))
      expect(_.mapValues(res, val => val.length)).toEqual({
        'myAdapter.book.instance.rootBook': 4,
        'myAdapter.book.instance.book': 3,
        'myAdapter.book.instance.no_idFieldsParent': 1,
        'myAdapter.recipe.instance.recipe123': 6,
        'myAdapter.recipe.instance.last': 2,
        'myAdapter.recipe.instance.recipe456': 2,
      })
    })
    it('should not have different results on the second fetch', async () => {
      elements = generateElements()
      const result = await addReferencesToInstanceNames(
        elements,
        transformationConfigByType,
        transformationDefaultConfig,
      )
      const result2 = await addReferencesToInstanceNames(
        result,
        transformationConfigByType,
        transformationDefaultConfig,
      )
      expect(result).toEqual(result2)
    })
    it('should ignore null values on idFields', async () => {
      elements = generateElements()
      const parentRecipe = elements.filter(e => e.elemID.name === 'recipe123')
      const recipeType = elements.find(e => isObjectType(e) && e.elemID.typeName === 'recipe')
      const recipeWithNullBook = new InstanceElement(
        'recipeWithNullBook',
        recipeType as ObjectType,
        {
          name: 'recipeWithNullBook',
          something: 'something',
        },
        undefined,
        {
          _parent: [new ReferenceExpression(parentRecipe[0].elemID, parentRecipe[0])],
        },
      )
      const res = await addReferencesToInstanceNames(
        elements.concat(recipeWithNullBook),
        transformationConfigByType,
        transformationDefaultConfig,
      )
      const recipeWithNullBookRes = res
        .filter(isInstanceElement)
        .find(e => e.value.name === 'recipeWithNullBook') as InstanceElement
      expect(recipeWithNullBookRes.elemID.getFullName()).toEqual(
        'myAdapter.recipe.instance.recipe123_123_ROOT__recipeWithNullBook',
      )
    })
  })
})
