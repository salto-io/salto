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
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { FilterWith } from '../../src/filter_utils'
import { createMockQuery } from '../../src/fetch/query'
import { ApiDefinitions, NameMappingOptions, queryWithDefault } from '../../src/definitions'
import {
  referencedInstanceNamesFilterCreator,
  createReferenceIndex,
  addReferencesToInstanceNames,
} from '../../src/filters/referenced_instance_names'

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
      elemID: new ElemID(ADAPTER_NAME, 'nestingParent_standaloneNestedField_standaloneDoubleNestedField'),
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
    const differentMappingFunctionType = new ObjectType({
      elemID: new ElemID(ADAPTER_NAME, 'differentMappingFunction'),
      fields: {
        first: { refType: BuiltinTypes.STRING },
        second: { refType: BuiltinTypes.STRING },
        third: { refType: BuiltinTypes.STRING },
      },
    })
    const complicatedPathType = new ObjectType({
      elemID: new ElemID(ADAPTER_NAME, 'complicatedPath'),
      fields: {
        id: { refType: BuiltinTypes.NUMBER },
        first: { refType: BuiltinTypes.STRING },
        second: { refType: BuiltinTypes.STRING },
        third: { refType: BuiltinTypes.STRING },
        bookId: { refType: BuiltinTypes.NUMBER },
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
      undefined,
      { [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(nestingParent.elemID, nestingParent) },
    )
    const nestedNestedStandaloneField = new InstanceElement(
      'nestedNestedStandaloneField',
      standaloneDoubleNestedFieldType,
      { name: 'nestedNestedName' },
      undefined,
      { [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(standaloneNestedField.elemID, standaloneNestedField) },
    )
    const notNestingParent = new InstanceElement('notNestingParent', notNestingParentType)
    const notStandaloneNestedField = new InstanceElement(
      'notStandaloneNestedField',
      notStandaloneNestedFieldType,
      { name: 'fishyName' },
      undefined,
      { [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(notNestingParent.elemID, notNestingParent) },
    )

    const differentMappingFunctionInstance = new InstanceElement(
      'differentMappingFunction',
      differentMappingFunctionType,
      {
        first: 'fiRst',
        second: 'seCond',
        third: 'thIrd',
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(nestingParent.elemID, nestingParent),
      },
    )

    const complicatedPathInstance = new InstanceElement(
      'complicatedPath',
      complicatedPathType,
      {
        id: 321,
        first: 'fiRst',
        second: 'seCond',
        third: 'thIrd',
        bookId: new ReferenceExpression(rootBook.elemID, rootBook),
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(nestingParent.elemID, nestingParent),
      },
    )

    return [
      recipeType,
      bookType,
      groupType,
      statusType,
      emailType,
      noIdFieldsType,
      nestingParentType,
      notNestingParentType,
      standaloneNestedFieldType,
      standaloneDoubleNestedFieldType,
      notStandaloneNestedFieldType,
      differentMappingFunctionType,
      ...recipes,
      anotherBook,
      rootBook,
      sameRecipeOne,
      sameRecipeTwo,
      lastRecipe,
      ...groups,
      folderOne,
      folderTwo,
      status,
      ...emailsWithTemplates,
      noIdFieldsParent,
      noIdFieldsWithParent,
      nestingParent,
      notNestingParent,
      standaloneNestedField,
      notStandaloneNestedField,
      nestedNestedStandaloneField,
      differentMappingFunctionInstance,
      complicatedPathType,
      complicatedPathInstance,
    ]
  }
  const lowercaseName: NameMappingOptions = 'lowercase'
  const uppercaseName: NameMappingOptions = 'uppercase'
  const definitions = {
    fetch: {
      instances: {
        default: {
          element: {
            topLevel: {
              isTopLevel: true,
              elemID: {
                parts: [{ fieldName: 'id' }],
              },
            },
          },
        },
        customizations: {
          book: {
            element: {
              topLevel: {
                isTopLevel: true,
                elemID: {
                  parts: [
                    {
                      fieldName: 'id',
                    },
                    {
                      fieldName: 'parent_book_id',
                      isReference: true,
                    },
                  ],
                },
              },
            },
          },
          recipe: {
            element: {
              topLevel: {
                isTopLevel: true,
                elemID: {
                  parts: [
                    {
                      fieldName: 'name',
                    },
                    {
                      fieldName: 'book_id',
                      isReference: true,
                    },
                  ],
                  extendsParent: true,
                },
              },
            },
          },
          group: {
            element: {
              topLevel: {
                isTopLevel: true,
                elemID: {
                  parts: [
                    {
                      fieldName: 'name',
                    },
                  ],
                },
              },
            },
          },
          folder: {
            element: {
              topLevel: {
                isTopLevel: true,
                elemID: {
                  parts: [
                    {
                      fieldName: 'name',
                    },
                  ],
                  extendsParent: true,
                },
              },
            },
          },
          status: {
            element: {
              topLevel: {
                isTopLevel: true,
                elemID: {
                  parts: [
                    {
                      fieldName: 'name',
                      mapping: lowercaseName,
                    },
                    {
                      fieldName: 'fav_recipe',
                      mapping: lowercaseName,
                      isReference: true,
                    },
                  ],
                },
              },
            },
          },
          email: {
            element: {
              topLevel: {
                isTopLevel: true,
                elemID: {
                  parts: [
                    {
                      fieldName: 'name',
                    },
                    {
                      fieldName: 'email',
                      isReference: true,
                    },
                  ],
                },
              },
            },
          },
          noIdFields: {
            element: {
              topLevel: {
                isTopLevel: true,
                elemID: {
                  extendsParent: true,
                  parts: [],
                },
              },
            },
          },
          nestingParent: {
            element: {
              fieldCustomizations: {
                standaloneNestedFieldButWithDifferentName: {
                  standalone: {
                    typeName: 'standaloneNestedField',
                    nestPathUnderParent: true,
                  },
                },
                differentMappingFunction: {
                  standalone: {
                    typeName: 'differentMappingFunction',
                    nestPathUnderParent: true,
                  },
                },
                complicatedPath: {
                  standalone: {
                    typeName: 'complicatedPath',
                    nestPathUnderParent: true,
                  },
                },
              },
            },
          },
          notNestingParent: {
            element: {
              fieldCustomizations: {
                notStandaloneNestedField: {
                  standalone: {
                    typeName: 'notStandaloneNestedField',
                    nestPathUnderParent: false,
                  },
                },
              },
            },
          },
          standaloneNestedField: {
            element: {
              topLevel: {
                isTopLevel: true,
                elemID: {
                  extendsParent: true,
                  parts: [{ fieldName: 'name' }],
                },
              },
              fieldCustomizations: {
                standaloneDoubleNestedField: {
                  standalone: {
                    typeName: 'standaloneDoubleNestedField',
                    nestPathUnderParent: true,
                  },
                },
                nestingParent_standaloneNestedField_standaloneDoubleNestedField: {
                  standalone: {
                    typeName: 'nestingParent_standaloneNestedField_standaloneDoubleNestedField',
                    nestPathUnderParent: true,
                  },
                },
              },
            },
          },
          nestingParent_standaloneNestedField_standaloneDoubleNestedField: {
            element: {
              topLevel: {
                isTopLevel: true,
                elemID: {
                  extendsParent: true,
                  parts: [{ fieldName: 'name' }],
                },
              },
            },
          },
          notStandaloneNestedField: {
            element: {
              topLevel: {
                isTopLevel: true,
                elemID: {
                  extendsParent: true,
                  parts: [{ fieldName: 'name' }],
                },
              },
            },
          },
          differentMappingFunction: {
            element: {
              topLevel: {
                isTopLevel: true,
                elemID: {
                  extendsParent: true,
                  parts: [
                    {
                      fieldName: 'first',
                      mapping: lowercaseName,
                    },
                    {
                      fieldName: 'second',
                      mapping: uppercaseName,
                    },
                    {
                      fieldName: 'third',
                      mapping: lowercaseName,
                    },
                  ],
                },
              },
            },
          },
          complicatedPath: {
            element: {
              topLevel: {
                isTopLevel: true,
                elemID: {
                  parts: [{ fieldName: 'bookId', isReference: true }],
                },
                path: {
                  pathParts: [
                    {
                      parts: [
                        {
                          fieldName: 'id',
                        },
                      ],
                    },
                    {
                      parts: [
                        {
                          fieldName: 'first',
                          mapping: lowercaseName,
                        },
                      ],
                    },
                    {
                      parts: [
                        {
                          fieldName: 'second',
                          mapping: uppercaseName,
                        },
                        {
                          fieldName: 'third',
                        },
                      ],
                    },
                    {
                      parts: [
                        {
                          fieldName: 'bookId',
                          mapping: uppercaseName,
                        },
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
  } as unknown as ApiDefinitions
  let elements: Element[]

  describe('referencedInstanceNames filter', () => {
    type FilterType = FilterWith<'onFetch'>
    let filter: FilterType

    beforeEach(async () => {
      jest.clearAllMocks()
      filter = referencedInstanceNamesFilterCreator()({
        elementSource: buildElementsSourceFromElements([]),
        definitions,
        config: {},
        fetchQuery: createMockQuery(),
        sharedContext: {},
      }) as FilterType
      elements = generateElements()
      await filter.onFetch(elements)
    })
    it('should rename the elements correctly when the filter is called', () => {
      expect(
        elements
          .filter(isInstanceElement)
          .map(e => e.elemID.getFullName())
          .sort(),
      ).toEqual([
        'myAdapter.book.instance.123_ROOT',
        'myAdapter.book.instance.456_123_ROOT',
        'myAdapter.book.instance.no_idFieldsParent',
        'myAdapter.complicatedPath.instance.123_ROOT',
        'myAdapter.differentMappingFunction.instance.nestingParent__first_SECOND_third',
        'myAdapter.email.instance.aaa_username_group1@um',
        'myAdapter.email.instance.aaa_username_group1_x_y@umvv',
        'myAdapter.folder.instance.recipe123_123_ROOT__lastRecipe_456_123_ROOT__Desktop',
        'myAdapter.folder.instance.recipe123_123_ROOT__lastRecipe_456_123_ROOT__Documents',
        'myAdapter.group.instance.group1',
        'myAdapter.group.instance.group2',
        'myAdapter.group.instance.group3',
        'myAdapter.nestingParent.instance.nestingParent',
        'myAdapter.nestingParent_standaloneNestedField_standaloneDoubleNestedField.instance.nestingParent__upstandingName__nestedNestedName',
        'myAdapter.noIdFields.instance.no_idFieldsParent',
        'myAdapter.notNestingParent.instance.notNestingParent',
        'myAdapter.notStandaloneNestedField.instance.notNestingParent__fishyName',
        'myAdapter.recipe.instance.recipe123_123_ROOT',
        'myAdapter.recipe.instance.recipe123_123_ROOT__lastRecipe_456_123_ROOT',
        'myAdapter.recipe.instance.recipe456_456_123_ROOT',
        'myAdapter.recipe.instance.sameRecipe',
        'myAdapter.recipe.instance.sameRecipe',
        'myAdapter.standaloneNestedField.instance.nestingParent__upstandingName',
        'myAdapter.status.instance.status_recipe123_123_root_name@uuuv',
      ])
    })
    it('should calculate path correctly when the filter is called', () => {
      expect(
        elements
          .filter(isInstanceElement)
          .map(e => e.path)
          .filter(Array.isArray)
          .map(path => path.join('/'))
          .sort(),
      ).toEqual([
        'adapterName/Records/existing/path/to/nestingParent/nestingParent',
        'myAdapter/Records/book/123_ROOT',
        'myAdapter/Records/book/456_123_ROOT',
        'myAdapter/Records/book/no_idFieldsParent',
        'myAdapter/Records/email/aaa_username_group1',
        'myAdapter/Records/email/aaa_username_group1_x_y',
        'myAdapter/Records/existing/path/to/nestingParent/complicatedPath/321/first/SECOND_thIrd/123_ROOT',
        'myAdapter/Records/existing/path/to/nestingParent/differentMappingFunction/nestingParent__first_SECOND_third',
        'myAdapter/Records/existing/path/to/nestingParent/standaloneNestedFieldButWithDifferentName/nestingParent__upstandingName/nestingParent__upstandingName',
        'myAdapter/Records/existing/path/to/nestingParent/standaloneNestedFieldButWithDifferentName/nestingParent__upstandingName/nestingParent_standaloneNestedField_standaloneDoubleNestedField/nestingParent__upstandingName__nestedNestedName',
        'myAdapter/Records/folder/recipe123_123_ROOT__lastRecipe_456_123_ROOT__Desktop',
        'myAdapter/Records/folder/recipe123_123_ROOT__lastRecipe_456_123_ROOT__Documents',
        'myAdapter/Records/noIdFields/no_idFieldsParent',
        'myAdapter/Records/notStandaloneNestedField/notNestingParent__fishyName',
        'myAdapter/Records/recipe/recipe123_123_ROOT',
        'myAdapter/Records/recipe/recipe123_123_ROOT__lastRecipe_456_123_ROOT',
        'myAdapter/Records/recipe/recipe456_456_123_ROOT',
        'myAdapter/Records/status/status_recipe123_123_root_name',
      ])
    })
  })

  describe('addReferencesToInstanceNames function', () => {
    beforeEach(() => {
      elements = generateElements()
    })
    const defQuery = queryWithDefault(definitions.fetch?.instances ?? { customizations: {} })
    it('should change name and references correctly', async () => {
      const result = await addReferencesToInstanceNames(elements, defQuery)
      const sortedResult = result
        .filter(isInstanceElement)
        .map(i => i.elemID.getFullName())
        .sort()
      expect(result.length).toEqual(37)
      expect(sortedResult).toEqual([
        'myAdapter.book.instance.123_ROOT',
        'myAdapter.book.instance.456_123_ROOT',
        'myAdapter.book.instance.no_idFieldsParent',
        'myAdapter.complicatedPath.instance.123_ROOT',
        'myAdapter.differentMappingFunction.instance.nestingParent__first_SECOND_third',
        'myAdapter.email.instance.aaa_username_group1@um',
        'myAdapter.email.instance.aaa_username_group1_x_y@umvv',
        'myAdapter.folder.instance.recipe123_123_ROOT__lastRecipe_456_123_ROOT__Desktop',
        'myAdapter.folder.instance.recipe123_123_ROOT__lastRecipe_456_123_ROOT__Documents',
        'myAdapter.group.instance.group1',
        'myAdapter.group.instance.group2',
        'myAdapter.group.instance.group3',
        'myAdapter.nestingParent.instance.nestingParent',
        'myAdapter.nestingParent_standaloneNestedField_standaloneDoubleNestedField.instance.nestingParent__upstandingName__nestedNestedName',
        'myAdapter.noIdFields.instance.no_idFieldsParent',
        'myAdapter.notNestingParent.instance.notNestingParent',
        'myAdapter.notStandaloneNestedField.instance.notNestingParent__fishyName',
        'myAdapter.recipe.instance.recipe123_123_ROOT',
        'myAdapter.recipe.instance.recipe123_123_ROOT__lastRecipe_456_123_ROOT',
        'myAdapter.recipe.instance.recipe456_456_123_ROOT',
        'myAdapter.recipe.instance.sameRecipe',
        'myAdapter.recipe.instance.sameRecipe',
        'myAdapter.standaloneNestedField.instance.nestingParent__upstandingName',
        'myAdapter.status.instance.status_recipe123_123_root_name@uuuv',
      ])
    })
    it('should update references to the renamed instance correctly', async () => {
      const result = await addReferencesToInstanceNames(elements, defQuery)
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
      const result = await addReferencesToInstanceNames(elements, defQuery)
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
      const result = (await addReferencesToInstanceNames(elements, defQuery)).filter(isInstanceElement)
      expect(result.length).toEqual(24)
      expect(result.map(e => e.elemID.getFullName()).sort()).toEqual([
        'myAdapter.book.instance.123_ROOT',
        'myAdapter.book.instance.456_123_ROOT',
        'myAdapter.book.instance.no_idFieldsParent',
        'myAdapter.complicatedPath.instance.123_ROOT',
        'myAdapter.differentMappingFunction.instance.nestingParent__first_SECOND_third',
        'myAdapter.email.instance.aaa_username_group1@um',
        'myAdapter.email.instance.aaa_username_group1_x_y@umvv',
        'myAdapter.folder.instance.recipe123_123_ROOT__lastRecipe_456_123_ROOT__Desktop',
        'myAdapter.folder.instance.recipe123_123_ROOT__lastRecipe_456_123_ROOT__Documents',
        'myAdapter.group.instance.group1',
        'myAdapter.group.instance.group2',
        'myAdapter.group.instance.group3',
        'myAdapter.nestingParent.instance.nestingParent',
        'myAdapter.nestingParent_standaloneNestedField_standaloneDoubleNestedField.instance.nestingParent__upstandingName__nestedNestedName',
        'myAdapter.noIdFields.instance.no_idFieldsParent',
        'myAdapter.notNestingParent.instance.notNestingParent',
        'myAdapter.notStandaloneNestedField.instance.notNestingParent__fishyName',
        'myAdapter.recipe.instance.recipe123_123_ROOT',
        'myAdapter.recipe.instance.recipe123_123_ROOT__lastRecipe_456_123_ROOT',
        'myAdapter.recipe.instance.recipe456_456_123_ROOT',
        'myAdapter.recipe.instance.sameRecipe',
        'myAdapter.recipe.instance.sameRecipe',
        'myAdapter.standaloneNestedField.instance.nestingParent__upstandingName',
        'myAdapter.status.instance.status_recipe123_123_root_name@uuuv',
      ])
    })
    it('should update the path of a double nested instance', async () => {
      const result = await addReferencesToInstanceNames(elements, defQuery)
      const updatedNestedNestedStandaloneFieldPath = result
        .filter(isInstanceElement)
        .find(inst => inst.elemID.typeName === 'nestingParent_standaloneNestedField_standaloneDoubleNestedField')?.path
      expect(updatedNestedNestedStandaloneFieldPath).toEqual([
        'myAdapter',
        'Records',
        'existing',
        'path',
        'to',
        'nestingParent',
        'standaloneNestedFieldButWithDifferentName',
        'nestingParent__upstandingName',
        'nestingParent_standaloneNestedField_standaloneDoubleNestedField',
        'nestingParent__upstandingName__nestedNestedName',
      ])
    })
    it('should create the correct reference map', () => {
      const bookOrRecipeIns = elements
        .filter(isInstanceElement)
        .filter(e => e.elemID.typeName === 'book' || e.elemID.typeName === 'recipe')
        .map(i => i.elemID.getFullName())
      const allIns = elements.filter(isInstanceElement)
      const res = createReferenceIndex(allIns, new Set(bookOrRecipeIns))
      expect(_.mapValues(res, val => val.length)).toEqual({
        'myAdapter.book.instance.rootBook': 5,
        'myAdapter.book.instance.book': 3,
        'myAdapter.book.instance.no_idFieldsParent': 1,
        'myAdapter.recipe.instance.recipe123': 6,
        'myAdapter.recipe.instance.last': 2,
        'myAdapter.recipe.instance.recipe456': 2,
      })
    })
    it('should not have different results on the second fetch', async () => {
      const result = await addReferencesToInstanceNames(elements, defQuery)
      const result2 = await addReferencesToInstanceNames(result, defQuery)
      expect(result).toEqual(result2)
    })
    it('should ignore null values on idFields', async () => {
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
      const res = await addReferencesToInstanceNames(elements.concat(recipeWithNullBook), defQuery)
      const recipeWithNullBookRes = res
        .filter(isInstanceElement)
        .find(e => e.value.name === 'recipeWithNullBook') as InstanceElement
      expect(recipeWithNullBookRes.elemID.getFullName()).toEqual(
        'myAdapter.recipe.instance.recipe123_123_ROOT__recipeWithNullBook',
      )
    })
  })
})
