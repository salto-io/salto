/*
*                      Copyright 2023 Salto Labs Ltd.
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

import { ElemID, InstanceElement, ObjectType, BuiltinTypes, CORE_ANNOTATIONS, ReferenceExpression, isInstanceElement } from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils, elements as elemUtils } from '@salto-io/adapter-components'
import { DEFAULT_CONFIG, FETCH_CONFIG, SUPPORTED_TYPES, DEFAULT_ID_FIELDS } from '../../src/config'
import WorkatoClient from '../../src/client/client'
import { WORKATO } from '../../src/constants'
import { paginate } from '../../src/client/pagination'
import commonCreators from '../../src/filters/common'

const filterCreator = commonCreators.referencedInstanceNames

describe('referenced id fields filter', () => {
  let client: WorkatoClient
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType

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

  beforeEach(async () => {
    jest.clearAllMocks()
    client = new WorkatoClient({
      credentials: { username: 'a', token: 'b' },
    })
  })
  const rootFolder = new InstanceElement('Root', folderType, { name: 'Root', id: 55 }) // root folder
  const folder11 = new InstanceElement(
    'folder11_55',
    folderType,
    {
      name: 'folder11',
      id: 11,
      parent_id: new ReferenceExpression(rootFolder.elemID, rootFolder),
    }
  )
  const recipe123 = new InstanceElement(
    'recipe123',
    recipeType,
    {
      name: 'recipe123',
      id: 123,
      folder_id: new ReferenceExpression(folder11.elemID, folder11),
      code: new ReferenceExpression(new ElemID('workato', 'recipe__code', 'instance', 'recipe123_')),
    },
    ['Records', 'recipe', 'recipe123'],
  )
  const recipeCode123 = new InstanceElement(
    'recipe123_',
    recipeCodeType,
    { id: 123 },
    ['Records', 'recipe__code', 'recipe123_'],
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(recipe123.elemID, recipe123)] },
  )
  const folder22 = new InstanceElement(
    'folder22_11',
    folderType,
    {
      name: 'folder22',
      id: 22,
      parent_id: new ReferenceExpression(folder11.elemID, folder11),
    }
  )
  const folder33 = new InstanceElement(
    'folder33_55',
    folderType,
    {
      name: 'folder33',
      id: 33,
      parent_id: new ReferenceExpression(rootFolder.elemID, rootFolder),
    }
  )

  it('should resolve ids in instances names if & exist in the config', async () => {
    const elements = [folderType, recipeType, recipeCodeType, recipeCode123,
      folder11, folder22, rootFolder, recipe123, folder33]
    const lengthBefore = elements.length
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
          types: {
            folder: {
              transformation: {
                idFields: ['name', '&parent_id'],
              },
            },
            recipe: {
              transformation: {
                idFields: ['name', '&folder_id'],
              },
            },
            recipe__code: {
              transformation: {
                idFields: [],
                extendsParentId: true,
              },
            },
          },
          supportedTypes: SUPPORTED_TYPES,
        },
      },
      fetchQuery: elemUtils.query.createMockQuery(),
    }) as FilterType
    await filter.onFetch(elements)
    expect(elements.length).toEqual(lengthBefore)
    const instances = elements.filter(isInstanceElement)
    expect(instances.map(e => e.elemID.getFullName()).sort()).toEqual([
      'workato.folder.instance.Root',
      'workato.folder.instance.folder11_Root',
      'workato.folder.instance.folder22_folder11_Root',
      'workato.folder.instance.folder33_Root',
      'workato.recipe.instance.recipe123_folder11_Root',
      'workato.recipe__code.instance.recipe123_folder11_Root',
    ])
  })
  it('should not add referenced id fields configuration is not as expected', async () => {
    const elements = [folderType, recipeType, recipeCodeType, recipeCode123,
      folder11, folder22, rootFolder, recipe123, folder33]
    const lengthBefore = elements.length
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
              idFields: ['name'],
            },
          },
          types: {
            folder: {
              transformation: {
                idFields: ['name', '&somthing'],
              },
            },
            recipe: {
              transformation: {
                idFields: ['name', '&nothing'],
              },
            },
            recipe__code: {
              transformation: {
                idFields: [],
              },
            },
          },
          supportedTypes: SUPPORTED_TYPES,
        },
      },
      fetchQuery: elemUtils.query.createMockQuery(),
    }) as FilterType
    await filter.onFetch(elements)
    expect(elements.length).toEqual(lengthBefore)
    const instances = elements.filter(isInstanceElement)
    expect(instances.map(e => e.elemID.getFullName()).sort()).toEqual([
      'workato.folder.instance.Root',
      'workato.folder.instance.folder11_55',
      'workato.folder.instance.folder22_11',
      'workato.folder.instance.folder33_55',
      'workato.recipe.instance.recipe123',
      'workato.recipe__code.instance.recipe123_',
    ])
  })
})
