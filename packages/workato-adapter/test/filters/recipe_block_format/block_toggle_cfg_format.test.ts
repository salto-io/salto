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
import { ElemID, InstanceElement, ObjectType, Element } from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils, elements as elementUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { WORKATO } from '../../../src/constants'
import WorkatoClient from '../../../src/client/client'
import { paginate } from '../../../src/client/pagination'
import { getDefaultConfig } from '../../../src/config'
import filterCreator from '../../../src/filters/recipe_block_format/block_toggle_cfg_format'

describe('blockToggleCfgFilter filter', () => {
  let client: WorkatoClient
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType
  let elements: Element[]

  let recipeCodeServerSide: InstanceElement
  let notRecipeCode: InstanceElement
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
      config: getDefaultConfig(true),
      fetchQuery: elementUtils.query.createMockQuery(),
    }) as FilterType
  })

  beforeEach(async () => {
    const codeType = new ObjectType({ elemID: new ElemID(WORKATO, 'recipe__code') })
    const notCodeType = new ObjectType({ elemID: new ElemID(WORKATO, 'not_recipe__code') })

    notRecipeCode = new InstanceElement('notRecipeCode', notCodeType, {
      as: 'notRecipeCode',
      provider: 'provider',
      name: 'create_issue',
      keyword: 'trigger',
      content: [
        {
          key: 'test1',
          value: 'test1_value',
        },
      ],
      toggleCfg: {
        test1: true,
      },
    })

    recipeCodeServerSide = new InstanceElement('recipeCode', codeType, {
      as: 'recipeCode',
      provider: 'jira',
      name: 'new_issue',
      keyword: 'trigger',
      input: {
        since: '2023-01-01T00:00:00-01:00',
      },
      block: [
        {
          number: 1,
          keyword: 'if',
          input: {
            type: 'compound',
            operand: 'and',
            conditions: [
              {
                operand: 'contains',
                lhs: "#{_('data.jira.recipeCode.Key')}",
                rhs: 'PK1',
                uuid: 'condition-uuid',
              },
            ],
          },
          block: [
            {
              number: 2,
              provider: 'provider',
              name: 'create_issue',
              description: '',
              as: 'validInput',
              keyword: 'action',
              dynamicPickListSelection: {
                project_issuetype: 'Value1',
                sample_project_issuetype: 'Value2',
                priority: 'High',
              },
              content: [
                {
                  key: 'test1',
                  value: 'test1_value',
                },
                {
                  key: 'test2',
                  value: [
                    {
                      key: 'test2_1',
                      value: 'test2_1_value',
                    },
                    {
                      key: 'test2_2',
                      value: 'test2_2_value',
                    },
                    {
                      key: 'test2_3',
                      value: [
                        {
                          key: 'test2_3_1',
                          value: 'test2_3_1_value',
                        },
                        {
                          key: 'test2_3_2',
                          value: 'test2_3_2_value',
                        },
                      ],
                    },
                  ],
                },
                {
                  key: 'test3',
                  value: ['test3_value1', 'test3_value2'],
                },
                {
                  key: 'test4',
                  value: 4,
                },
              ],
              toggleCfg: {
                test1: true,
                test3: false,
                'test2.test2_1': true,
                'test2.test2_3.test2_3_1': false,
              },
              uuid: 'uuid1',
            },
          ],
        },
      ],
    })
    elements = [recipeCodeServerSide, notRecipeCode]
  })
  describe('onFetch', () => {
    it('should keep elements from non recipe__code type', async () => {
      const notRecipeCodeBefore = _.cloneDeep(notRecipeCode)

      await filter.onFetch(elements)

      expect(notRecipeCode).toEqual(notRecipeCodeBefore)
    })

    it('should add items to content from toggleCfg', async () => {
      const contentWithToggleCfg = [
        {
          key: 'test1',
          value: 'test1_value',
          toggleCfg: true,
        },
        {
          key: 'test2',
          value: [
            {
              key: 'test2_1',
              value: 'test2_1_value',
              toggleCfg: true,
            },
            {
              key: 'test2_2',
              value: 'test2_2_value',
            },
            {
              key: 'test2_3',
              value: [
                {
                  key: 'test2_3_1',
                  value: 'test2_3_1_value',
                  toggleCfg: false,
                },
                {
                  key: 'test2_3_2',
                  value: 'test2_3_2_value',
                },
              ],
            },
          ],
        },
        {
          key: 'test3',
          value: ['test3_value1', 'test3_value2'],
          toggleCfg: false,
        },
        {
          key: 'test4',
          value: 4,
        },
      ]

      await filter.onFetch(elements)

      expect(recipeCodeServerSide.value.block[0].block[0].content).toEqual(contentWithToggleCfg)
    })
  })
})
// TODO tests for deploy
