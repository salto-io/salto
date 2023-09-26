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
import { ElemID, InstanceElement, ObjectType, Element } from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils, elements as elementUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { WORKATO } from '../../../src/constants'
import WorkatoClient from '../../../src/client/client'
import { paginate } from '../../../src/client/pagination'
import { DEFAULT_CONFIG } from '../../../src/config'
import filterCreator from '../../../src/filters/recipe_block_format/block_input_format'

describe('blockInputFilter filter', () => {
  let client: WorkatoClient
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType
  let elements: Element[]

  let recipeCodeServerSide: InstanceElement
  // let recipeNacl: InstanceElement
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
      config: DEFAULT_CONFIG,
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
      input: {
        test1: 'test1_value',
        test2: { test2_1: 'test2_1_value', test2_2: 'test2_2_value' },
        test3: ['test3_value1', 'test3_value2'],
        test4: 4,
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
              input: {
                test1: 'test1_value',
                test2: { test2_1: 'test2_1_value', test2_2: 'test2_2_value' },
                test3: ['test3_value1', 'test3_value2'],
                test4: 4,
              },
              visible_config_fields: [
                'Value1',
                'Value2',
              ],
              uuid: 'uuid1',
            },
            {
              number: 3,
              provider: 'provider1',
              name: 'update_issue1',
              as: 'emptyInput',
              description: '',
              keyword: 'action',
              input: {},
              uuid: 'uuid2',
            },
          ],
          uuid: 'uuid3',
        },
        {
          number: 4,
          provider: 'provider2',
          name: 'update_issue',
          as: 'withInvalidInput',
          description: '',
          keyword: 'action',
          input: {
            test1: 'test1_value',
            test2: undefined,
          },
          uuid: 'uuid4',
        },
      ],
    })

    // recipeCodeNacl = new InstanceElement('recipeCode', codeType, {
    //   as: 'recipeCode',
    //   provider: 'jira',
    //   name: 'new_issue',
    //   keyword: 'trigger',
    //   input: {
    //     since: '2023-01-01T00:00:00-01:00',
    //   },
    //   block: [
    //     {
    //       number: 1,
    //       keyword: 'if',
    //       input: {
    //         type: 'compound',
    //         operand: 'and',
    //         conditions: [
    //           {
    //             operand: 'contains',
    //             lhs: "#{_('data.jira.recipeCode.Key')}",
    //             rhs: 'PK1',
    //             uuid: 'condition-uuid',
    //           },
    //         ],
    //       },
    //       block: [
    //         {
    //           number: 2,
    //           provider: 'provider',
    //           name: 'create_issue',
    //           description: '',
    //           as: 'validInput',
    //           keyword: 'action',
    //           dynamicPickListSelection: {
    //             project_issuetype: 'Value1',
    //             sample_project_issuetype: 'Value2',
    //             priority: 'High',
    //           },
    //           input: {
    //             test1: 'test1_value',
    //             test2: { test2_1: 'test2_1_value', test2_2: 'test2_2_value' },
    //             test3: ['test3_value1', 'test3_value2'],
    //             test4: 4,
    //           },
    //           visible_config_fields: [
    //             'Value1',
    //             'Value2',
    //           ],
    //           uuid: 'uuid1',
    //         },
    //         {
    //           number: 3,
    //           provider: 'provider1',
    //           name: 'update_issue1',
    //           as: 'emptyInput',
    //           description: '',
    //           keyword: 'action',
    //           input: {},
    //           uuid: 'uuid2',
    //         },
    //       ],
    //       uuid: 'uuid3',
    //     },
    //     {
    //       number: 4,
    //       provider: 'provider2',
    //       name: 'update_issue',
    //       as: 'withInvalidInput',
    //       description: '',
    //       keyword: 'action',
    //       input: {
    //         test1: 'test1_value',
    //         test2: undefined,
    //       },
    //       uuid: 'uuid4',
    //     },
    //   ],
    // })

    elements = [recipeCodeServerSide, notRecipeCode]
  })
  describe('onFetch', () => { // TODO add tests for toggleCFG
    it('should keep elements from non recipe__code type', async () => {
      const notRecipeCodeBefore = _.cloneDeep(notRecipeCode)

      await filter.onFetch(elements)

      expect(notRecipeCode).toEqual(notRecipeCodeBefore)
    })

    it('should keep non relevant blocks', async () => {
      const recipeCodeBefore = _.cloneDeep(recipeCodeServerSide)
      await filter.onFetch(elements)

      // if block
      expect(recipeCodeServerSide.value.block[0].input).toEqual(recipeCodeBefore.value.block[0].input)
      // empty input
      expect(recipeCodeServerSide.value.block[0].block[1].input).toEqual(recipeCodeBefore.value.block[0].block[1].input)
    })

    it('should build newInput from valid input', async () => {
      const validNewInput = [
        {
          key: 'test1',
          value: 'test1_value',
        },
        {
          key: 'test2',
          value: { test2_1: 'test2_1_value', test2_2: 'test2_2_value' },
        },
        {
          key: 'test3',
          value: ['test3_value1', 'test3_value2'],
        },
        {
          key: 'test4',
          value: 4,
        },
      ]

      const withInvalidNewInput = [
        {
          key: 'test1',
          value: 'test1_value',
        },
        {
          key: 'test2',
        },
      ]

      await filter.onFetch(elements)

      // valid block
      expect(recipeCodeServerSide.value.block[0].block[0].newInput).toEqual(validNewInput)
      // with invalid input keys block
      expect(recipeCodeServerSide.value.block[1].newInput).toEqual(withInvalidNewInput)
    })
  })
})
// TODO tests for deploy
