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
import { WORKATO } from '../../src/constants'
import WorkatoClient from '../../src/client/client'
import { paginate } from '../../src/client/pagination'
import { DEFAULT_CONFIG } from '../../src/config'
import filterCreator from '../../src/filters/cross_service/jira/project_issuetypes'

describe('projectIssuetype filter', () => {
  let client: WorkatoClient
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType
  let elements: Element[]

  let codeType: ObjectType
  let notCodeType: ObjectType
  let recipeCode: InstanceElement
  let notRecipeCode: InstanceElement
  let notJiraCode: InstanceElement

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
    notCodeType = new ObjectType({ elemID: new ElemID(WORKATO, 'not_recipe__code') })
    codeType = new ObjectType({ elemID: new ElemID(WORKATO, 'recipe__code') })

    notRecipeCode = new InstanceElement('notRecipeCode', notCodeType, {
      as: 'notRecipeCode',
      provider: 'jira',
      name: 'create_issue',
      keyword: 'trigger',
      dynamicPickListSelection: {
        project_issuetype: 'projectName : IssueType',
      },
      input: {
        project_issuetype: 'PNM : IssueType',
      },
    })

    notJiraCode = new InstanceElement('notJiraCode', codeType, {
      as: 'notJiraCode',
      provider: 'notJira',
      name: 'create_issue',
      keyword: 'trigger',
      dynamicPickListSelection: {
        project_issuetype: 'projectName : IssueType',
      },
      input: {
        project_issuetype: 'PNM : IssueType',
      },
    })

    recipeCode = new InstanceElement('recipeCode', codeType, {
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
              provider: 'jira',
              name: 'create_issue',
              description: '',
              as: 'recipeCodeNested',
              keyword: 'action',
              dynamicPickListSelection: {
                project_issuetype: 'project name with \' : \' sign : Issue Type Name with \' : \' sign and \'--\' sign ',
                sample_project_issuetype: 'sampleProjectName : SampleIssueTypeName',
                priority: 'High',
              },
              input: {
                project_issuetype: 'PRN--Issue Type Name with \' : \' sign and \'--\' sign ',
                sample_project_issuetype: 'SPN--SampleIssueTypeName',
                summary: "#{_('data.jira.recipeCode.fields.summary')}",
              },
              visible_config_fields: [
                'project_issuetype',
                'sample_project_issuetype',
              ],
              uuid: 'uuid1',
            },
          ],
          uuid: 'uuid2',
        },
        {
          number: 3,
          provider: 'jira',
          name: 'update_issue',
          as: 'recipeCode_second',
          description: '',
          keyword: 'action',
          dynamicPickListSelection: {
            project_issuetype: {
              ids: [
                'projectInSecondBlockName@@PISB',
                'PISB--IssueType',
              ],
              titles: [
                'projectInSecondBlockName',
                'projectInSecondBlockName : IssueType',
              ],
            },
          },
          input: {
            project_issuetype: 'PISB--IssueType',
            issuekey: 'issue key',
            reporter_id: "#{_('data.jira.recipeCode.fields.customfield_10027')}",
          },
          uuid: 'uuid3',
        },
        {
          number: 4,
          provider: 'jira',
          name: 'update_issue',
          as: 'recipeCode_second',
          description: '',
          keyword: 'action',
          input: {
            project_issuetype: 'CheckWithout--DynamicPickListSelction',
            issuekey: 'issue key',
          },
          uuid: 'uuid3',
        },
      ],
    })
    elements = [recipeCode, notRecipeCode, notJiraCode, codeType, notCodeType]
  })
  describe('onFetch', () => {
    it('should keep all elements which have non-jira provider or non recipe__code type', async () => {
      const notCodeTypeBefore = _.cloneDeep(notCodeType)
      const codeTypeBefore = _.cloneDeep(codeType)
      const notJiraCodeBefore = _.cloneDeep(notJiraCode)
      const notRecipeCodeBefore = _.cloneDeep(notRecipeCode)

      await filter.onFetch(elements)

      expect(codeType).toEqual(codeTypeBefore)
      expect(notCodeType).toEqual(notCodeTypeBefore)
      expect(notJiraCode).toEqual(notJiraCodeBefore)
      expect(notRecipeCode).toEqual(notRecipeCodeBefore)
    })

    it('should remove \'project_issuetype\' from dynamicPickListSelection', async () => {
      expect(recipeCode.value.block[0].block[0].dynamicPickListSelection.project_issuetype).toBeDefined()
      expect(recipeCode.value.block[1].dynamicPickListSelection.project_issuetype).toBeDefined()

      await filter.onFetch(elements)

      expect(recipeCode.value.block[0].block[0].dynamicPickListSelection.project_issuetype).toBeUndefined()
      expect(recipeCode.value.block[1].dynamicPickListSelection.project_issuetype).toBeUndefined()
    })

    it('should remove \'sample_project_issuetype\' from dynamicPickListSelection', async () => {
      expect(recipeCode.value.block[0].block[0].dynamicPickListSelection.sample_project_issuetype).toBeDefined()

      await filter.onFetch(elements)

      expect(recipeCode.value.block[0].block[0].dynamicPickListSelection.sample_project_issuetype).toBeUndefined()
    })

    it('should replace \'project_issuetype\' to projectKey and issueType at input', async () => {
      expect(recipeCode.value.block[0].block[0].input.project_issuetype).toBeDefined()
      expect(recipeCode.value.block[0].block[0].input.projectKey).toBeUndefined()
      expect(recipeCode.value.block[0].block[0].input.issueType).toBeUndefined()

      expect(recipeCode.value.block[1].input.project_issuetype).toBeDefined()
      expect(recipeCode.value.block[1].input.projectKey).toBeUndefined()
      expect(recipeCode.value.block[1].input.issueType).toBeUndefined()

      expect(recipeCode.value.block[2].input.project_issuetype).toBeDefined()
      expect(recipeCode.value.block[2].input.projectKey).toBeUndefined()
      expect(recipeCode.value.block[2].input.issueType).toBeUndefined()

      await filter.onFetch(elements)

      expect(recipeCode.value.block[0].block[0].input.project_issuetype).toBeUndefined()
      expect(recipeCode.value.block[0].block[0].input.projectKey).toBeDefined()
      expect(recipeCode.value.block[0].block[0].input.projectKey).toEqual('PRN')
      expect(recipeCode.value.block[0].block[0].input.issueType).toBeDefined()
      expect(recipeCode.value.block[0].block[0].input.issueType).toEqual('Issue Type Name with \' : \' sign and \'--\' sign ')

      expect(recipeCode.value.block[1].input.project_issuetype).toBeUndefined()
      expect(recipeCode.value.block[1].input.projectKey).toBeDefined()
      expect(recipeCode.value.block[1].input.projectKey).toEqual('PISB')
      expect(recipeCode.value.block[1].input.issueType).toBeDefined()
      expect(recipeCode.value.block[1].input.issueType).toEqual('IssueType')

      expect(recipeCode.value.block[2].input.project_issuetype).toBeUndefined()
      expect(recipeCode.value.block[2].input.projectKey).toBeDefined()
      expect(recipeCode.value.block[2].input.projectKey).toEqual('CheckWithout')
      expect(recipeCode.value.block[2].input.issueType).toBeDefined()
      expect(recipeCode.value.block[2].input.issueType).toEqual('DynamicPickListSelction')
    })

    it('should replace \'sample_project_issuetype\' to sampleProjectKey and sampleIssueType at input', async () => {
      expect(recipeCode.value.block[0].block[0].input.sample_project_issuetype).toBeDefined()
      expect(recipeCode.value.block[0].block[0].input.sampleProjectKey).toBeUndefined()
      expect(recipeCode.value.block[0].block[0].input.sampleIssueType).toBeUndefined()

      await filter.onFetch(elements)

      expect(recipeCode.value.block[0].block[0].input.sample_project_issuetype).toBeUndefined()
      expect(recipeCode.value.block[0].block[0].input.sampleProjectKey).toBeDefined()
      expect(recipeCode.value.block[0].block[0].input.sampleProjectKey).toEqual('SPN')
      expect(recipeCode.value.block[0].block[0].input.sampleIssueType).toBeDefined()
      expect(recipeCode.value.block[0].block[0].input.sampleIssueType).toEqual('SampleIssueTypeName')
    })
  })
})
