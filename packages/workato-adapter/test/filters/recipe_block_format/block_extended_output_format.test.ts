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
import filterCreator from '../../../src/filters/recipe_block_format/block_extended_input_format'

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
                tes: "#{_('data.zendesk.1797b86b.custom_fields.field_4847599896339')} - #{_('data.zendesk.1797b86b.custom_fields.field_484759989111')} - #{_('data.zendesk.1797b86b.custom_fields.field_4847599896333')}",
                tes2: "test3_value1 - #{_('data.zendesk.1797b86b.custom_fields.field_48475994444')}",
                test1:
                  "#{_('data.zendesk.0797fb91.asd')} - #{_('data.zendesk.0797fb91.subject')} - #{_('data.zendesk.0797fb91.type')} - #{_('data.zendesk.0797fb91.priority')} - #{_('data.zendesk.0797fb91.external_id')} - #{_('data.zendesk.0797fb91.status')} - #{_('data.zendesk.0797fb91.requester_id')} - #{_('data.zendesk.0797fb91.brand_id')} - #{_('data.zendesk.0797fb91.submitter_id')}, #{_('data.zendesk.0797fb91.group_id')} - #{_('data.zendesk.0797fb91.forum_topic_id')} - #{_('data.zendesk.0797fb91.recipient')} = #{_('data.zendesk.0797fb91.has_incidents')} - #{_('data.zendesk.0797fb91.due_at')} - #{_('data.zendesk.0797fb91.tags_string')} - #{_('data.zendesk.0797fb91.tags')}#{_('data.zendesk.0797fb91.ticket_form_id')}#{_('data.zendesk.0797fb91.description')} - #{_('data.zendesk.0797fb91.url')} - #{_('data.zendesk.0797fb91.created_at')}#{_('data.zendesk.0797fb91.raw_subject')} - #{_('data.zendesk.0797fb91.updated_at')}. - #{_('data.zendesk.0797fb91.is_public')} #{_('data.zendesk.0797fb91.problem_id')}\n$$$$$Requester (Assigne, submitter) - #{_('data.zendesk.0797fb91.get_user_by_id(requester_id>id).name')} - #{_('data.zendesk.0797fb91.get_user_by_id(requester_id>id).role')} - #{_('data.zendesk.0797fb91.get_user_by_id(requester_id>id).email')} - #{_('data.zendesk.0797fb91.get_user_by_id(requester_id>id).organization_id')} - #{_('data.zendesk.0797fb91.get_user_by_id(requester_id>id).external_id')} - #{_('data.zendesk.0797fb91.get_user_by_id(requester_id>id).signature')} - #{_('data.zendesk.0797fb91.get_user_by_id(requester_id>id).phone')} - #{_('data.zendesk.0797fb91.get_user_by_id(requester_id>id).details')} - #{_('data.zendesk.0797fb91.get_user_by_id(requester_id>id).notes')} - #{_('data.zendesk.0797fb91.get_user_by_id(requester_id>id).active')} - #{_('data.zendesk.0797fb91.get_user_by_id(requester_id>id).verified')} - #{_('data.zendesk.0797fb91.get_user_by_id(requester_id>id).shared')} - #{_('data.zendesk.0797fb91.get_user_by_id(requester_id>id).locale_id')} - #{_('data.zendesk.0797fb91.get_user_by_id(requester_id>id).locale')} - #{_('data.zendesk.0797fb91.get_user_by_id(requester_id>id).time_zone')} - #{_('data.zendesk.0797fb91.get_user_by_id(requester_id>id).ticket_restriction')} - #{_('data.zendesk.0797fb91.get_user_by_id(requester_id>id).moderator')} - #{_('data.zendesk.0797fb91.get_user_by_id(requester_id>id).only_private_comments')} - #{_('data.zendesk.0797fb91.get_user_by_id(requester_id>id).tags')} - #{_('data.zendesk.0797fb91.get_user_by_id(requester_id>id).tags_string')} - #{_('data.zendesk.0797fb91.get_user_by_id(requester_id>id).id')} = #{_('data.zendesk.0797fb91.get_user_by_id(requester_id>id).url')} - #{_('data.zendesk.0797fb91.get_user_by_id(requester_id>id).created_at')} - #{_('data.zendesk.0797fb91.get_user_by_id(requester_id>id).last_login_at')} - #{_('data.zendesk.0797fb91.get_user_by_id(requester_id>id).alias')} - #{_('data.zendesk.0797fb91.get_user_by_id(requester_id>id).custom_role_id')} - #{_('data.zendesk.0797fb91.get_user_by_id(requester_id>id).restricted_agent')} - #{_('data.zendesk.0797fb91.get_user_by_id(requester_id>id).suspended')} - #{_('data.zendesk.0797fb91.get_user_by_id(requester_id>id).shared_agent')} - \n$$$$4organization - #{_('data.zendesk.0797fb91.get_organization_by_id(organization_id>id).domain_names')} = #{_('data.zendesk.0797fb91.get_organization_by_id(organization_id>id).details')} - #{_('data.zendesk.0797fb91.get_organization_by_id(organization_id>id).notes')}  - #{_('data.zendesk.0797fb91.get_organization_by_id(organization_id>id).group_id')} = #{_('data.zendesk.0797fb91.get_organization_by_id(organization_id>id).shared_tickets')} - #{_('data.zendesk.0797fb91.get_organization_by_id(organization_id>id).shared_comments')} - #{_('data.zendesk.0797fb91.get_organization_by_id(organization_id>id).tags_string')} - #{_('data.zendesk.0797fb91.get_organization_by_id(organization_id>id).external_id')} - #{_('data.zendesk.0797fb91.get_organization_by_id(organization_id>id).tags')} - #{_('data.zendesk.0797fb91.get_organization_by_id(organization_id>id).name')} - #{_('data.zendesk.0797fb91.get_organization_by_id(organization_id>id).id')} - #{_('data.zendesk.0797fb91.get_organization_by_id(organization_id>id).url')} - #{_('data.zendesk.0797fb91.get_organization_by_id(organization_id>id).created_at')} - \n$$$$$Satisfaction reating - #{_('data.zendesk.0797fb91.satisfaction_rating.id')} - #{_('data.zendesk.0797fb91.satisfaction_rating.score')} - #{_('data.zendesk.0797fb91.satisfaction_rating.comment')} - \n$$$$via #{_('data.zendesk.0797fb91.via.channel')} - :source:form#{_('data.zendesk.0797fb91.via.source.from.address')} - #{_('data.zendesk.0797fb91.via.source.from.name')}#{_('data.zendesk.0797fb91.via.source.from.phone')}#{_('data.zendesk.0797fb91.via.source.from.formatted_phone')}#{_('data.zendesk.0797fb91.via.source.from.facebook_id')}. :source:to-#{_('data.zendesk.0797fb91.via.source.to.address')}#{_('data.zendesk.0797fb91.via.source.to.ticket_id')}#{_('data.zendesk.0797fb91.via.source.to.topic_name')}#{_('data.zendesk.0797fb91.via.source.to.phone')}. :source rel - #{_('data.zendesk.0797fb91.via.source.rel')}\n$$$$$$ collaborator IDs (FOllower IDs, EMail CC IDs) - #{_('data.zendesk.0797fb91.collaborator_ids.first.value')} - #{_('data.zendesk.0797fb91.collaborator_ids.first.____Size', 'list_meta', '____Size', 'data.zendesk.0797fb91.collaborator_ids')} - #{_('data.zendesk.0797fb91.collaborator_ids.first.____Index')}\n$$$$$Sharing Agreement IDs - #{_('data.zendesk.0797fb91.sharing_agreement_ids.first.value')} - #{_('data.zendesk.0797fb91.sharing_agreement_ids.first.____Size', 'list_meta', '____Size', 'data.zendesk.0797fb91.sharing_agreement_ids')} - #{_('data.zendesk.0797fb91.sharing_agreement_ids.first.____Index')}\n$$$$$ fields - #{_('data.zendesk.0797fb91.fields.first.id')} - #{_('data.zendesk.0797fb91.fields.first.value')} - #{_('data.zendesk.0797fb91.fields.first.____Size', 'list_meta', '____Size', 'data.zendesk.0797fb91.fields')} - #{_('data.zendesk.0797fb91.fields.first.____Index')}\nEnd 0 #{_('data.zendesk.0797fb91.generated_timestamp')} = #{_('data.zendesk.0797fb91.allow_channelback')} = #{_('data.zendesk.0797fb91.allow_attachments')} = #{_('data.zendesk.0797fb91.custom_fields.field_16458646122897')}",
                test2: { test2_1: 'test2_1_value', test2_2: 'test2_2_value' },
                test3: "test3_value1 - #{_('data.zendesk.1797b86b.custom_fields.field_48475994444')}",
                test4: 4,
              },
              visible_config_fields: ['Value1', 'Value2'],
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
            test1:
              "#{_('data.zendesk.1797b86b.custom_fields.field_4847599896339')} - #{_('data.zendesk.1797b86b.custom_fields.field_484759989111')} - #{_('data.zendesk.1797b86b.custom_fields.field_4847599896333')}",
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
  describe('onFetch', () => {
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
