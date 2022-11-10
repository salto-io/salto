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
import { ElemID, InstanceElement, ObjectType, ReferenceExpression, Element } from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils, elements as elementUtils } from '@salto-io/adapter-components'
import WorkatoClient from '../../src/client/client'
import { paginate } from '../../src/client/pagination'
import { DEFAULT_CONFIG, FETCH_CONFIG, WorkatoConfig } from '../../src/config'
import fetchCriteria from '../../src/fetch_criteria'
import { WORKATO } from '../../src/constants'
import filterCreator from '../../src/filters/query'

describe('query filter', () => {
  let client: WorkatoClient
  let elements: Element[]

  const generateElements = (): Element[] => {
    const connectionType = new ObjectType({ elemID: new ElemID(WORKATO, 'connection') })
    const sf1 = new InstanceElement('sf1', connectionType, { name: 'salesforce sandbox 1' })
    const sf2 = new InstanceElement('sf2', connectionType, { name: 'another salesforce sandbox' })
    const folderType = new ObjectType({ elemID: new ElemID(WORKATO, 'folder') })
    const folder1 = new InstanceElement('folder1', folderType, { name: 'folder 1' })
    const folder2 = new InstanceElement('folder2', folderType, { name: 'folder 2' })

    const codeType = new ObjectType({ elemID: new ElemID(WORKATO, 'recipe__code') })
    const recipeType = new ObjectType({ elemID: new ElemID(WORKATO, 'recipe') })
    const recipe1code = new InstanceElement('recipe1_code', codeType, { name: 'ignored' })
    const recipe1 = new InstanceElement(
      'recipe1',
      recipeType,
      {
        name: 'recipe1',
        code: new ReferenceExpression(recipe1code.elemID),
      },
    )
    const recipe2code = new InstanceElement('recipe2_code', codeType, { name: 'ignored' })
    const recipe2 = new InstanceElement(
      'recipe2',
      recipeType,
      {
        name: 'recipe2',
        code: new ReferenceExpression(recipe2code.elemID),
      },
    )

    return [
      connectionType, sf1, sf2,
      folderType, folder1, folder2,
      codeType, recipeType, recipe1code, recipe1, recipe2code, recipe2,
    ]
  }

  beforeEach(async () => {
    elements = generateElements()
  })

  describe('onFetch', () => {
    it('should include all elements when using default config', async () => {
      const filter = filterCreator({
        client,
        paginator: clientUtils.createPaginator({
          client,
          paginationFuncCreator: paginate,
        }),
        config: DEFAULT_CONFIG,
        fetchQuery: elementUtils.query.createElementQuery(DEFAULT_CONFIG[FETCH_CONFIG], fetchCriteria),
      }) as filterUtils.FilterWith<'onFetch'>
      const origElementIDs = elements.map(e => e.elemID.getFullName())
      await filter.onFetch(elements)
      expect(elements.map(e => e.elemID.getFullName())).toEqual(origElementIDs)
    })

    it('should only keep types and instances matching the query, including recipe__code instances', async () => {
      const config: WorkatoConfig = {
        ...DEFAULT_CONFIG,
        [FETCH_CONFIG]: {
          ...DEFAULT_CONFIG[FETCH_CONFIG],
          include: [
            {
              type: '(?!recipe|folder).*',
            },
            {
              type: 'recipe',
              criteria: {
                name: '.*1',
              },
            },
            {
              type: 'folder',
              criteria: {
                name: '.*2',
              },
            },
          ],
        },
      }
      const filter = filterCreator({
        client,
        paginator: clientUtils.createPaginator({
          client,
          paginationFuncCreator: paginate,
        }),
        config,
        fetchQuery: elementUtils.query.createElementQuery(config[FETCH_CONFIG], fetchCriteria),
      }) as filterUtils.FilterWith<'onFetch'>
      await filter.onFetch(elements)
      expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual([
        'workato.connection',
        'workato.connection.instance.sf1',
        'workato.connection.instance.sf2',
        'workato.folder',
        'workato.folder.instance.folder2',
        'workato.recipe',
        'workato.recipe.instance.recipe1',
        'workato.recipe__code',
        'workato.recipe__code.instance.recipe1_code',
      ])
    })
  })
})
