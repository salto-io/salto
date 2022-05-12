/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { ElemID, InstanceElement, ObjectType, Element, BuiltinTypes, CORE_ANNOTATIONS, ReferenceExpression, isInstanceElement } from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils, elements as elementUtils } from '@salto-io/adapter-components'
import { getParents } from '@salto-io/adapter-utils'
import filterCreator from '../../src/filters/fix_multienv_ids'
import WorkatoClient from '../../src/client/client'
import { paginate } from '../../src/client/pagination'
import { DEFAULT_TYPES, DEFAULT_ID_FIELDS, SUPPORTED_TYPES, DEFAULT_CONFIG, FETCH_CONFIG } from '../../src/config'
import { WORKATO } from '../../src/constants'

describe('Fix multienv ids filter', () => {
  let client: WorkatoClient
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType

  beforeAll(() => {
    client = new WorkatoClient({
      credentials: { username: 'a', token: 'b' },
    })
    filter = filterCreator({
      client,
      paginator: clientUtils.createPaginator({
        client,
        paginationFuncCreator: paginate,
      }),
      config: {
        fetch: DEFAULT_CONFIG[FETCH_CONFIG],
        apiDefinitions: {
          typeDefaults: {
            transformation: {
              idFields: DEFAULT_ID_FIELDS,
            },
          },
          types: _.defaultsDeep(
            {},
            {
              recipe: {
                transformation: {
                  idFields: ['name', '&folder_id'],
                },
              },
              folder: {
                transformation: {
                  idFields: ['name', '&parent_id'],
                },
              },
            },
            DEFAULT_TYPES,
          ),
          supportedTypes: SUPPORTED_TYPES,
        },
      },
      fetchQuery: elementUtils.query.createMockQuery(),
    }) as FilterType
  })

  const recipeType = new ObjectType({
    elemID: new ElemID(WORKATO, 'recipe'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER, annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true } },
      folder_id: { refType: BuiltinTypes.NUMBER },
      code: { refType: BuiltinTypes.UNKNOWN },
    },
  })
  const recipeCodeType = new ObjectType({
    elemID: new ElemID(WORKATO, 'recipe__code'),
  })
  const folderType = new ObjectType({
    elemID: new ElemID(WORKATO, 'folder'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER, annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true } },
      // eslint-disable-next-line camelcase
      parent_id: { refType: BuiltinTypes.NUMBER },
    },
  })

  const generateElements = (
  ): Element[] => ([
    recipeType,
    new InstanceElement(
      'recipe123',
      recipeType,
      {
        name: 'recipe123',
        id: 123,
        folder_id: 11,
        code: new ReferenceExpression(new ElemID('workato', 'recipe__code', 'instance', 'recipe123_')),
      },
      ['Records', 'recipe', 'recipe123'],
    ),
    recipeCodeType,
    new InstanceElement(
      'recipe123_',
      recipeCodeType,
      { id: 123 },
      ['Records', 'recipe__code', 'recipe123_'],
      { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(new ElemID('workato', 'recipe', 'instance', 'recipe123'))] },
    ),
    folderType,
    new InstanceElement('Root', folderType, { name: 'Root', id: 55 }), // root folder
    new InstanceElement('folder11_55', folderType, { name: 'folder11', id: 11, parent_id: 55 }),
    new InstanceElement('folder22_11', folderType, { name: 'folder22', id: 22, parent_id: 11 }),
    new InstanceElement('folder33_55', folderType, { name: 'folder33', id: 33, parent_id: 55 }),
  ])

  describe('on fetch', () => {
    it('should update all ids when configuration and instances are as expected', async () => {
      const elements = generateElements()
      const lengthBefore = elements.length
      await filter.onFetch(elements)
      expect(elements.length).toEqual(lengthBefore)
      const instances = elements.filter(isInstanceElement)
      expect(instances.map(e => e.elemID.getFullName())).toEqual([
        'workato.folder.instance.Root',
        'workato.folder.instance.folder11_Root',
        'workato.folder.instance.folder33_Root',
        'workato.folder.instance.folder22_folder11_Root',
        'workato.recipe.instance.recipe123_folder11_Root',
        'workato.recipe__code.instance.recipe123_folder11_Root_',
      ])
      expect(instances[4].value.code).toBeInstanceOf(ReferenceExpression)
      expect(instances[4].value.code.elemID.getFullName()).toEqual('workato.recipe__code.instance.recipe123_folder11_Root_')
      expect(getParents(instances[5])[0]).toBeInstanceOf(ReferenceExpression)
      expect(getParents(instances[5])[0].elemID.getFullName()).toEqual('workato.recipe.instance.recipe123_folder11_Root')
    })
    it('should update recipes but not update folder ids if root folder is not found', async () => {
      const elements = generateElements().filter(e => e.elemID.name !== 'Root')
      const lengthBefore = elements.length
      await filter.onFetch(elements)
      expect(elements.length).toEqual(lengthBefore)
      const instances = elements.filter(isInstanceElement)
      expect(instances.map(e => e.elemID.getFullName())).toEqual([
        'workato.folder.instance.folder11_55',
        'workato.folder.instance.folder22_11',
        'workato.folder.instance.folder33_55',
        'workato.recipe.instance.recipe123_folder11_55',
        'workato.recipe__code.instance.recipe123_folder11_55_',
      ])
      expect(instances[3].value.code).toBeInstanceOf(ReferenceExpression)
      expect(instances[3].value.code.elemID.getFullName()).toEqual('workato.recipe__code.instance.recipe123_folder11_55_')
      expect(getParents(instances[4])[0]).toBeInstanceOf(ReferenceExpression)
      expect(getParents(instances[4])[0].elemID.getFullName()).toEqual('workato.recipe.instance.recipe123_folder11_55')
    })
    it('should update recipes but not update folder ids if root folder id is not as expected', async () => {
      const elements = generateElements().filter(e => e.elemID.name !== 'Root')
      elements.push(new InstanceElement('Root', folderType, { name: 'Root', id: 66 }))
      const lengthBefore = elements.length
      await filter.onFetch(elements)
      expect(elements.length).toEqual(lengthBefore)
      const instances = elements.filter(isInstanceElement)
      expect(instances.map(e => e.elemID.getFullName())).toEqual([
        'workato.folder.instance.folder11_55',
        'workato.folder.instance.folder22_11',
        'workato.folder.instance.folder33_55',
        'workato.folder.instance.Root',
        'workato.recipe.instance.recipe123_folder11_55',
        'workato.recipe__code.instance.recipe123_folder11_55_',
      ])
      expect(instances[4].value.code).toBeInstanceOf(ReferenceExpression)
      expect(instances[4].value.code.elemID.getFullName()).toEqual('workato.recipe__code.instance.recipe123_folder11_55_')
      expect(getParents(instances[5])[0]).toBeInstanceOf(ReferenceExpression)
      expect(getParents(instances[5])[0].elemID.getFullName()).toEqual('workato.recipe.instance.recipe123_folder11_55')
    })

    it('should do nothing if config is not in customized form', async () => {
      filter = filterCreator({
        client,
        paginator: clientUtils.createPaginator({
          client,
          paginationFuncCreator: paginate,
        }),
        config: {
          fetch: DEFAULT_CONFIG[FETCH_CONFIG],
          apiDefinitions: {
            typeDefaults: {
              transformation: {
                idFields: DEFAULT_ID_FIELDS,
              },
            },
            types: _.defaultsDeep(
              {},
              {
                folder: {
                  transformation: {
                    idFields: ['name', '&something_else'],
                  },
                },
              },
              DEFAULT_TYPES,
            ),
            supportedTypes: SUPPORTED_TYPES,
          },
        },
        fetchQuery: elementUtils.query.createMockQuery(),
      }) as FilterType
      const elements = generateElements()
      const lengthBefore = elements.length
      await filter.onFetch(elements)
      expect(elements.length).toEqual(lengthBefore)
      const instances = elements.filter(isInstanceElement)
      expect(instances.map(e => e.elemID.getFullName())).toEqual([
        'workato.recipe.instance.recipe123',
        'workato.recipe__code.instance.recipe123_',
        'workato.folder.instance.Root',
        'workato.folder.instance.folder11_55',
        'workato.folder.instance.folder22_11',
        'workato.folder.instance.folder33_55',
      ])
    })
  })
})
