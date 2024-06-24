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
  ListType,
  CORE_ANNOTATIONS,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils, elements as elementUtils } from '@salto-io/adapter-components'
import { DetailedDependency } from '@salto-io/adapter-utils'
import filterCreator from '../../src/filters/cross_service/recipe_references'
import WorkatoClient from '../../src/client/client'
import { paginate } from '../../src/client/pagination'
import { DEFAULT_ID_FIELDS, SUPPORTED_TYPES, getDefaultConfig, FETCH_CONFIG, DEFAULT_TYPES } from '../../src/config'
import { WORKATO } from '../../src/constants'

/* eslint-disable camelcase */

describe('Recipe references filter', () => {
  let client: WorkatoClient
  type FilterType = filterUtils.FilterWith<'onPostFetch'>
  let filter: FilterType

  const dereferenceDep = (dep: DetailedDependency): unknown => ({
    reference: dep.reference.elemID.getFullName(),
    occurrences: dep.occurrences?.map(oc => ({ ...oc, location: oc.location?.elemID.getFullName() })),
  })

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
        fetch: {
          ...getDefaultConfig()[FETCH_CONFIG],
          serviceConnectionNames: {
            salesforce: ['salesforce sandbox 1'],
            netsuite: ['netsuite sbx 123'],
            ignore: ['abc'],
          },
        },
        apiDefinitions: {
          typeDefaults: {
            transformation: {
              idFields: DEFAULT_ID_FIELDS,
            },
          },
          types: DEFAULT_TYPES,
          supportedTypes: SUPPORTED_TYPES,
        },
      },
      fetchQuery: elementUtils.query.createMockQuery(),
    }) as FilterType
  })

  const generateCurrentAdapterElements = (): Element[] => {
    const connectionType = new ObjectType({
      elemID: new ElemID(WORKATO, 'connection'),
      fields: {
        id: { refType: BuiltinTypes.NUMBER },
        application: { refType: BuiltinTypes.STRING },
        name: { refType: BuiltinTypes.STRING },
      },
    })

    const sfSandbox1 = new InstanceElement('salesforce_sandbox_1', connectionType, {
      id: 1234,
      application: 'salesforce',
      name: 'salesforce sandbox 1',
    })
    const anotherSfSandbox = new InstanceElement('another_salesforce_sandbox', connectionType, {
      id: 1235,
      application: 'salesforce',
      name: 'another salesforce sandbox',
    })
    const netsuiteSandbox123 = new InstanceElement('netsuite_sbx_123', connectionType, {
      id: 1236,
      application: 'netsuite',
      name: 'netsuite sbx 123',
    })

    const zuoraSandbox = new InstanceElement('zuora_sbx_123', connectionType, {
      id: 1237,
      application: 'zuora',
      name: 'zuora sbx 123',
    })

    const jiraSandbox = new InstanceElement('jira_sbx_123', connectionType, {
      id: 1238,
      application: 'jira',
      name: 'jira sbx 123',
    })

    const zendeskSandbox = new InstanceElement('zendesk_sbx_123', connectionType, {
      id: 1237,
      application: 'zendesk',
      name: 'zendesk sbx 123',
    })

    const secondarySalesforce = new InstanceElement('secondary_sf', connectionType, {
      id: 1235,
      application: 'salesforce_secondary',
      name: 'secondary salesforce',
    })
    const secondaryNetsuite = new InstanceElement('secondary_ns', connectionType, {
      id: 1236,
      application: 'netsuite_secondary',
      name: 'secondary netsuite',
    })

    const labelValueType = new ObjectType({
      elemID: new ElemID(WORKATO, 'labelValue'),
      fields: {
        label: { refType: BuiltinTypes.STRING },
        value: { refType: BuiltinTypes.STRING },
      },
    })

    const dynamicPickListSelectionType = new ObjectType({
      elemID: new ElemID(WORKATO, 'recipe__code__dynamicPickListSelection'),
      fields: {
        sobject_name: { refType: BuiltinTypes.STRING },
        netsuite_object: { refType: BuiltinTypes.STRING },
        topic_id: { refType: BuiltinTypes.STRING },
        table_list: { refType: new ListType(labelValueType) },
        field_list: { refType: new ListType(labelValueType) },
      },
    })

    const inputType = new ObjectType({
      elemID: new ElemID(WORKATO, 'recipe__code__input'),
      fields: {
        sobject_name: { refType: BuiltinTypes.STRING },
        netsuite_object: { refType: BuiltinTypes.STRING },
        projectKey: { refType: BuiltinTypes.STRING },
        issueType: { refType: BuiltinTypes.STRING },
        sampleProjectKey: { refType: BuiltinTypes.STRING },
        SampleIssueType: { refType: BuiltinTypes.STRING },
        topic_id: { refType: BuiltinTypes.STRING },
        table_list: { refType: new ListType(labelValueType) },
        field_list: { refType: new ListType(labelValueType) },
      },
    })

    // imitate 3-level recursive type generation until we fix it

    const nestedBlockTypeInner = new ObjectType({
      elemID: new ElemID(WORKATO, 'recipe__code__block__block__block'),
      fields: {
        provider: {
          refType: BuiltinTypes.STRING,
        },
        name: {
          refType: BuiltinTypes.STRING,
        },
        dynamicPickListSelection: {
          refType: dynamicPickListSelectionType,
        },
        input: {
          refType: inputType,
        },
        as: {
          refType: BuiltinTypes.STRING,
        },
      },
    })

    const nestedBlockType = new ObjectType({
      elemID: new ElemID(WORKATO, 'recipe__code__block__block'),
      fields: {
        provider: {
          refType: BuiltinTypes.STRING,
        },
        name: {
          refType: BuiltinTypes.STRING,
        },
        dynamicPickListSelection: {
          refType: dynamicPickListSelectionType,
        },
        input: {
          refType: inputType,
        },
        block: {
          refType: new ListType(nestedBlockTypeInner),
        },
        as: {
          refType: BuiltinTypes.STRING,
        },
      },
    })

    const blockType = new ObjectType({
      elemID: new ElemID(WORKATO, 'recipe__code__block'),
      fields: {
        provider: {
          refType: BuiltinTypes.STRING,
        },
        name: {
          refType: BuiltinTypes.STRING,
        },
        dynamicPickListSelection: {
          refType: dynamicPickListSelectionType,
        },
        input: {
          refType: inputType,
        },
        block: {
          refType: new ListType(nestedBlockType),
        },
        as: {
          refType: BuiltinTypes.STRING,
        },
      },
    })

    const codeType = new ObjectType({
      elemID: new ElemID(WORKATO, 'recipe__code'),
      fields: {
        provider: {
          refType: BuiltinTypes.STRING,
        },
        name: {
          refType: BuiltinTypes.STRING,
        },
        dynamicPickListSelection: {
          refType: dynamicPickListSelectionType,
        },
        input: {
          refType: inputType,
        },
        block: {
          refType: new ListType(blockType),
        },
        as: {
          refType: BuiltinTypes.STRING,
        },
      },
    })

    const recipeConfigType = new ObjectType({
      elemID: new ElemID(WORKATO, 'recipe__config'),
      fields: {
        name: { refType: BuiltinTypes.STRING },
        provider: { refType: BuiltinTypes.STRING },
        account_id: { refType: BuiltinTypes.NUMBER },
        keyword: { refType: BuiltinTypes.STRING },
      },
    })

    const recipeType = new ObjectType({
      elemID: new ElemID(WORKATO, 'recipe'),
      fields: {
        code: {
          refType: codeType,
        },
        config: {
          refType: recipeConfigType,
        },
        applications: {
          refType: new ListType(BuiltinTypes.STRING),
        },
        trigger_application: {
          refType: BuiltinTypes.STRING,
        },
        action_applications: {
          refType: new ListType(BuiltinTypes.STRING),
        },
      },
    })

    const sharedRecipeCode = {
      as: '1234aaaa',
      provider: 'salesforce',
      name: 'updated_custom_object',
      keyword: 'trigger',
      dynamicPickListSelection: {
        sobject_name: 'Opportunity',
        field_list: [
          {
            label: 'Opportunity ID',
            value: 'Id',
          },
          {
            label: 'Account ID',
            value: 'AccountId',
          },
          {
            label: 'Name',
            value: 'Name',
          },
          {
            label: 'Custom field',
            value: 'Custom__c',
          },
          {
            label: 'Owner.Field 123 label',
            value: 'User$Owner or some other label to ignore.Field111__c',
          },
        ],
        table_list: [
          {
            label: 'Price Book',
            value: 'Pricebook2',
          },
          {
            label: 'Owner',
            value: 'User',
          },
          {
            label: 'Account',
            value: 'Account',
          },
        ],
      },
      input: {
        sobject_name: 'Opportunity',
        // sets the value of Custom__c using netsuite custom fields
        Custom__c:
          "some prefix to ignore #{_('data.netsuite.211cdf34.dateCreated')} #{_('data.netsuite.12345678.custom_fields.f_custrecordaccount_id')}#{_('data.netsuite.211cdf34.custom_fields.f_123_custrecord5')} #{_('data.netsuite.44bf4bfd.Customers.first.custom_fields.f_126_custentitycustom_account_city')} ignore",
      },
      block: [
        {
          as: 'nestedid1',
          keyword: 'action',
          provider: 'netsuite',
          name: 'add_object',
          dynamicPickListSelection: {
            netsuite_object: 'custom record type label',
            custom_list: [{ value: 'othercustomfield@custrecord2', label: 'something' }],
          },
          input: {
            netsuite_object: 'custom record type label@@customrecord16',
          },
          block: [
            {
              as: 'nestedid2',
              provider: 'salesforce',
              keyword: 'action',
              name: 'updated_custom_object',
              dynamicPickListSelection: {
                sobject_name: 'My Custom',
              },
              input: {
                sobject_name: 'MyCustom__c',
                customField__c: "#{_('data.salesforce.1234aaaa.Opportunity.first.FormulaRef1__c')}",
                something1: "#{_('data.salesforce.1234aaaa.sobject.FormulaRef2__c')}",
                something2: "#{_('data.salesforce.1234aaaa.FormulaRef3__c')}",
                something3: "#{_('data.salesforce.1234aaaa.sobject.User.Field222__c')}",
                getCustomObject:
                  "#{_('data.salesforce.1234aaaa.get_custom_object(UserId>id, sobject_name: User).Name__c')}#{_('data.salesforce.1234aaaa.get_custom_object(CampaignId>id, sobject_name: Campaign).get_custom_object(CampaignMemberRecordTypeId>id, sobject_name: Opportunity).FormulaRef4__c')}",
                unknown1: "#{_('data.salesforce.1234aaaa.sobject.User.unknown')}",
                unknown2: "#{_('data.salesforce.1234aaaa.unknown.first.FormulaRef1__c')}",
              },
            },
          ],
        },
      ],
    }

    const recipe1code = new InstanceElement('recipe1_code', codeType, _.cloneDeep(sharedRecipeCode))
    const recipe1 = new InstanceElement('recipe1', recipeType, {
      config: [
        {
          keyword: 'application',
          name: 'salesforce',
          provider: 'salesforce',
          account_id: new ReferenceExpression(sfSandbox1.elemID),
        },
        {
          keyword: 'application',
          name: 'rest',
          provider: 'rest',
        },
        {
          keyword: 'application',
          name: 'netsuite',
          provider: 'netsuite',
          account_id: new ReferenceExpression(netsuiteSandbox123.elemID),
        },
      ],
      code: new ReferenceExpression(recipe1code.elemID),
    })

    const recipe2WrongConnectionCode = new InstanceElement('recipe2_code', codeType, _.cloneDeep(sharedRecipeCode))
    const recipe2WrongConnection = new InstanceElement('recipe2', recipeType, {
      config: [
        {
          keyword: 'application',
          name: 'salesforce',
          provider: 'salesforce',
          account_id: new ReferenceExpression(anotherSfSandbox.elemID),
        },
        {
          keyword: 'application',
          name: 'rest',
          provider: 'rest',
        },
      ],
      code: new ReferenceExpression(recipe2WrongConnectionCode.elemID),
    })

    const recipe3OnlyNetsuiteCode = new InstanceElement('recipe3_code', codeType, _.cloneDeep(sharedRecipeCode))
    const recipe3OnlyNetsuite = new InstanceElement('recipe3', recipeType, {
      config: [
        {
          keyword: 'application',
          name: 'salesforce',
          provider: 'salesforce',
          account_id: new ReferenceExpression(anotherSfSandbox.elemID),
        },
        {
          keyword: 'application',
          name: 'rest',
          provider: 'rest',
        },
        {
          keyword: 'application',
          name: 'netsuite',
          provider: 'netsuite',
          account_id: new ReferenceExpression(netsuiteSandbox123.elemID),
        },
      ],
      code: new ReferenceExpression(recipe3OnlyNetsuiteCode.elemID),
    })
    const recipe4UnknownSalesforceSobjectCode = new InstanceElement('recipe4_code', codeType, {
      as: 'recipe4id',
      provider: 'salesforce',
      name: 'updated_custom_object',
      dynamicPickListSelection: {
        sobject_name: 'Unknown',
        field_list: [
          {
            label: 'Opportunity ID',
            value: 'Id',
          },
          {
            label: 'Account ID',
            value: 'AccountId',
          },
          {
            label: 'Name',
            value: 'Name',
          },
          {
            label: 'Custom field',
            value: 'Custom__c',
          },
        ],
        table_list: [
          {
            label: 'Price Book',
            value: 'Pricebook2',
          },
          {
            label: 'Owner',
            value: 'User',
          },
          {
            label: 'Account',
            value: 'Account',
          },
        ],
      },
      input: {
        sobject_name: 'Unknown',
      },
    })
    const recipe4UnknownSalesforceSobject = new InstanceElement('recipe4', recipeType, {
      config: [
        {
          keyword: 'application',
          name: 'salesforce',
          provider: 'salesforce',
          account_id: new ReferenceExpression(anotherSfSandbox.elemID),
        },
      ],
      code: new ReferenceExpression(recipe4UnknownSalesforceSobjectCode.elemID),
    })
    const recipe5WithSecondaryCode = new InstanceElement('recipe5_code', codeType, {
      as: '1234aaaa',
      provider: 'salesforce_secondary',
      name: 'updated_custom_object',
      keyword: 'trigger',
      dynamicPickListSelection: {
        sobject_name: 'Opportunity',
      },
      input: {
        sobject_name: 'Opportunity',
        // sets the value of Custom__c using netsuite custom fields
        Custom__c:
          "some prefix to ignore #{_('data.netsuite_secondary.211cdf34.dateCreated')} #{_('data.netsuite_secondary.12345678.custom_fields.f_custrecordaccount_id')}#{_('data.netsuite_secondary.211cdf34.custom_fields.f_123_custrecord5')} #{_('data.netsuite_secondary.44bf4bfd.Customers.first.custom_fields.f_126_custentitycustom_account_city')} ignore",
      },
      block: [
        {
          as: 'nestedid1',
          provider: 'netsuite_secondary',
          keyword: 'action',
          name: 'add_object',
          dynamicPickListSelection: {
            netsuite_object: 'custom record type label',
            custom_list: [{ value: 'othercustomfield@custrecord2', label: 'something' }],
          },
          input: {
            netsuite_object: 'custom record type label@@customrecord16',
          },
          block: [
            {
              as: 'nestedid2',
              provider: 'salesforce',
              keyword: 'action',
              name: 'updated_custom_object',
              dynamicPickListSelection: {
                sobject_name: 'My Custom',
              },
              input: {
                sobject_name: 'MyCustom__c',
                customField__c: "#{_('data.salesforce_secondary.1234aaaa.Opportunity.first.FormulaRef1__c')}",
                something1: "#{_('data.salesforce_secondary.1234aaaa.sobject.FormulaRef2__c')}",
                something2: "#{_('data.salesforce_secondary.1234aaaa.FormulaRef3__c')}",
                unknown2: "#{_('data.salesforce_secondary.1234aaaa.unknown.first.FormulaRef1__c')}",
              },
            },
          ],
        },
      ],
    })
    const recipe5WithSecondary = new InstanceElement('recipe5', recipeType, {
      config: [
        {
          keyword: 'application',
          name: 'salesforce',
          provider: 'salesforce',
          account_id: new ReferenceExpression(sfSandbox1.elemID),
        },
        {
          keyword: 'application',
          name: 'rest',
          provider: 'rest',
        },
        {
          keyword: 'application',
          name: 'netsuite',
          provider: 'netsuite',
          account_id: new ReferenceExpression(netsuiteSandbox123.elemID),
        },
        {
          keyword: 'application',
          name: 'salesforce_secondary',
          provider: 'salesforce_secondary',
          account_id: new ReferenceExpression(secondarySalesforce.elemID),
        },
        {
          keyword: 'application',
          name: 'netsuite_secondary',
          provider: 'netsuite_secondary',
          account_id: new ReferenceExpression(secondaryNetsuite.elemID),
        },
      ],
      code: new ReferenceExpression(recipe5WithSecondaryCode.elemID),
    })
    const recipe6NetsuiteTypesCode = new InstanceElement('recipe6_code', codeType, {
      as: 'recipe6id',
      provider: 'netsuite',
      name: 'updated_custom_object',
      keyword: 'trigger',
      dynamicPickListSelection: {
        netsuite_object: 'Customer',
      },
      input: {
        netsuite_object: 'Customer',
        companyName: 'abc',
      },
      block: [
        {
          as: 'recipe6id_nested',
          provider: 'netsuite',
          name: 'search_object_v2',
          keyword: 'action',
          dynamicPickListSelection: {
            netsuite_object: 'Opportunity',
          },
          input: {
            netsuite_object: 'Opportunity@@script',
          },
        },
      ],
    })
    const recipe6NetsuiteTypes = new InstanceElement('recipe6', recipeType, {
      config: [
        {
          keyword: 'application',
          name: 'netsuite',
          provider: 'netsuite',
          account_id: new ReferenceExpression(netsuiteSandbox123.elemID),
        },
      ],
      code: new ReferenceExpression(recipe6NetsuiteTypesCode.elemID),
    })

    const recipe7ZuoraCode = new InstanceElement('recipe7_code', codeType, {
      as: 'eadbb773',
      provider: 'zuora',
      name: 'updated_custom_object',
      keyword: 'trigger',
      dynamicPickListSelection: {
        object: 'AccountingPeriod',
      },
      input: {
        object: 'AccountingPeriod',
        since: "#{_('data.workato.job_context.user_id')}",
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
                operand: 'greater_than',
                lhs: "#{_('data.zuora.eadbb773.Name')}",
                rhs: '111111111',
                uuid: 'condition-uuid',
              },
            ],
          },
          block: [
            {
              number: 2,
              provider: 'zuora',
              name: 'update_record',
              as: 'efe25cd2',
              description:
                'Update <span class="provider">accounting code</span> in <span class="provider">Zuora</span>',
              keyword: 'action',
              dynamicPickListSelection: {
                object: 'Accounting Code',
              },
              input: {
                object: 'AccountingCode',
                Id: '=_(\'data.zuora.eadbb773.Notes\').split("123123123123")',
              },
              visible_config_fields: ['object', 'Fax'],
              uuid: 'uuid1',
            },
          ],
          uuid: 'uuid2',
        },
        {
          number: 3,
          provider: 'zuora',
          name: 'search_records',
          as: 'dac4bc89',
          description: 'Search <span class="provider">products</span> in <span class="provider">Zuora</span>',
          keyword: 'action',
          dynamicPickListSelection: {
            object: 'Product',
          },
          input: {
            object: 'Product',
            SKU: 'aaaaaa',
          },
          visible_config_fields: ['object', 'Fax', 'Description', 'County', 'UpdatedById', 'SKU', 'Name'],
          uuid: 'uuid3',
        },
      ],
    })

    const recipe7Zuora = new InstanceElement('recipe7', recipeType, {
      config: [
        {
          keyword: 'application',
          name: 'zuora',
          provider: 'zuora',
          account_id: new ReferenceExpression(zuoraSandbox.elemID),
        },
      ],
      code: new ReferenceExpression(recipe7ZuoraCode.elemID),
    })

    const recipe8JiraCode = new InstanceElement('recipe8_code', codeType, {
      as: 'recipe8id',
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
                lhs: "#{_('data.jira.recipe8id.Key')}",
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
              description: null,
              as: 'recipe8id_nested',
              keyword: 'action',
              dynamicPickListSelection: {
                priority: 'High',
              },
              input: {
                projectKey: 'PK2',
                issueType: 'Firstissuetype',
                sampleProjectKey: 'PK3',
                sampleIssueType: 'Subtask',
                summary: "#{_('data.jira.recipe8id.fields.summary')}",
              },
              visible_config_fields: ['project_issuetype', 'sample_project_issuetype'],
              uuid: 'uuid1',
            },
          ],
          uuid: 'uuid2',
        },
        {
          number: 3,
          provider: 'jira',
          name: 'update_issue',
          as: 'recipe8id_second',
          description: null,
          keyword: 'action',
          dynamicPickListSelection: {},
          input: {
            projectKey: 'PK1',
            issueType: 'Defaultissuetype',
            issuekey: 'issue key',
            reporter_id: "#{_('data.jira.recipe8id.fields.customfield_10027')}",
            description:
              "#{_('data.jira.recipe8id.fields.labels.first.label')} - #{_('data.jira.recipe8id.issues.first.fields.timespent')} - #{_('data.jira.recipe8id.issues.first.self')} - #{_('data.jira.recipe8id.fields.statuscategorychangedate')}",
          },
          uuid: 'uuid3',
        },
      ],
    })

    const recipe8Jira = new InstanceElement('recipe8', recipeType, {
      config: [
        {
          keyword: 'application',
          name: 'jira',
          provider: 'jira',
          account_id: new ReferenceExpression(jiraSandbox.elemID),
        },
      ],
      code: new ReferenceExpression(recipe8JiraCode.elemID),
    })

    const recipe9ZendeskCode = new InstanceElement('recipe9_code', codeType, {
      as: 'zendesk9id',
      provider: 'zendesk',
      name: 'new_ticket_polling',
      keyword: 'trigger',
      dynamicPickListSelection: {},
      input: {
        since: '2000-00-00T00:00:00-00:00',
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
                operand: 'greater_than',
                lhs: "#{_('data.zendesk.zendesk9id.priority')}",
                rhs: '111111111',
                uuid: 'condition-uuid',
              },
            ],
          },
          block: [
            {
              number: 2,
              provider: 'zendesk',
              name: 'update_ticket',
              as: 'recipe9id_nested',
              description:
                'Update <span class="provider">accounting code</span> in <span class="provider">Zendesk</span>',
              keyword: 'action',
              dynamicPickListSelection: {
                ticket_form_id: 'Premier Priority Ticket',
              },
              input: {
                macro_ids: {
                  more: 'string',
                  id: 10,
                },
                group_id: 11,
                brand_id: 'not a number', // check ID is number
                ticket_form_id: 1000, // check non exist ID
                status: 'my status',
                priority: 'very high',
                not_in_standard_fields: 'without reference', // check non exist standard field
                field_12: 'field 12 value 1',
                field_13: 4, // exist field with non exist value
                field_1001: 3, // non exist field with non exist value
                field_14: 'same value name', // exist field_ID with exist value same as user and organziation
                field_same: 'same', // exist field_key in organization and user. shouldnt referenced
              },
              visible_config_fields: ['object', 'Fax'],
              uuid: 'uuid1',
            },
          ],
          uuid: 'uuid2',
        },
        {
          number: 3,
          provider: 'zendesk',
          name: 'create_ticket',
          as: 'recipe9id_3',
          description: 'Search <span class="provider">products</span> in <span class="provider">Zendesk</span>',
          keyword: 'action',
          dynamicPickListSelection: {},
          input: {
            macro_ids: {
              more: 'string',
              id: 'not a number', // check ID is number
            },
            // check group_id undefined
            brand_id: 15,
            ticket_form_id: 16,
            field_12: 'field 12 value 2',
          },
          visible_config_fields: [],
          uuid: 'uuid3',
        },
        {
          number: 4,
          provider: 'zendesk',
          name: 'update_organization',
          as: 'recipe9id_4',
          description: 'Search <span class="provider">products</span> in <span class="provider">Zendesk</span>',
          keyword: 'action',
          dynamicPickListSelection: {},
          input: {
            field_organization_field_1: 'org field 1 value 1',
            field_organization_field_2: 'same value name', // exist field_key with exist value same as ticket and organziation
            field_organization_field_3: 4, // exist field_key with non exist value
            field_organization_field_1002: 4, // non exist field_key
            field_same: 'same', // exist field_key in ticket and user. should reference the organization field
          },
          visible_config_fields: [],
          uuid: 'uuid4',
        },
        {
          number: 5,
          provider: 'zendesk',
          name: 'update_user',
          as: 'recipe9id_5',
          description: 'Search <span class="provider">products</span> in <span class="provider">Zendesk</span>',
          keyword: 'action',
          dynamicPickListSelection: {},
          input: {
            field_user_field_1: 'user field 1 value 1',
            field_user_field_2: 'same value name', // exist field_key with exist value same as ticket and organziation
            field_user_field_3: 4, // exist field_key with non exist value
            field_user_field_1002: 4, // non exist field_key
            field_same: 'same', // exist field_key in ticket and organization. should reference the user field

            comment: `should referenced #{_('data.zendesk.recipe9id_nested.priority')}
                      should referenced #{_('data.zendesk.recipe9id_nested.status')}
                      should referenced #{_('data.zendesk.recipe9id_nested.custom_fields.field_100')}
                      should referenced #{_('data.zendesk.recipe9id_3.custom_fields.field_101')}
                      should referenced #{_('data.zendesk.recipe9id_4.organization_fields.field_org1')}
                      should referenced #{_('data.zendesk.recipe9id_4.organization_fields.field_field')}
                      should referenced #{_('data.zendesk.recipe9id_5.user_fields.field_user1')}
                      should referenced #{_('data.zendesk.recipe9id_5.user_fields.field_field')}
                      should referenced #{_('data.zendesk.recipe9id_3.users.first.user_fields.field_user1')} - user block with user field
                      `,
            comment2: `should not referenced #{_('data.zendesk.non_exist_block.priority')} - non-exist block
                       should not referenced #{_('data.zendesk.non_exist_block.organization_fields.field_field')} - non-exist block
                       should not referenced #{_('data.zendesk.recipe9id_4.status')} - not ticket block
                      `,
          },
          visible_config_fields: [],
          uuid: 'uuid5',
        },
      ],
    })

    const recipe9Zendesk = new InstanceElement('recipe9', recipeType, {
      config: [
        {
          keyword: 'application',
          name: 'zendesk',
          provider: 'zendesk',
          account_id: new ReferenceExpression(zendeskSandbox.elemID),
        },
      ],
      code: new ReferenceExpression(recipe9ZendeskCode.elemID),
    })

    return [
      connectionType,
      sfSandbox1,
      anotherSfSandbox,
      netsuiteSandbox123,
      zuoraSandbox,
      jiraSandbox,
      zendeskSandbox,
      secondarySalesforce,
      secondaryNetsuite,
      labelValueType,
      dynamicPickListSelectionType,
      inputType,
      nestedBlockTypeInner,
      nestedBlockType,
      blockType,
      codeType,
      recipeConfigType,
      recipeType,
      recipe1,
      recipe1code,
      recipe2WrongConnection,
      recipe2WrongConnectionCode,
      recipe3OnlyNetsuite,
      recipe3OnlyNetsuiteCode,
      recipe4UnknownSalesforceSobject,
      recipe4UnknownSalesforceSobjectCode,
      recipe5WithSecondary,
      recipe5WithSecondaryCode,
      recipe6NetsuiteTypes,
      recipe6NetsuiteTypesCode,
      recipe7Zuora,
      recipe7ZuoraCode,
      recipe8Jira,
      recipe8JiraCode,
      recipe9Zendesk,
      recipe9ZendeskCode,
    ]
  }

  const generateSalesforceElements = (): Element[] => {
    const opportunity = new ObjectType({
      elemID: new ElemID('salesforce', 'Opportunity'),
      fields: {
        Id: {
          refType: BuiltinTypes.STRING,
          annotations: {
            apiName: 'Opportunity.Id',
          },
        },
        Custom__c: {
          refType: BuiltinTypes.STRING,
          annotations: {
            apiName: 'Opportunity.Custom__c',
          },
        },
        Name: {
          refType: BuiltinTypes.STRING,
          annotations: {
            apiName: 'Opportunity.Name',
          },
        },
        FormulaRef1__c: {
          refType: BuiltinTypes.STRING,
          annotations: {
            apiName: 'Opportunity.FormulaRef1__c',
          },
        },
        FormulaRef2__c: {
          refType: BuiltinTypes.STRING,
          annotations: {
            apiName: 'Opportunity.FormulaRef2__c',
          },
        },
        FormulaRef3__c: {
          refType: BuiltinTypes.STRING,
          annotations: {
            apiName: 'Opportunity.FormulaRef3__c',
          },
        },
        FormulaRef4__c: {
          refType: BuiltinTypes.STRING,
          annotations: {
            apiName: 'Opportunity.FormulaRef4__c',
          },
        },
      },
      annotations: {
        metadataType: 'CustomObject',
        apiName: 'Opportunity',
        label: 'Opportunity',
      },
    })
    const user = new ObjectType({
      elemID: new ElemID('salesforce', 'User'),
      fields: {
        Field111__c: {
          refType: BuiltinTypes.NUMBER,
          annotations: {
            apiName: 'User.Field111__c',
          },
        },
        Field222__c: {
          refType: BuiltinTypes.NUMBER,
          annotations: {
            apiName: 'User.Field222__c',
          },
        },
        Name__c: {
          refType: BuiltinTypes.STRING,
          annotations: {
            apiName: 'User.Name__c',
          },
        },
      },
      annotations: {
        metadataType: 'CustomObject',
        apiName: 'User',
      },
    })
    const myCustom = new ObjectType({
      elemID: new ElemID('salesforce', 'MyCustom__c'),
      fields: {
        customField__c: { refType: BuiltinTypes.NUMBER },
      },
      annotations: {
        metadataType: 'CustomObject',
        apiName: 'MyCustom__c',
        label: 'My Custom',
      },
    })

    return [opportunity, user, myCustom]
  }
  const generateNetsuiteElements = (): Element[] => {
    const customRecordType = new ObjectType({
      elemID: new ElemID('netsuite', 'customrecord16'),
      fields: {
        custom_custrecord5: {
          refType: BuiltinTypes.STRING,
          annotations: { scriptid: 'custrecord5' },
        },
        custom_somethingelse: {
          refType: BuiltinTypes.STRING,
          annotations: { scriptid: 'somethingelse' },
        },
        custom_custrecordaccount_id: {
          refType: BuiltinTypes.STRING,
          annotations: { scriptid: 'custrecordaccount_id' },
        },
      },
      annotations: {
        scriptid: 'customrecord16',
        recordname: 'my custom record',
        metadataType: 'customrecordtype',
      },
    })

    const otherCustomFieldType = new ObjectType({
      elemID: new ElemID('netsuite', 'othercustomfield'),
      fields: {},
    })
    const otherCustomFieldInst = new InstanceElement('custrecord2', otherCustomFieldType, {
      scriptid: 'custrecord2',
      recordname: 'something',
    })

    const entitycustomfieldType = new ObjectType({
      elemID: new ElemID('netsuite', 'entitycustomfield'),
      fields: {},
    })
    const entitycustomfieldInst = new InstanceElement('custentitycustom_account_city', entitycustomfieldType, {
      scriptid: 'custentitycustom_account_city',
      appliestocontact: false,
      appliestocustomer: true,
      appliestoemployee: false,
    })

    const customerType = new ObjectType({
      elemID: new ElemID('netsuite', 'Customer'),
      fields: {
        companyName: { refType: BuiltinTypes.STRING },
      },
    })
    const opportunityType = new ObjectType({
      elemID: new ElemID('netsuite', 'Opportunity'),
      fields: {},
    })

    return [
      customRecordType,
      otherCustomFieldType,
      otherCustomFieldInst,
      entitycustomfieldType,
      entitycustomfieldInst,
      customerType,
      opportunityType,
    ]
  }

  const generateZuoraElements = (): Element[] => {
    const accountingPeriodType = new ObjectType({
      elemID: new ElemID('zuora_billing', 'accountingperiod'),
      fields: {
        Name: { refType: BuiltinTypes.STRING },
        Notes: { refType: BuiltinTypes.STRING },
        Id: { refType: BuiltinTypes.STRING },
      },
      annotations: {
        metadataType: 'StandardObject',
      },
    })

    const accountingCodeType = new ObjectType({
      elemID: new ElemID('zuora_billing', 'accountingcode'),
      fields: {
        Id: { refType: BuiltinTypes.STRING },
      },
      annotations: {
        metadataType: 'StandardObject',
      },
    })

    const productType = new ObjectType({
      elemID: new ElemID('zuora_billing', 'product'),
      fields: {
        SKU: { refType: BuiltinTypes.STRING },
      },
      annotations: {
        metadataType: 'StandardObject',
      },
    })

    return [accountingPeriodType, accountingCodeType, productType]
  }
  const generateJiraElements = (): Element[] => {
    const IssueType = new ObjectType({
      elemID: new ElemID('jira', 'IssueType'),
      fields: {
        id: { refType: BuiltinTypes.STRING },
        name: { refType: BuiltinTypes.STRING },
      },
    })

    const firstIssueTypeInst = new InstanceElement('FirstType', IssueType, {
      id: '10001',
      name: 'Firstissuetype',
    })
    const subTaskIssueTypeInst = new InstanceElement('Sub-task', IssueType, {
      id: '10002',
      name: 'Sub-task',
    })
    const defaultIssueTypeInst = new InstanceElement('ThirdType', IssueType, {
      id: '10003',
      name: 'Defaultissuetype',
    })
    const projectType = new ObjectType({
      elemID: new ElemID('jira', 'Project'),
      fields: {
        id: { refType: BuiltinTypes.STRING },
        name: { refType: BuiltinTypes.STRING },
        key: { refType: BuiltinTypes.STRING },
      },
    })
    const project1Inst = new InstanceElement('project1', projectType, {
      id: '30001',
      name: 'Project1Name',
      key: 'PK1',
    })
    const project2Inst = new InstanceElement('project2', projectType, {
      id: '30002',
      name: 'Project2Name',
      key: 'PK2',
    })
    const project3Inst = new InstanceElement('project3', projectType, {
      id: '30003',
      name: 'Project3Name',
      key: 'PK3',
    })
    const fieldType = new ObjectType({
      elemID: new ElemID('jira', 'Field'),
      fields: {
        id: { refType: BuiltinTypes.STRING },
        name: { refType: BuiltinTypes.STRING },
      },
    })
    const regularField = new InstanceElement('Summary', fieldType, {
      id: 'summary',
      name: 'summary',
    })
    const customField = new InstanceElement('LockedForms', fieldType, {
      id: 'customfield_10027',
      name: 'Locked forms',
    })
    const inIssueField = new InstanceElement('Timespent', fieldType, {
      id: 'timespent',
      name: 'Timespent',
    })
    const withSpacesField = new InstanceElement('StatusCategoryChange', fieldType, {
      id: 'statuscategorychangedate',
      name: 'Status Category Changed',
    })
    const arrayField = new InstanceElement('Lables', fieldType, {
      id: 'labels',
      name: 'Lables',
    })

    return [
      IssueType,
      firstIssueTypeInst,
      subTaskIssueTypeInst,
      defaultIssueTypeInst,
      projectType,
      project1Inst,
      project2Inst,
      project3Inst,
      fieldType,
      regularField,
      customField,
      inIssueField,
      withSpacesField,
      arrayField,
    ]
  }

  const generateZendeskElements = (): Element[] => {
    const ticketOptionType = new ObjectType({
      elemID: new ElemID('zendesk', 'ticket_field__custom_field_options'),
      fields: {
        id: { refType: BuiltinTypes.NUMBER },
        value: { refType: BuiltinTypes.STRING },
      },
    })

    const ticketFieldType = new ObjectType({
      elemID: new ElemID('zendesk', 'ticket_field'),
      fields: {
        id: { refType: BuiltinTypes.NUMBER },
        type: { refType: BuiltinTypes.STRING },
        key: { refType: BuiltinTypes.STRING },
        raw_title: { refType: BuiltinTypes.STRING },
        custom_field_options: { refType: new ListType(BuiltinTypes.NUMBER) },
      },
    })

    const organizationOptionType = new ObjectType({
      elemID: new ElemID('zendesk', 'organization_field__custom_field_options'),
      fields: {
        id: { refType: BuiltinTypes.NUMBER },
        value: { refType: BuiltinTypes.STRING },
      },
    })

    const organizationFieldType = new ObjectType({
      elemID: new ElemID('zendesk', 'organization_field'),
      fields: {
        id: { refType: BuiltinTypes.NUMBER },
        key: { refType: BuiltinTypes.STRING },
        custom_field_options: { refType: new ListType(BuiltinTypes.NUMBER) },
      },
    })

    const userOptionType = new ObjectType({
      elemID: new ElemID('zendesk', 'user_field__custom_field_options'),
      fields: {
        id: { refType: BuiltinTypes.NUMBER },
        value: { refType: BuiltinTypes.STRING },
      },
    })

    const userFieldType = new ObjectType({
      elemID: new ElemID('zendesk', 'user_field'),
      fields: {
        id: { refType: BuiltinTypes.NUMBER },
        key: { refType: BuiltinTypes.STRING },
        custom_field_options: { refType: new ListType(BuiltinTypes.NUMBER) },
      },
    })

    const macroType = new ObjectType({
      elemID: new ElemID('zendesk', 'macro'),
      fields: {
        id: { refType: BuiltinTypes.NUMBER },
      },
    })

    const groupType = new ObjectType({
      elemID: new ElemID('zendesk', 'group'),
      fields: {
        id: { refType: BuiltinTypes.NUMBER },
      },
    })

    const brandType = new ObjectType({
      elemID: new ElemID('zendesk', 'brand'),
      fields: {
        id: { refType: BuiltinTypes.NUMBER },
      },
    })

    const ticketFormType = new ObjectType({
      elemID: new ElemID('zendesk', 'ticket_form'),
      fields: {
        id: { refType: BuiltinTypes.NUMBER },
        default: { refType: BuiltinTypes.BOOLEAN },
        ticket_field_ids: { refType: new ListType(BuiltinTypes.NUMBER) },
      },
    })

    const macroInst = new InstanceElement('macroInstName', macroType, { id: 10 })

    const groupInst = new InstanceElement('groupInstName', groupType, { id: 11 })

    const brandInst = new InstanceElement('brandInstName', brandType, { id: 15 })

    const ticketFormInst = new InstanceElement('ticketFormInstName', ticketFormType, { id: 16, default: false })

    const ticketFieldPriority = new InstanceElement('priority', ticketFieldType, {
      id: 1,
      type: 'priority',
      raw_title: 'Priority',
    })

    const ticketFieldStatus = new InstanceElement('status', ticketFieldType, {
      id: 2,
      type: 'status',
      raw_title: 'Status',
    })

    const defaultTicketFormInst = new InstanceElement('defaultTicketFormInstName', ticketFormType, {
      id: 17,
      default: true,
      ticket_field_ids: [
        new ReferenceExpression(ticketFieldStatus.elemID, ticketFieldStatus),
        new ReferenceExpression(ticketFieldPriority.elemID, ticketFieldPriority),
      ],
    })

    const ticketField12Option1 = new InstanceElement('ticketField12Option1Name', ticketOptionType, {
      id: 121,
      value: 'field 12 value 1',
    })

    const ticketField12Option2 = new InstanceElement('ticketField12Option2Name', ticketOptionType, {
      id: 122,
      value: 'field 12 value 2',
    })

    const ticketField12 = new InstanceElement('ticketField12Name', ticketFieldType, {
      id: 12,
      custom_field_options: [
        new ReferenceExpression(ticketField12Option1.elemID, ticketField12Option1),
        new ReferenceExpression(ticketField12Option2.elemID, ticketField12Option2),
      ],
    })

    const ticketField13 = new InstanceElement('ticketField13Name', ticketFieldType, {
      id: 13,
    })

    const ticketField14Option = new InstanceElement('ticketField14OptionName', ticketOptionType, {
      id: 141,
      value: 'same value name',
    })

    const ticketField14 = new InstanceElement('ticketField14Name', ticketFieldType, {
      id: 14,
      custom_field_options: [new ReferenceExpression(ticketField14Option.elemID, ticketField14Option)],
    })

    const ticketFieldSame = new InstanceElement('ticketFieldSameName', ticketFieldType, {
      id: 0,
      key: 'same',
    })

    const organizationField1Option = new InstanceElement('organizationField1OptionName', organizationOptionType, {
      id: 311,
      value: 'org field 1 value 1',
    })

    const organizationField1 = new InstanceElement('organizationField1Name', organizationFieldType, {
      id: 31,
      key: 'organization_field_1',
      custom_field_options: [new ReferenceExpression(organizationField1Option.elemID, organizationField1Option)],
    })

    const organizationField2Option = new InstanceElement('organizationField2OptionName', organizationOptionType, {
      id: 321,
      value: 'same value name',
    })

    const organizationField2 = new InstanceElement('organizationField2Name', organizationFieldType, {
      id: 32,
      key: 'organization_field_2',
      custom_field_options: [new ReferenceExpression(organizationField2Option.elemID, organizationField2Option)],
    })

    const organizationField3 = new InstanceElement('organizationField3Name', organizationFieldType, {
      id: 33,
      key: 'organization_field_3',
    })

    const organizationFieldSameOption = new InstanceElement('organizationFieldSameOptionName', organizationOptionType, {
      id: 341,
      value: 'same',
    })

    const organizationFieldSame = new InstanceElement('organizationFieldSameName', organizationFieldType, {
      id: 34,
      key: 'same',
      custom_field_options: [new ReferenceExpression(organizationFieldSameOption.elemID, organizationFieldSameOption)],
    })

    const userField1Option = new InstanceElement('userField1OptionName', userOptionType, {
      id: 411,
      value: 'user field 1 value 1',
    })

    const userField1 = new InstanceElement('userField1Name', userFieldType, {
      id: 41,
      key: 'user_field_1',
      custom_field_options: [new ReferenceExpression(userField1Option.elemID, userField1Option)],
    })

    const userField2Option = new InstanceElement('userField2OptionName', userOptionType, {
      id: 421,
      value: 'same value name',
    })

    const userField2 = new InstanceElement('userField2Name', userFieldType, {
      id: 42,
      key: 'user_field_2',
      custom_field_options: [new ReferenceExpression(userField2Option.elemID, userField2Option)],
    })

    const userField3 = new InstanceElement('userField3Name', userFieldType, {
      id: 43,
      key: 'user_field_3',
    })

    const userFieldSameOption = new InstanceElement('userFieldSameOptionName', userOptionType, {
      id: 441,
      value: 'same',
    })

    const userFieldSame = new InstanceElement('userFieldSameName', userFieldType, {
      id: 44,
      key: 'same',
      custom_field_options: [new ReferenceExpression(userFieldSameOption.elemID, userFieldSameOption)],
    })

    return [
      ticketOptionType,
      ticketFieldType,
      organizationOptionType,
      organizationFieldType,
      userOptionType,
      userFieldType,
      macroType,
      groupType,
      brandType,
      ticketFormType,
      macroInst,
      groupInst,
      brandInst,
      ticketFormInst,
      ticketFieldPriority,
      ticketFieldStatus,
      defaultTicketFormInst,
      ticketField12Option1,
      ticketField12Option2,
      ticketField12,
      ticketField13,
      ticketField14Option,
      ticketField14,
      ticketFieldSame,
      organizationField1Option,
      organizationField1,
      organizationField2Option,
      organizationField2,
      organizationField3,
      organizationFieldSameOption,
      organizationFieldSame,
      userField1Option,
      userField1,
      userField2Option,
      userField2,
      userField3,
      userFieldSameOption,
      userFieldSame,
    ]
  }

  describe('on post-fetch primary', () => {
    let currentAdapterElements: Element[]
    let salesforceElements: Element[]
    let netsuiteElements: Element[]
    let zuoraElements: Element[]
    let jiraElements: Element[]
    let zendeskElements: Element[]

    beforeAll(async () => {
      filter = filterCreator({
        client,
        paginator: clientUtils.createPaginator({
          client,
          paginationFuncCreator: paginate,
        }),
        config: {
          fetch: {
            ...getDefaultConfig()[FETCH_CONFIG],
            serviceConnectionNames: {
              salesforce: ['salesforce sandbox 1'],
              netsuite: ['netsuite sbx 123'],
              zuora_billing: ['zuora sbx 123'],
              jira: ['jira sbx 123'],
              zendesk: ['zendesk sbx 123'],
            },
          },
          apiDefinitions: {
            typeDefaults: {
              transformation: {
                idFields: DEFAULT_ID_FIELDS,
              },
            },
            types: DEFAULT_TYPES,
            supportedTypes: SUPPORTED_TYPES,
          },
        },
        fetchQuery: elementUtils.query.createMockQuery(),
      }) as FilterType

      currentAdapterElements = generateCurrentAdapterElements()
      salesforceElements = generateSalesforceElements()
      netsuiteElements = generateNetsuiteElements()
      zuoraElements = generateZuoraElements()
      jiraElements = generateJiraElements()
      zendeskElements = generateZendeskElements()
      await filter.onPostFetch({
        currentAdapterElements,
        elementsByAccount: {
          salesforce: salesforceElements,
          netsuite: netsuiteElements,
          zuora_billing: zuoraElements,
          jira: jiraElements,
          zendesk: zendeskElements,
        },
        accountToServiceNameMap: {
          zuora_billing: 'zuora_billing',
          salesforce: 'salesforce',
          netsuite: 'netsuite',
          jira: 'jira',
          zendesk: 'zendesk',
        },
        progressReporter: { reportProgress: () => null },
      })
    })

    describe('recipe1', () => {
      it('should show all resolved references in the _generated_dependencies annotation, in alphabetical order', () => {
        const recipeCode = currentAdapterElements.find(
          e => e.elemID.getFullName() === 'workato.recipe__code.instance.recipe1_code',
        )
        expect(recipeCode).toBeDefined()
        expect(recipeCode?.annotations?.[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toBeDefined()
        expect(recipeCode?.annotations?.[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toHaveLength(19)
        expect(recipeCode?.annotations?.[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES].map(dereferenceDep)).toEqual([
          {
            reference: 'netsuite.customrecord16',
            occurrences: [{ location: 'workato.recipe__code.instance.recipe1_code.block.0', direction: 'output' }],
          },
          {
            reference: 'netsuite.customrecord16.field.custom_custrecord5',
            occurrences: [
              { location: 'workato.recipe__code.instance.recipe1_code.input.Custom__c', direction: 'input' },
            ],
          },
          {
            reference: 'netsuite.customrecord16.field.custom_custrecordaccount_id',
            occurrences: [
              { location: 'workato.recipe__code.instance.recipe1_code.input.Custom__c', direction: 'input' },
            ],
          },
          {
            reference: 'netsuite.entitycustomfield.instance.custentitycustom_account_city',
            occurrences: [
              { location: 'workato.recipe__code.instance.recipe1_code.input.Custom__c', direction: 'input' },
            ],
          },
          {
            reference: 'netsuite.othercustomfield.instance.custrecord2',
            occurrences: [{ location: 'workato.recipe__code.instance.recipe1_code.block.0', direction: 'output' }],
          },
          {
            reference: 'salesforce.MyCustom__c',
            occurrences: [
              { location: 'workato.recipe__code.instance.recipe1_code.block.0.block.0', direction: 'output' },
            ],
          },
          {
            reference: 'salesforce.MyCustom__c.field.customField__c',
            occurrences: [
              { location: 'workato.recipe__code.instance.recipe1_code.block.0.block.0', direction: 'output' },
            ],
          },
          {
            reference: 'salesforce.Opportunity',
            occurrences: [{ location: 'workato.recipe__code.instance.recipe1_code', direction: 'input' }],
          },
          {
            reference: 'salesforce.Opportunity.field.Custom__c',
            occurrences: [{ location: 'workato.recipe__code.instance.recipe1_code', direction: 'input' }],
          },
          {
            reference: 'salesforce.Opportunity.field.FormulaRef1__c',
            occurrences: [
              {
                location: 'workato.recipe__code.instance.recipe1_code.block.0.block.0.input.customField__c',
                direction: 'input',
              },
            ],
          },
          {
            reference: 'salesforce.Opportunity.field.FormulaRef2__c',
            occurrences: [
              {
                location: 'workato.recipe__code.instance.recipe1_code.block.0.block.0.input.something1',
                direction: 'input',
              },
            ],
          },
          {
            reference: 'salesforce.Opportunity.field.FormulaRef3__c',
            occurrences: [
              {
                location: 'workato.recipe__code.instance.recipe1_code.block.0.block.0.input.something2',
                direction: 'input',
              },
            ],
          },
          {
            reference: 'salesforce.Opportunity.field.FormulaRef4__c',
            occurrences: [
              {
                location: 'workato.recipe__code.instance.recipe1_code.block.0.block.0.input.getCustomObject',
                direction: 'input',
              },
            ],
          },
          {
            reference: 'salesforce.Opportunity.field.Id',
            occurrences: [{ location: 'workato.recipe__code.instance.recipe1_code', direction: 'input' }],
          },
          {
            reference: 'salesforce.Opportunity.field.Name',
            occurrences: [{ location: 'workato.recipe__code.instance.recipe1_code', direction: 'input' }],
          },
          {
            reference: 'salesforce.User',
            occurrences: [
              { location: 'workato.recipe__code.instance.recipe1_code', direction: 'input' },
              {
                location: 'workato.recipe__code.instance.recipe1_code.block.0.block.0.input.unknown1',
                direction: 'input',
              },
            ],
          },
          {
            reference: 'salesforce.User.field.Field111__c',
            occurrences: [{ location: 'workato.recipe__code.instance.recipe1_code', direction: 'input' }],
          },
          {
            reference: 'salesforce.User.field.Field222__c',
            occurrences: [
              {
                location: 'workato.recipe__code.instance.recipe1_code.block.0.block.0.input.something3',
                direction: 'input',
              },
            ],
          },
          {
            reference: 'salesforce.User.field.Name__c',
            occurrences: [
              {
                location: 'workato.recipe__code.instance.recipe1_code.block.0.block.0.input.getCustomObject',
                direction: 'input',
              },
            ],
          },
        ])
      })

      it('should resolve references in-place where possible', () => {
        const recipeCode = currentAdapterElements.find(
          e => e.elemID.getFullName() === 'workato.recipe__code.instance.recipe1_code',
        ) as InstanceElement
        expect(recipeCode).toBeInstanceOf(InstanceElement)
        expect(recipeCode.value.input.sobject_name).toBeInstanceOf(ReferenceExpression)
        expect(recipeCode.value.input.sobject_name.elemID.getFullName()).toEqual('salesforce.Opportunity')
        expect(recipeCode.value.dynamicPickListSelection.sobject_name).toBeInstanceOf(ReferenceExpression)
        expect(recipeCode.value.dynamicPickListSelection.sobject_name.elemID.getFullName()).toEqual(
          'salesforce.Opportunity',
        )
        expect(recipeCode.value.dynamicPickListSelection.field_list).toHaveLength(5)
        // some, but not all, references are resolved
        expect(recipeCode.value.dynamicPickListSelection.field_list.every(isReferenceExpression)).toBeFalsy()
        expect(recipeCode.value.dynamicPickListSelection.field_list.some(isReferenceExpression)).toBeTruthy()
        expect(recipeCode.value.dynamicPickListSelection.field_list[0].elemID.getFullName()).toEqual(
          'salesforce.Opportunity.field.Id',
        )
        expect(recipeCode.value.dynamicPickListSelection.field_list[1]).toEqual({
          label: 'Account ID',
          value: 'AccountId',
        })
        expect(recipeCode.value.dynamicPickListSelection.field_list[2].elemID.getFullName()).toEqual(
          'salesforce.Opportunity.field.Name',
        )
        expect(recipeCode.value.dynamicPickListSelection.field_list[3].elemID.getFullName()).toEqual(
          'salesforce.Opportunity.field.Custom__c',
        )
        expect(recipeCode.value.dynamicPickListSelection.field_list[4].elemID.getFullName()).toEqual(
          'salesforce.User.field.Field111__c',
        )
        expect(recipeCode.value.dynamicPickListSelection.table_list).toHaveLength(3)
        // some, but not all, references are resolved
        expect(recipeCode.value.dynamicPickListSelection.table_list.every(isReferenceExpression)).toBeFalsy()
        expect(recipeCode.value.dynamicPickListSelection.table_list.some(isReferenceExpression)).toBeTruthy()
        expect(recipeCode.value.dynamicPickListSelection.table_list[0]).toEqual({
          label: 'Price Book',
          value: 'Pricebook2',
        })
        expect(recipeCode.value.dynamicPickListSelection.table_list[1].elemID.getFullName()).toEqual('salesforce.User')
        expect(recipeCode.value.dynamicPickListSelection.table_list[2]).toEqual({ label: 'Account', value: 'Account' })
      })
      it('should resolve references in-place in nested blocks', () => {
        const recipeCode = currentAdapterElements.find(
          e => e.elemID.getFullName() === 'workato.recipe__code.instance.recipe1_code',
        ) as InstanceElement
        expect(recipeCode).toBeInstanceOf(InstanceElement)
        const block1 = recipeCode.value.block[0]
        expect(block1.input.netsuite_object).toBeInstanceOf(ReferenceExpression)
        expect(block1.input.netsuite_object.elemID.getFullName()).toEqual('netsuite.customrecord16')
        const block2 = block1.block[0]
        expect(block2.input.sobject_name).toBeInstanceOf(ReferenceExpression)
        expect(block2.input.sobject_name.elemID.getFullName()).toEqual('salesforce.MyCustom__c')
      })
    })

    describe('recipe2WrongConnection', () => {
      it('should not have any _generated_dependencies', () => {
        const recipeCode = currentAdapterElements.find(
          e => e.elemID.getFullName() === 'workato.recipe__code.instance.recipe2_code',
        )
        expect(recipeCode).toBeDefined()
        expect(recipeCode?.annotations?.[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toBeUndefined()
      })

      it('should be identical to the original generated element', () => {
        const recipeCode = currentAdapterElements.find(
          e => e.elemID.getFullName() === 'workato.recipe__code.instance.recipe2_code',
        ) as InstanceElement
        const origRecipeCode = generateCurrentAdapterElements().find(
          e => e.elemID.getFullName() === 'workato.recipe__code.instance.recipe2_code',
        ) as InstanceElement
        expect(origRecipeCode.isEqual(recipeCode)).toBeTruthy()
      })
    })

    describe('recipe3OnlyNetsuite', () => {
      it('should show all netsuite resolved references in the _generated_dependencies annotation', () => {
        const recipeCode = currentAdapterElements.find(
          e => e.elemID.getFullName() === 'workato.recipe__code.instance.recipe3_code',
        )
        expect(recipeCode).toBeDefined()
        expect(recipeCode?.annotations?.[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toBeDefined()
        expect(recipeCode?.annotations?.[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toHaveLength(5)
        expect(recipeCode?.annotations?.[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES].map(dereferenceDep)).toEqual([
          {
            reference: 'netsuite.customrecord16',
            occurrences: [{ location: 'workato.recipe__code.instance.recipe3_code.block.0', direction: 'output' }],
          },
          {
            reference: 'netsuite.customrecord16.field.custom_custrecord5',
            occurrences: [
              { location: 'workato.recipe__code.instance.recipe3_code.input.Custom__c', direction: 'input' },
            ],
          },
          {
            reference: 'netsuite.customrecord16.field.custom_custrecordaccount_id',
            occurrences: [
              { location: 'workato.recipe__code.instance.recipe3_code.input.Custom__c', direction: 'input' },
            ],
          },
          {
            reference: 'netsuite.entitycustomfield.instance.custentitycustom_account_city',
            occurrences: [
              { location: 'workato.recipe__code.instance.recipe3_code.input.Custom__c', direction: 'input' },
            ],
          },
          {
            reference: 'netsuite.othercustomfield.instance.custrecord2',
            occurrences: [{ location: 'workato.recipe__code.instance.recipe3_code.block.0', direction: 'output' }],
          },
        ])
      })

      it('should not resolve any salesforce references in-place', () => {
        const recipeCode = currentAdapterElements.find(
          e => e.elemID.getFullName() === 'workato.recipe__code.instance.recipe3_code',
        ) as InstanceElement
        expect(recipeCode).toBeInstanceOf(InstanceElement)
        expect(recipeCode.value.input.sobject_name).toEqual('Opportunity')
        expect(recipeCode.value.dynamicPickListSelection.sobject_name).toEqual('Opportunity')
        expect(recipeCode.value.dynamicPickListSelection.field_list).toHaveLength(5)
        expect(recipeCode.value.dynamicPickListSelection.field_list.some(isReferenceExpression)).toBeFalsy()
        expect(recipeCode.value.dynamicPickListSelection.table_list.some(isReferenceExpression)).toBeFalsy()
        const block2 = recipeCode.value.block[0].block[0]
        expect(block2.input.sobject_name).toEqual('MyCustom__c')
      })
      it('should resolve references in-place in nested netsuite block', () => {
        const recipeCode = currentAdapterElements.find(
          e => e.elemID.getFullName() === 'workato.recipe__code.instance.recipe3_code',
        ) as InstanceElement
        expect(recipeCode).toBeInstanceOf(InstanceElement)
        const block1 = recipeCode.value.block[0]
        expect(block1.input.netsuite_object).toBeInstanceOf(ReferenceExpression)
        expect(block1.input.netsuite_object.elemID.getFullName()).toEqual('netsuite.customrecord16')
      })
    })

    describe('recipe4UnknownSalesforceSobject', () => {
      it('should not have any _generated_dependencies', () => {
        const recipeCode = currentAdapterElements.find(
          e => e.elemID.getFullName() === 'workato.recipe__code.instance.recipe4_code',
        )
        expect(recipeCode).toBeDefined()
        expect(recipeCode?.annotations?.[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toBeUndefined()
      })

      it('should not resolve any references in-place', () => {
        const recipeCode = currentAdapterElements.find(
          e => e.elemID.getFullName() === 'workato.recipe__code.instance.recipe4_code',
        ) as InstanceElement
        expect(recipeCode).toBeInstanceOf(InstanceElement)
        expect(recipeCode.value.input.sobject_name).toEqual('Unknown')
        expect(recipeCode.value.dynamicPickListSelection.sobject_name).toEqual('Unknown')
        expect(recipeCode.value.dynamicPickListSelection.field_list).toHaveLength(4)
        expect(recipeCode.value.dynamicPickListSelection.field_list.some(isReferenceExpression)).toBeFalsy()
        expect(recipeCode.value.dynamicPickListSelection.table_list.some(isReferenceExpression)).toBeFalsy()
      })
    })
    describe('recipe5WithSecondaryCode', () => {
      it('should only have _generated_dependencies for blocks that are not using the secondary connections', () => {
        const recipeCode = currentAdapterElements.find(
          e => e.elemID.getFullName() === 'workato.recipe__code.instance.recipe5_code',
        )
        expect(recipeCode).toBeDefined()
        expect(recipeCode?.annotations?.[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toBeDefined()
        expect(recipeCode?.annotations?.[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toHaveLength(2)
        expect(recipeCode?.annotations?.[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES].map(dereferenceDep)).toEqual([
          {
            reference: 'salesforce.MyCustom__c',
            occurrences: [
              { location: 'workato.recipe__code.instance.recipe5_code.block.0.block.0', direction: 'output' },
            ],
          },
          {
            reference: 'salesforce.MyCustom__c.field.customField__c',
            occurrences: [
              { location: 'workato.recipe__code.instance.recipe5_code.block.0.block.0', direction: 'output' },
            ],
          },
        ])
      })
    })
    describe('recipe6NetsuiteTypes', () => {
      it('should show all resolved references in the _generated_dependencies annotation, in alphabetical order', () => {
        const recipeCode = currentAdapterElements.find(
          e => e.elemID.getFullName() === 'workato.recipe__code.instance.recipe6_code',
        )
        expect(recipeCode).toBeDefined()
        expect(recipeCode?.annotations?.[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toBeDefined()
        expect(recipeCode?.annotations?.[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toHaveLength(3)
        expect(recipeCode?.annotations?.[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES].map(dereferenceDep)).toEqual([
          {
            reference: 'netsuite.Customer',
            occurrences: [{ location: 'workato.recipe__code.instance.recipe6_code', direction: 'input' }],
          },
          {
            reference: 'netsuite.Customer.field.companyName',
            occurrences: [{ location: 'workato.recipe__code.instance.recipe6_code', direction: 'input' }],
          },
          {
            reference: 'netsuite.Opportunity',
            occurrences: [{ location: 'workato.recipe__code.instance.recipe6_code.block.0', direction: 'output' }],
          },
        ])
      })

      it('should resolve references in-place where possible', () => {
        const recipeCode = currentAdapterElements.find(
          e => e.elemID.getFullName() === 'workato.recipe__code.instance.recipe6_code',
        ) as InstanceElement
        expect(recipeCode).toBeInstanceOf(InstanceElement)
        expect(recipeCode.value.input.netsuite_object).toBeInstanceOf(ReferenceExpression)
        expect(recipeCode.value.input.netsuite_object.elemID.getFullName()).toEqual('netsuite.Customer')
        // TODO decide if should also override under dynamicPickListSelection
      })
    })

    describe('recipe7Zuora', () => {
      it('should show all resolved references in the _generated_dependencies annotation, in alphabetical order', () => {
        const recipeCode = currentAdapterElements.find(
          e => e.elemID.getFullName() === 'workato.recipe__code.instance.recipe7_code',
        )
        expect(recipeCode).toBeDefined()
        expect(recipeCode?.annotations?.[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toBeDefined()
        expect(recipeCode?.annotations?.[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toHaveLength(7)
        expect(recipeCode?.annotations?.[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES].map(dereferenceDep)).toEqual([
          {
            reference: 'zuora_billing.accountingcode',
            occurrences: [
              { location: 'workato.recipe__code.instance.recipe7_code.block.0.block.0', direction: 'output' },
            ],
          },
          {
            reference: 'zuora_billing.accountingcode.field.Id',
            occurrences: [
              { location: 'workato.recipe__code.instance.recipe7_code.block.0.block.0', direction: 'output' },
            ],
          },
          {
            reference: 'zuora_billing.accountingperiod',
            occurrences: [{ location: 'workato.recipe__code.instance.recipe7_code', direction: 'input' }],
          },
          {
            reference: 'zuora_billing.accountingperiod.field.Name',
            occurrences: [
              {
                location: 'workato.recipe__code.instance.recipe7_code.block.0.input.conditions.0.lhs',
                direction: 'input',
              },
            ],
          },
          {
            reference: 'zuora_billing.accountingperiod.field.Notes',
            occurrences: [
              { location: 'workato.recipe__code.instance.recipe7_code.block.0.block.0.input.Id', direction: 'input' },
            ],
          },
          {
            reference: 'zuora_billing.product',
            occurrences: [{ location: 'workato.recipe__code.instance.recipe7_code.block.1', direction: 'output' }],
          },
          {
            reference: 'zuora_billing.product.field.SKU',
            occurrences: [{ location: 'workato.recipe__code.instance.recipe7_code.block.1', direction: 'output' }],
          },
        ])
      })

      it('should resolve references in-place where possible', () => {
        const recipeCode = currentAdapterElements.find(
          e => e.elemID.getFullName() === 'workato.recipe__code.instance.recipe7_code',
        ) as InstanceElement
        expect(recipeCode).toBeInstanceOf(InstanceElement)
        expect(recipeCode.value.input.object).toBeInstanceOf(ReferenceExpression)
        expect(recipeCode.value.input.object.elemID.getFullName()).toEqual('zuora_billing.accountingperiod')
        expect(recipeCode.value.input.object).toBeInstanceOf(ReferenceExpression)
        expect(recipeCode.value.input.object.elemID.getFullName()).toEqual('zuora_billing.accountingperiod')
        expect(recipeCode.value.block[0].block[0].input.object).toBeInstanceOf(ReferenceExpression)
        expect(recipeCode.value.block[0].block[0].input.object.elemID.getFullName()).toEqual(
          'zuora_billing.accountingcode',
        )
        expect(recipeCode.value.block[1].input.object).toBeInstanceOf(ReferenceExpression)
        expect(recipeCode.value.block[1].input.object.elemID.getFullName()).toEqual('zuora_billing.product')
      })
    })

    describe('recipe8Jira', () => {
      it('should show all resolved references in the _generated_dependencies annotation, in alphabetical order', () => {
        const recipeCode = currentAdapterElements.find(
          e => e.elemID.getFullName() === 'workato.recipe__code.instance.recipe8_code',
        )
        expect(recipeCode).toBeDefined()
        expect(recipeCode?.annotations?.[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toBeDefined()
        expect(recipeCode?.annotations?.[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toHaveLength(11)
        expect(recipeCode?.annotations?.[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES].map(dereferenceDep)).toEqual([
          {
            reference: 'jira.Field.instance.Lables',
            occurrences: [
              { location: 'workato.recipe__code.instance.recipe8_code.block.1.input.description', direction: 'input' },
            ],
          },
          {
            reference: 'jira.Field.instance.LockedForms',
            occurrences: [
              { location: 'workato.recipe__code.instance.recipe8_code.block.1.input.reporter_id', direction: 'input' },
            ],
          },
          {
            reference: 'jira.Field.instance.StatusCategoryChange',
            occurrences: [
              { location: 'workato.recipe__code.instance.recipe8_code.block.1.input.description', direction: 'input' },
            ],
          },
          {
            reference: 'jira.Field.instance.Summary',
            occurrences: [
              {
                location: 'workato.recipe__code.instance.recipe8_code.block.0.block.0.input.summary',
                direction: 'input',
              },
            ],
          },
          {
            reference: 'jira.Field.instance.Timespent',
            occurrences: [
              { location: 'workato.recipe__code.instance.recipe8_code.block.1.input.description', direction: 'input' },
            ],
          },
          {
            reference: 'jira.IssueType.instance.FirstType',
            occurrences: [
              { location: 'workato.recipe__code.instance.recipe8_code.block.0.block.0', direction: 'output' },
            ],
          },
          {
            reference: 'jira.IssueType.instance.Sub-task',
            occurrences: [
              { location: 'workato.recipe__code.instance.recipe8_code.block.0.block.0', direction: 'output' },
            ],
          },
          {
            reference: 'jira.IssueType.instance.ThirdType',
            occurrences: [{ location: 'workato.recipe__code.instance.recipe8_code.block.1', direction: 'output' }],
          },
          {
            reference: 'jira.Project.instance.project1',
            occurrences: [{ location: 'workato.recipe__code.instance.recipe8_code.block.1', direction: 'output' }],
          },
          {
            reference: 'jira.Project.instance.project2',
            occurrences: [
              { location: 'workato.recipe__code.instance.recipe8_code.block.0.block.0', direction: 'output' },
            ],
          },
          {
            reference: 'jira.Project.instance.project3',
            occurrences: [
              { location: 'workato.recipe__code.instance.recipe8_code.block.0.block.0', direction: 'output' },
            ],
          },
        ])
      })

      it('should resolve references in-place where possible', () => {
        const recipeCode = currentAdapterElements.find(
          e => e.elemID.getFullName() === 'workato.recipe__code.instance.recipe8_code',
        ) as InstanceElement
        expect(recipeCode).toBeInstanceOf(InstanceElement)
        const innerBlock = recipeCode.value.block[0].block[0]
        const secondBlock = recipeCode.value.block[1]

        expect(innerBlock.input.projectKey).toBeInstanceOf(ReferenceExpression)
        expect(innerBlock.input.projectKey.elemID.getFullName()).toEqual('jira.Project.instance.project2')
        expect(innerBlock.input.issueType).toBeInstanceOf(ReferenceExpression)
        expect(innerBlock.input.issueType.elemID.getFullName()).toEqual('jira.IssueType.instance.FirstType')

        expect(innerBlock.input.sampleProjectKey).toBeInstanceOf(ReferenceExpression)
        expect(innerBlock.input.sampleProjectKey.elemID.getFullName()).toEqual('jira.Project.instance.project3')
        expect(innerBlock.input.sampleIssueType).toBeInstanceOf(ReferenceExpression)
        expect(innerBlock.input.sampleIssueType.elemID.getFullName()).toEqual('jira.IssueType.instance.Sub-task')

        expect(secondBlock.input.projectKey).toBeInstanceOf(ReferenceExpression)
        expect(secondBlock.input.projectKey.elemID.getFullName()).toEqual('jira.Project.instance.project1')
        expect(secondBlock.input.issueType).toBeInstanceOf(ReferenceExpression)
        expect(secondBlock.input.issueType.elemID.getFullName()).toEqual('jira.IssueType.instance.ThirdType')
      })
    })

    describe('recipe9Zendesk', () => {
      it('should show all resolved references in the _generated_dependencies annotation, in alphabetical order', () => {
        const recipeCode = currentAdapterElements.find(
          e => e.elemID.getFullName() === 'workato.recipe__code.instance.recipe9_code',
        )
        expect(recipeCode).toBeDefined()
        expect(recipeCode?.annotations?.[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toBeDefined()
        expect(recipeCode?.annotations?.[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toHaveLength(24)
        expect(recipeCode?.annotations?.[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES].map(dereferenceDep)).toEqual([
          {
            reference: 'zendesk.brand.instance.brandInstName',
            occurrences: [{ location: 'workato.recipe__code.instance.recipe9_code.block.1', direction: 'output' }],
          },
          {
            reference: 'zendesk.group.instance.groupInstName',
            occurrences: [
              { location: 'workato.recipe__code.instance.recipe9_code.block.0.block.0', direction: 'output' },
            ],
          },
          {
            reference: 'zendesk.macro.instance.macroInstName',
            occurrences: [
              { location: 'workato.recipe__code.instance.recipe9_code.block.0.block.0', direction: 'output' },
            ],
          },
          {
            reference: 'zendesk.organization_field.instance.organizationField1Name',
            occurrences: [{ location: 'workato.recipe__code.instance.recipe9_code.block.2', direction: 'output' }],
          },
          {
            reference: 'zendesk.organization_field.instance.organizationField2Name',
            occurrences: [{ location: 'workato.recipe__code.instance.recipe9_code.block.2', direction: 'output' }],
          },
          {
            reference: 'zendesk.organization_field.instance.organizationField3Name',
            occurrences: [{ location: 'workato.recipe__code.instance.recipe9_code.block.2', direction: 'output' }],
          },
          {
            reference: 'zendesk.organization_field.instance.organizationFieldSameName',
            occurrences: [{ location: 'workato.recipe__code.instance.recipe9_code.block.2', direction: 'output' }],
          },
          {
            reference: 'zendesk.organization_field__custom_field_options.instance.organizationField1OptionName',
            occurrences: [{ location: 'workato.recipe__code.instance.recipe9_code.block.2', direction: 'output' }],
          },
          {
            reference: 'zendesk.organization_field__custom_field_options.instance.organizationField2OptionName',
            occurrences: [{ location: 'workato.recipe__code.instance.recipe9_code.block.2', direction: 'output' }],
          },
          {
            reference: 'zendesk.organization_field__custom_field_options.instance.organizationFieldSameOptionName',
            occurrences: [{ location: 'workato.recipe__code.instance.recipe9_code.block.2', direction: 'output' }],
          },
          {
            reference: 'zendesk.ticket_field.instance.ticketField12Name',
            occurrences: [
              { location: 'workato.recipe__code.instance.recipe9_code.block.0.block.0', direction: 'output' },
              { location: 'workato.recipe__code.instance.recipe9_code.block.1', direction: 'output' },
            ],
          },
          {
            reference: 'zendesk.ticket_field.instance.ticketField13Name',
            occurrences: [
              { location: 'workato.recipe__code.instance.recipe9_code.block.0.block.0', direction: 'output' },
            ],
          },
          {
            reference: 'zendesk.ticket_field.instance.ticketField14Name',
            occurrences: [
              { location: 'workato.recipe__code.instance.recipe9_code.block.0.block.0', direction: 'output' },
            ],
          },
          {
            reference: 'zendesk.ticket_field__custom_field_options.instance.ticketField12Option1Name',
            occurrences: [
              { location: 'workato.recipe__code.instance.recipe9_code.block.0.block.0', direction: 'output' },
            ],
          },
          {
            reference: 'zendesk.ticket_field__custom_field_options.instance.ticketField12Option2Name',
            occurrences: [{ location: 'workato.recipe__code.instance.recipe9_code.block.1', direction: 'output' }],
          },
          {
            reference: 'zendesk.ticket_field__custom_field_options.instance.ticketField14OptionName',
            occurrences: [
              { location: 'workato.recipe__code.instance.recipe9_code.block.0.block.0', direction: 'output' },
            ],
          },
          {
            reference: 'zendesk.ticket_form.instance.ticketFormInstName',
            occurrences: [{ location: 'workato.recipe__code.instance.recipe9_code.block.1', direction: 'output' }],
          },
          {
            reference: 'zendesk.user_field.instance.userField1Name',
            occurrences: [{ location: 'workato.recipe__code.instance.recipe9_code.block.3', direction: 'output' }],
          },
          {
            reference: 'zendesk.user_field.instance.userField2Name',
            occurrences: [{ location: 'workato.recipe__code.instance.recipe9_code.block.3', direction: 'output' }],
          },
          {
            reference: 'zendesk.user_field.instance.userField3Name',
            occurrences: [{ location: 'workato.recipe__code.instance.recipe9_code.block.3', direction: 'output' }],
          },
          {
            reference: 'zendesk.user_field.instance.userFieldSameName',
            occurrences: [{ location: 'workato.recipe__code.instance.recipe9_code.block.3', direction: 'output' }],
          },
          {
            reference: 'zendesk.user_field__custom_field_options.instance.userField1OptionName',
            occurrences: [{ location: 'workato.recipe__code.instance.recipe9_code.block.3', direction: 'output' }],
          },
          {
            reference: 'zendesk.user_field__custom_field_options.instance.userField2OptionName',
            occurrences: [{ location: 'workato.recipe__code.instance.recipe9_code.block.3', direction: 'output' }],
          },
          {
            reference: 'zendesk.user_field__custom_field_options.instance.userFieldSameOptionName',
            occurrences: [{ location: 'workato.recipe__code.instance.recipe9_code.block.3', direction: 'output' }],
          },
        ])
      })

      it('should resolve references in-place where possible', () => {
        const recipeCode = currentAdapterElements.find(
          e => e.elemID.getFullName() === 'workato.recipe__code.instance.recipe9_code',
        ) as InstanceElement
        expect(recipeCode).toBeInstanceOf(InstanceElement)
        expect(recipeCode.value.block[0].block[0].input.macro_ids.id).toBeInstanceOf(ReferenceExpression)
        expect(recipeCode.value.block[0].block[0].input.macro_ids.id.elemID.getFullName()).toEqual(
          'zendesk.macro.instance.macroInstName',
        )

        expect(recipeCode.value.block[0].block[0].input.group_id).toBeInstanceOf(ReferenceExpression)
        expect(recipeCode.value.block[0].block[0].input.group_id.elemID.getFullName()).toEqual(
          'zendesk.group.instance.groupInstName',
        )

        expect(recipeCode.value.block[0].block[0].input.field_12).toBeInstanceOf(ReferenceExpression)
        expect(recipeCode.value.block[0].block[0].input.field_12.elemID.getFullName()).toEqual(
          'zendesk.ticket_field__custom_field_options.instance.ticketField12Option1Name',
        )

        expect(recipeCode.value.block[0].block[0].input.field_14).toBeInstanceOf(ReferenceExpression)
        expect(recipeCode.value.block[0].block[0].input.field_14.elemID.getFullName()).toEqual(
          'zendesk.ticket_field__custom_field_options.instance.ticketField14OptionName',
        )

        expect(recipeCode.value.block[1].input.brand_id).toBeInstanceOf(ReferenceExpression)
        expect(recipeCode.value.block[1].input.brand_id.elemID.getFullName()).toEqual(
          'zendesk.brand.instance.brandInstName',
        )

        expect(recipeCode.value.block[1].input.ticket_form_id).toBeInstanceOf(ReferenceExpression)
        expect(recipeCode.value.block[1].input.ticket_form_id.elemID.getFullName()).toEqual(
          'zendesk.ticket_form.instance.ticketFormInstName',
        )

        expect(recipeCode.value.block[1].input.field_12).toBeInstanceOf(ReferenceExpression)
        expect(recipeCode.value.block[1].input.field_12.elemID.getFullName()).toEqual(
          'zendesk.ticket_field__custom_field_options.instance.ticketField12Option2Name',
        )

        expect(recipeCode.value.block[2].input.field_organization_field_1).toBeInstanceOf(ReferenceExpression)
        expect(recipeCode.value.block[2].input.field_organization_field_1.elemID.getFullName()).toEqual(
          'zendesk.organization_field__custom_field_options.instance.organizationField1OptionName',
        )

        expect(recipeCode.value.block[2].input.field_organization_field_2).toBeInstanceOf(ReferenceExpression)
        expect(recipeCode.value.block[2].input.field_organization_field_2.elemID.getFullName()).toEqual(
          'zendesk.organization_field__custom_field_options.instance.organizationField2OptionName',
        )

        expect(recipeCode.value.block[2].input.field_same).toBeInstanceOf(ReferenceExpression)
        expect(recipeCode.value.block[2].input.field_same.elemID.getFullName()).toEqual(
          'zendesk.organization_field__custom_field_options.instance.organizationFieldSameOptionName',
        )

        expect(recipeCode.value.block[3].input.field_user_field_1).toBeInstanceOf(ReferenceExpression)
        expect(recipeCode.value.block[3].input.field_user_field_1.elemID.getFullName()).toEqual(
          'zendesk.user_field__custom_field_options.instance.userField1OptionName',
        )

        expect(recipeCode.value.block[3].input.field_user_field_2).toBeInstanceOf(ReferenceExpression)
        expect(recipeCode.value.block[3].input.field_user_field_2.elemID.getFullName()).toEqual(
          'zendesk.user_field__custom_field_options.instance.userField2OptionName',
        )

        expect(recipeCode.value.block[3].input.field_same).toBeInstanceOf(ReferenceExpression)
        expect(recipeCode.value.block[3].input.field_same.elemID.getFullName()).toEqual(
          'zendesk.user_field__custom_field_options.instance.userFieldSameOptionName',
        )
      })
    })

    it('should return false if no elements were modified', async () => {
      const elements = generateCurrentAdapterElements()
      expect(
        await filter.onPostFetch({
          currentAdapterElements: elements,
          elementsByAccount: {
            salesforce: [],
            netsuite: [],
          },
          accountToServiceNameMap: {
            salesforce: 'salesforce',
            netsuite: 'netsuite',
          },
          progressReporter: { reportProgress: () => null },
        }),
      ).toBeFalsy()
    })

    it('should do nothing if serviceConnectionNames is missing', async () => {
      const elements = generateCurrentAdapterElements()

      const otherFilter = filterCreator({
        client,
        paginator: clientUtils.createPaginator({
          client,
          paginationFuncCreator: paginate,
        }),
        config: {
          fetch: _.omit(getDefaultConfig()[FETCH_CONFIG], 'serviceConnectionNames'),
          apiDefinitions: {
            typeDefaults: {
              transformation: {
                idFields: DEFAULT_ID_FIELDS,
              },
            },
            types: DEFAULT_TYPES,
            supportedTypes: SUPPORTED_TYPES,
          },
        },
        fetchQuery: elementUtils.query.createMockQuery(),
      }) as FilterType

      expect(
        await otherFilter.onPostFetch({
          currentAdapterElements: elements,
          elementsByAccount: {
            salesforce: [],
            netsuite: [],
          },
          accountToServiceNameMap: {
            salesforce: 'salesforce',
            netsuite: 'netsuite',
          },
          progressReporter: { reportProgress: () => null },
        }),
      ).toBeFalsy()
      expect(elements.filter(e => e.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES] !== undefined)).toHaveLength(0)
    })

    it('should handle unresolved connection names gracefully', async () => {
      const elements = generateCurrentAdapterElements()

      const otherFilter = filterCreator({
        client,
        paginator: clientUtils.createPaginator({
          client,
          paginationFuncCreator: paginate,
        }),
        config: {
          fetch: {
            ...getDefaultConfig()[FETCH_CONFIG],
            serviceConnectionNames: {
              salesforce: ['salesforce sandbox 1 unresolved'],
              netsuite: ['netsuite sbx 123'],
            },
          },
          apiDefinitions: {
            typeDefaults: {
              transformation: {
                idFields: DEFAULT_ID_FIELDS,
              },
            },
            types: DEFAULT_TYPES,
            supportedTypes: SUPPORTED_TYPES,
          },
        },
        fetchQuery: elementUtils.query.createMockQuery(),
      }) as FilterType

      // should still resolve the netsuite references
      await otherFilter.onPostFetch({
        currentAdapterElements: elements,
        elementsByAccount: {
          salesforce: generateSalesforceElements(),
          netsuite: generateNetsuiteElements(),
        },
        accountToServiceNameMap: {
          salesforce: 'salesforce',
          netsuite: 'netsuite',
        },
        progressReporter: { reportProgress: () => null },
      })
      expect(elements.filter(e => e.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES] !== undefined)).toHaveLength(3)
      expect(
        elements.flatMap(e => e.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES] ?? []).map(dereferenceDep),
      ).toEqual([
        {
          reference: 'netsuite.customrecord16',
          occurrences: [{ location: 'workato.recipe__code.instance.recipe1_code.block.0', direction: 'output' }],
        },
        {
          reference: 'netsuite.customrecord16.field.custom_custrecord5',
          occurrences: [{ location: 'workato.recipe__code.instance.recipe1_code.input.Custom__c', direction: 'input' }],
        },
        {
          reference: 'netsuite.customrecord16.field.custom_custrecordaccount_id',
          occurrences: [{ location: 'workato.recipe__code.instance.recipe1_code.input.Custom__c', direction: 'input' }],
        },
        {
          reference: 'netsuite.entitycustomfield.instance.custentitycustom_account_city',
          occurrences: [{ location: 'workato.recipe__code.instance.recipe1_code.input.Custom__c', direction: 'input' }],
        },
        {
          reference: 'netsuite.othercustomfield.instance.custrecord2',
          occurrences: [{ location: 'workato.recipe__code.instance.recipe1_code.block.0', direction: 'output' }],
        },
        {
          reference: 'netsuite.customrecord16',
          occurrences: [{ location: 'workato.recipe__code.instance.recipe3_code.block.0', direction: 'output' }],
        },
        {
          reference: 'netsuite.customrecord16.field.custom_custrecord5',
          occurrences: [{ location: 'workato.recipe__code.instance.recipe3_code.input.Custom__c', direction: 'input' }],
        },
        {
          reference: 'netsuite.customrecord16.field.custom_custrecordaccount_id',
          occurrences: [{ location: 'workato.recipe__code.instance.recipe3_code.input.Custom__c', direction: 'input' }],
        },
        {
          reference: 'netsuite.entitycustomfield.instance.custentitycustom_account_city',
          occurrences: [{ location: 'workato.recipe__code.instance.recipe3_code.input.Custom__c', direction: 'input' }],
        },
        {
          reference: 'netsuite.othercustomfield.instance.custrecord2',
          occurrences: [{ location: 'workato.recipe__code.instance.recipe3_code.block.0', direction: 'output' }],
        },
        {
          reference: 'netsuite.Customer',
          occurrences: [{ location: 'workato.recipe__code.instance.recipe6_code', direction: 'input' }],
        },
        {
          reference: 'netsuite.Customer.field.companyName',
          occurrences: [{ location: 'workato.recipe__code.instance.recipe6_code', direction: 'input' }],
        },
        {
          reference: 'netsuite.Opportunity',
          occurrences: [{ location: 'workato.recipe__code.instance.recipe6_code.block.0', direction: 'output' }],
        },
      ])
    })
  })

  describe('on post-fetch primary+secondary', () => {
    let currentAdapterElements: Element[]
    let salesforceElements: Element[]
    let netsuiteElements: Element[]

    beforeAll(async () => {
      filter = filterCreator({
        client,
        paginator: clientUtils.createPaginator({
          client,
          paginationFuncCreator: paginate,
        }),
        config: {
          fetch: {
            ...getDefaultConfig()[FETCH_CONFIG],
            serviceConnectionNames: {
              salesforce: ['secondary salesforce', 'salesforce sandbox 1'],
              netsuite: ['secondary netsuite'],
            },
          },
          apiDefinitions: {
            typeDefaults: {
              transformation: {
                idFields: DEFAULT_ID_FIELDS,
              },
            },
            types: DEFAULT_TYPES,
            supportedTypes: SUPPORTED_TYPES,
          },
        },
        fetchQuery: elementUtils.query.createMockQuery(),
      }) as FilterType

      currentAdapterElements = generateCurrentAdapterElements()
      salesforceElements = generateSalesforceElements()
      netsuiteElements = generateNetsuiteElements()
      await filter.onPostFetch({
        currentAdapterElements,
        elementsByAccount: {
          salesforce: salesforceElements,
          netsuite: netsuiteElements,
        },
        accountToServiceNameMap: {
          salesforce: 'salesforce',
          netsuite: 'netsuite',
        },
        progressReporter: { reportProgress: () => null },
      })
    })

    describe('recipe5WithSecondaryCode', () => {
      it('should show all resolved references in the _generated_dependencies annotation, in alphabetical order', () => {
        const recipeCode = currentAdapterElements.find(
          e => e.elemID.getFullName() === 'workato.recipe__code.instance.recipe5_code',
        )
        expect(recipeCode).toBeDefined()
        expect(recipeCode?.annotations?.[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toBeDefined()
        expect(recipeCode?.annotations?.[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toHaveLength(12)
        expect(recipeCode?.annotations?.[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES].map(dereferenceDep)).toEqual([
          {
            reference: 'netsuite.customrecord16',
            occurrences: [{ location: 'workato.recipe__code.instance.recipe5_code.block.0', direction: 'output' }],
          },
          {
            reference: 'netsuite.customrecord16.field.custom_custrecord5',
            occurrences: [
              { location: 'workato.recipe__code.instance.recipe5_code.input.Custom__c', direction: 'input' },
            ],
          },
          {
            reference: 'netsuite.customrecord16.field.custom_custrecordaccount_id',
            occurrences: [
              { location: 'workato.recipe__code.instance.recipe5_code.input.Custom__c', direction: 'input' },
            ],
          },
          {
            reference: 'netsuite.entitycustomfield.instance.custentitycustom_account_city',
            occurrences: [
              { location: 'workato.recipe__code.instance.recipe5_code.input.Custom__c', direction: 'input' },
            ],
          },
          {
            reference: 'netsuite.othercustomfield.instance.custrecord2',
            occurrences: [{ location: 'workato.recipe__code.instance.recipe5_code.block.0', direction: 'output' }],
          },
          {
            reference: 'salesforce.MyCustom__c',
            occurrences: [
              { location: 'workato.recipe__code.instance.recipe5_code.block.0.block.0', direction: 'output' },
            ],
          },
          {
            reference: 'salesforce.MyCustom__c.field.customField__c',
            occurrences: [
              { location: 'workato.recipe__code.instance.recipe5_code.block.0.block.0', direction: 'output' },
            ],
          },
          {
            reference: 'salesforce.Opportunity',
            occurrences: [{ location: 'workato.recipe__code.instance.recipe5_code', direction: 'input' }],
          },
          {
            reference: 'salesforce.Opportunity.field.Custom__c',
            occurrences: [{ location: 'workato.recipe__code.instance.recipe5_code', direction: 'input' }],
          },
          {
            reference: 'salesforce.Opportunity.field.FormulaRef1__c',
            occurrences: [
              {
                location: 'workato.recipe__code.instance.recipe5_code.block.0.block.0.input.customField__c',
                direction: 'input',
              },
            ],
          },
          {
            reference: 'salesforce.Opportunity.field.FormulaRef2__c',
            occurrences: [
              {
                location: 'workato.recipe__code.instance.recipe5_code.block.0.block.0.input.something1',
                direction: 'input',
              },
            ],
          },
          {
            reference: 'salesforce.Opportunity.field.FormulaRef3__c',
            occurrences: [
              {
                location: 'workato.recipe__code.instance.recipe5_code.block.0.block.0.input.something2',
                direction: 'input',
              },
            ],
          },
        ])
      })
    })
  })
})
