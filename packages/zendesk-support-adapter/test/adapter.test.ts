/*
*                      Copyright 2021 Salto Labs Ltd.
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
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import { InstanceElement, isObjectType, isInstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import mockReplies from './mock_replies.json'
import { adapter } from '../src/adapter_creator'
import { usernamePasswordCredentialsType } from '../src/auth'
import { configType, FETCH_CONFIG, DEFAULT_TYPES, API_DEFINITIONS_CONFIG } from '../src/config'

type MockReply = {
  url: string
  params: Record<string, string>
  response: unknown
}

describe('adapter', () => {
  let mockAxiosAdapter: MockAdapter

  beforeEach(async () => {
    mockAxiosAdapter = new MockAdapter(axios, { delayResponse: 1, onNoMatch: 'throwException' })
    mockAxiosAdapter.onGet('/account/settings').replyOnce(200, { settings: {} });
    (mockReplies as MockReply[]).forEach(({ url, params, response }) => {
      mockAxiosAdapter.onGet(url, !_.isEmpty(params) ? { params } : undefined).replyOnce(
        200, response
      )
    })
  })

  afterEach(() => {
    mockAxiosAdapter.restore()
  })

  describe('fetch', () => {
    describe('full fetch', () => {
      it('should generate the right elements on fetch', async () => {
        const { elements } = await adapter.operations({
          credentials: new InstanceElement(
            'config',
            usernamePasswordCredentialsType,
            { username: 'user123', password: 'token456' },
          ),
          config: new InstanceElement(
            'config',
            configType,
            {
              [FETCH_CONFIG]: {
                includeTypes: [...Object.keys(DEFAULT_TYPES)].sort(),
              },
            }
          ),
          elementsSource: buildElementsSourceFromElements([]),
        }).fetch({ progressReporter: { reportProgress: () => null } })
        expect(elements).toHaveLength(268)
        expect(elements.filter(isObjectType)).toHaveLength(152)
        expect(elements.filter(isInstanceElement)).toHaveLength(116)
        expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual([
          'zendesk_support.account_setting',
          'zendesk_support.account_setting.instance',
          'zendesk_support.account_setting__active_features',
          'zendesk_support.account_setting__agents',
          'zendesk_support.account_setting__api',
          'zendesk_support.account_setting__apps',
          'zendesk_support.account_setting__billing',
          'zendesk_support.account_setting__branding',
          'zendesk_support.account_setting__brands',
          'zendesk_support.account_setting__cdn',
          'zendesk_support.account_setting__cdn__hosts',
          'zendesk_support.account_setting__chat',
          'zendesk_support.account_setting__cross_sell',
          'zendesk_support.account_setting__gooddata_advanced_analytics',
          'zendesk_support.account_setting__google_apps',
          'zendesk_support.account_setting__groups',
          'zendesk_support.account_setting__knowledge',
          'zendesk_support.account_setting__limits',
          'zendesk_support.account_setting__localization',
          'zendesk_support.account_setting__lotus',
          'zendesk_support.account_setting__metrics',
          'zendesk_support.account_setting__onboarding',
          'zendesk_support.account_setting__rule',
          'zendesk_support.account_setting__screencast',
          'zendesk_support.account_setting__statistics',
          'zendesk_support.account_setting__ticket_form',
          'zendesk_support.account_setting__ticket_sharing_partners',
          'zendesk_support.account_setting__tickets',
          'zendesk_support.account_setting__twitter',
          'zendesk_support.account_setting__user',
          'zendesk_support.account_setting__voice',
          'zendesk_support.account_settings',
          'zendesk_support.app_installation',
          'zendesk_support.app_installation.instance.Salesforce_1900000132965',
          'zendesk_support.app_installation.instance.Slack_1900000132805',
          'zendesk_support.app_installation__plan_information',
          'zendesk_support.app_installation__settings',
          'zendesk_support.app_installation__settings_objects',
          'zendesk_support.app_installations',
          'zendesk_support.apps_owned',
          'zendesk_support.automation',
          'zendesk_support.automation.instance.Close_ticket_4_days_after_status_is_set_to_solved_1500016953642@sssssssssu',
          'zendesk_support.automation.instance.Close_ticket_4_days_after_status_is_set_to_solved_1500027162481@sssssssssu',
          'zendesk_support.automation.instance.Pending_notification_24_hours_1500016953662@sssu',
          'zendesk_support.automation.instance.Pending_notification_5_days_1500016953682@sssu',
          'zendesk_support.automation__actions',
          'zendesk_support.automation__conditions',
          'zendesk_support.automation__conditions__all',
          'zendesk_support.automations',
          'zendesk_support.brand',
          'zendesk_support.brand.instance.myBrand_1500000550682',
          'zendesk_support.brands',
          'zendesk_support.business_hours_schedule',
          'zendesk_support.business_hours_schedule.instance.New_schedule_1900000004365@su',
          'zendesk_support.business_hours_schedule.instance.Schedule_2_1500001035461@su',
          'zendesk_support.business_hours_schedule.instance.Schedule_2_1500001036042@su',
          'zendesk_support.business_hours_schedule__intervals',
          'zendesk_support.business_hours_schedules',
          'zendesk_support.custom_role',
          'zendesk_support.custom_role.instance.Advisor_1500001601021',
          'zendesk_support.custom_role.instance.Billing_admin_1500004942002@su',
          'zendesk_support.custom_role.instance.Contributor_1500004941982',
          'zendesk_support.custom_role.instance.Light_agent_1500004941962@su',
          'zendesk_support.custom_role.instance.Staff_1500001600981',
          'zendesk_support.custom_role.instance.Team_lead_1500001601001@su',
          'zendesk_support.custom_role__configuration',
          'zendesk_support.custom_roles',
          'zendesk_support.dynamic_content_item',
          'zendesk_support.dynamic_content_item.instance.Dynamic_content_item_title_543_1900000045325@ssssu',
          'zendesk_support.dynamic_content_item__variants',
          'zendesk_support.group',
          'zendesk_support.group.instance.Support_1500002894482',
          'zendesk_support.groups',
          'zendesk_support.locale',
          'zendesk_support.locale.instance.en_US@b',
          'zendesk_support.locale.instance.es',
          'zendesk_support.locale.instance.he',
          'zendesk_support.locales',
          'zendesk_support.macro',
          'zendesk_support.macro.instance.Close_and_redirect_to_topics_1500016953922@ssssu',
          'zendesk_support.macro.instance.Close_and_redirect_to_topics_1900002626825@ssssu',
          'zendesk_support.macro.instance.Customer_not_responding_1500016953962@ssu',
          'zendesk_support.macro.instance.Customer_not_responding__copy__with_rich_text_1500027465822@sssjksssu',
          'zendesk_support.macro.instance.Downgrade_and_inform_1500016953942@ssu',
          'zendesk_support.macro.instance.Take_it__1500016953862@slu',
          'zendesk_support.macro.instance.macro235_1500027161281',
          'zendesk_support.macro__actions',
          'zendesk_support.macro__restriction',
          'zendesk_support.macro_action',
          'zendesk_support.macro_action__operators',
          'zendesk_support.macro_action__values',
          'zendesk_support.macro_action__values__list',
          'zendesk_support.macro_categories',
          'zendesk_support.macro_definition',
          'zendesk_support.macro_definition.instance',
          'zendesk_support.macro_definition__actions',
          'zendesk_support.macro_definition__actions__values',
          'zendesk_support.macros',
          'zendesk_support.macros_actions',
          'zendesk_support.macros_actions.instance',
          'zendesk_support.macros_definitions',
          'zendesk_support.monitored_twitter_handles',
          'zendesk_support.oauth_client',
          'zendesk_support.oauth_client.instance.c123_1111',
          'zendesk_support.oauth_client.instance.c124_1112',
          'zendesk_support.oauth_clients',
          'zendesk_support.oauth_global_clients',
          'zendesk_support.organization',
          'zendesk_support.organization.instance.myBrand_1500421645662',
          'zendesk_support.organization.instance.test_org_123_1900025376085@ssu',
          'zendesk_support.organization.instance.test_org_124_1500508294122@ssu',
          'zendesk_support.organization__organization_fields',
          'zendesk_support.organization_field',
          'zendesk_support.organization_field.instance.org_field301',
          'zendesk_support.organization_field.instance.org_field302',
          'zendesk_support.organization_field.instance.org_field305',
          'zendesk_support.organization_field.instance.org_field306',
          'zendesk_support.organization_field.instance.org_field307',
          'zendesk_support.organization_field.instance.org_field_n403',
          'zendesk_support.organization_field.instance.org_field_n404',
          'zendesk_support.organization_fields',
          'zendesk_support.organizations',
          'zendesk_support.recipient_address',
          'zendesk_support.recipient_address.instance.myBrand_1500000743022',
          'zendesk_support.recipient_addresses',
          'zendesk_support.resource_collection',
          'zendesk_support.resource_collection.instance.unnamed_0_0',
          'zendesk_support.resource_collection__resources',
          'zendesk_support.resource_collections',
          'zendesk_support.routing_attribute',
          'zendesk_support.routing_attribute.instance.Language_468ffec1_f80c_11eb_8231_51714e7ee9ec@ubbbb',
          'zendesk_support.routing_attribute.instance.Location_76738421_f80c_11eb_b3db_1ded4e71c25a@ubbbb',
          'zendesk_support.routing_attribute_definition',
          'zendesk_support.routing_attribute_definition.instance',
          'zendesk_support.routing_attribute_definition__conditions_all',
          'zendesk_support.routing_attribute_definition__conditions_all__operators',
          'zendesk_support.routing_attribute_definition__conditions_all__values',
          'zendesk_support.routing_attribute_definition__conditions_any',
          'zendesk_support.routing_attribute_definition__conditions_any__operators',
          'zendesk_support.routing_attribute_definition__conditions_any__values',
          'zendesk_support.routing_attribute_definitions',
          'zendesk_support.routing_attributes',
          'zendesk_support.sharing_agreements',
          'zendesk_support.sla_policies',
          'zendesk_support.sla_policies_definitions',
          'zendesk_support.sla_policy',
          'zendesk_support.sla_policy.instance.SLA_501_1900000007885@su',
          'zendesk_support.sla_policy.instance.SLA_502_1500001074121@su',
          'zendesk_support.sla_policy__filter',
          'zendesk_support.sla_policy__filter__all',
          'zendesk_support.sla_policy__policy_metrics',
          'zendesk_support.sla_policy_definition',
          'zendesk_support.sla_policy_definition.instance',
          'zendesk_support.sla_policy_definition__all',
          'zendesk_support.sla_policy_definition__all__operators',
          'zendesk_support.sla_policy_definition__all__values',
          'zendesk_support.sla_policy_definition__all__values__label',
          'zendesk_support.sla_policy_definition__all__values__labels',
          'zendesk_support.sla_policy_definition__all__values__list',
          'zendesk_support.sla_policy_definition__any',
          'zendesk_support.sla_policy_definition__any__operators',
          'zendesk_support.sla_policy_definition__any__values',
          'zendesk_support.sla_policy_definition__any__values__label',
          'zendesk_support.sla_policy_definition__any__values__labels',
          'zendesk_support.sla_policy_definition__any__values__list',
          'zendesk_support.target',
          'zendesk_support.target.instance.Slack_integration_Endpoint_url_target_v2@ssuuu',
          'zendesk_support.targets',
          'zendesk_support.ticket_field',
          'zendesk_support.ticket_field.instance.assignee_Assignee_1500004937842',
          'zendesk_support.ticket_field.instance.description_Description_1500004937742',
          'zendesk_support.ticket_field.instance.group_Group_1500004937822',
          'zendesk_support.ticket_field.instance.multiselect_agent_dropdown_643_for_agent_1500009152882@ussssu',
          'zendesk_support.ticket_field.instance.partialcreditcard_credit_card_1_1500009152902@ussu',
          'zendesk_support.ticket_field.instance.priority_Priority_1500004937802',
          'zendesk_support.ticket_field.instance.regexp_zip_code_with_validation_1500009152922@usssu',
          'zendesk_support.ticket_field.instance.status_Status_1500004937762',
          'zendesk_support.ticket_field.instance.subject_Subject_1500004937722',
          'zendesk_support.ticket_field.instance.text_agent_field_431_1900000813305@ussu',
          'zendesk_support.ticket_field.instance.tickettype_Type_1500004937782',
          'zendesk_support.ticket_field__custom_field_options',
          'zendesk_support.ticket_field__custom_field_options.instance.multiselect_agent_dropdown_643_for_agent_1500009152882_ussssu__v1_1500015072702@uuuuuumuuu',
          'zendesk_support.ticket_field__custom_field_options.instance.multiselect_agent_dropdown_643_for_agent_1500009152882_ussssu__v2_1500015072722@uuuuuumuuu',
          'zendesk_support.ticket_field__system_field_options',
          'zendesk_support.ticket_fields',
          'zendesk_support.ticket_form',
          'zendesk_support.ticket_form.instance.Default_Ticket_Form_1500000859362@ssu',
          'zendesk_support.ticket_form.instance.Form_11_1500002488481@su',
          'zendesk_support.ticket_form.instance.Form_11_1900000172165@su',
          'zendesk_support.ticket_form.instance.Form_12_1500002488501@su',
          'zendesk_support.ticket_form.instance.Form_6436_1500002488461@su',
          'zendesk_support.ticket_forms',
          'zendesk_support.trigger',
          'zendesk_support.trigger.instance.Auto_assign_to_first_email_responding_agent_1500016953622@bsssssu',
          'zendesk_support.trigger.instance.Notify_all_agents_of_received_request_1500016953602@sssssu',
          'zendesk_support.trigger.instance.Notify_assignee_of_assignment_1500016953542@sssu',
          'zendesk_support.trigger.instance.Notify_assignee_of_comment_update_1500016953522@ssssu',
          'zendesk_support.trigger.instance.Notify_assignee_of_reopened_ticket_1500016953562@ssssu',
          'zendesk_support.trigger.instance.Notify_group_of_assignment_1500016953582@sssu',
          'zendesk_support.trigger.instance.Notify_requester_and_CCs_of_comment_update_1500016953502@ssssssu',
          'zendesk_support.trigger.instance.Notify_requester_and_CCs_of_received_request_1500016953462@ssssssu',
          'zendesk_support.trigger.instance.Notify_requester_of_new_proactive_ticket_1500016953482@sssssu',
          'zendesk_support.trigger.instance.Slack_Ticket_Trigger_1900002626665@ssu',
          'zendesk_support.trigger__actions',
          'zendesk_support.trigger__conditions',
          'zendesk_support.trigger__conditions__all',
          'zendesk_support.trigger__conditions__any',
          'zendesk_support.trigger_categories',
          'zendesk_support.trigger_categories__links',
          'zendesk_support.trigger_categories__meta',
          'zendesk_support.trigger_category',
          'zendesk_support.trigger_category.instance.Custom_Events_1500001608041@su',
          'zendesk_support.trigger_category.instance.Custom_Events_1500001608061@su',
          'zendesk_support.trigger_category.instance.Notifications_1500000362362',
          'zendesk_support.triggers',
          'zendesk_support.user_field',
          'zendesk_support.user_field.instance.another_text_3425',
          'zendesk_support.user_field.instance.date6436',
          'zendesk_support.user_field.instance.decimal_765_field',
          'zendesk_support.user_field.instance.description_123',
          'zendesk_support.user_field.instance.dropdown_25',
          'zendesk_support.user_field.instance.f201',
          'zendesk_support.user_field.instance.f202',
          'zendesk_support.user_field.instance.f203',
          'zendesk_support.user_field.instance.f204',
          'zendesk_support.user_field.instance.f205',
          'zendesk_support.user_field.instance.f206',
          'zendesk_support.user_field.instance.modified_multi75_key',
          'zendesk_support.user_field.instance.numeric65',
          'zendesk_support.user_field.instance.regex_6546',
          'zendesk_support.user_field.instance.this_is_a_checkbox',
          'zendesk_support.user_field__custom_field_options',
          'zendesk_support.user_field__custom_field_options.instance.dropdown_25__Choice1_1500001753322',
          'zendesk_support.user_field__custom_field_options.instance.dropdown_25__another_choice_1500001753342@uuusu',
          'zendesk_support.user_field__custom_field_options.instance.dropdown_25__bla_1500001753362',
          'zendesk_support.user_fields',
          'zendesk_support.view',
          'zendesk_support.view.instance.All_unsolved_tickets_1500016953782@ssu',
          'zendesk_support.view.instance.Copy_of_All_unsolved_tickets_1500027465762@ssssu',
          'zendesk_support.view.instance.Current_tasks_1500016953882@su',
          'zendesk_support.view.instance.Custom_view_123_1500027465722@ssu',
          'zendesk_support.view.instance.Custom_view_123_1500027465802@ssu',
          'zendesk_support.view.instance.New_tickets_in_your_groups_1500016953742@ssssu',
          'zendesk_support.view.instance.Overdue_tasks_1500016953902@su',
          'zendesk_support.view.instance.Pending_tickets_1500016953842@su',
          'zendesk_support.view.instance.Recently_solved_tickets_1500016953762@ssu',
          'zendesk_support.view.instance.Recently_updated_tickets_1500016953822@ssu',
          'zendesk_support.view.instance.Unassigned_tickets_1500016953802@su',
          'zendesk_support.view.instance.Unassigned_tickets_1500027465742@su',
          'zendesk_support.view.instance.Unsolved_tickets_in_your_groups_1500016953722@ssssu',
          'zendesk_support.view.instance.Your_unsolved_tickets_1500016953702@ssu',
          'zendesk_support.view__conditions',
          'zendesk_support.view__conditions__all',
          'zendesk_support.view__conditions__any',
          'zendesk_support.view__execution',
          'zendesk_support.view__execution__columns',
          'zendesk_support.view__execution__fields',
          'zendesk_support.view__execution__group',
          'zendesk_support.view__execution__sort',
          'zendesk_support.view__restriction',
          'zendesk_support.views',
          'zendesk_support.workspace',
          'zendesk_support.workspace.instance.New_Workspace_123_1500001200962@ssu',
          'zendesk_support.workspace__conditions',
          'zendesk_support.workspace__conditions__all',
          'zendesk_support.workspace__conditions__any',
          'zendesk_support.workspace__selected_macros',
          'zendesk_support.workspaces',
        ])

        const recipientAddress = elements.filter(isInstanceElement).find(e => e.elemID.getFullName().startsWith('zendesk_support.recipient_address.instance.myBrand'))
        expect(recipientAddress).toBeDefined()
        expect(recipientAddress?.value).toEqual({
          id: 1500000743022,
          default: true,
          name: 'myBrand',
          email: 'support@myBrand.zendesk.com',
          // eslint-disable-next-line camelcase
          brand_id: expect.any(ReferenceExpression),
        })
        expect(recipientAddress?.value.brand_id.elemID.getFullName()).toEqual('zendesk_support.brand.instance.myBrand_1500000550682')
      })
    })

    describe('type overrides', () => {
      it('should fetch only the relevant types', async () => {
        const { elements } = await adapter.operations({
          credentials: new InstanceElement(
            'config',
            usernamePasswordCredentialsType,
            { username: 'user123', password: 'pwd456', subdomain: 'abc' },
          ),
          config: new InstanceElement(
            'config',
            configType,
            {
              [FETCH_CONFIG]: {
                includeTypes: ['groups'],
              },
              [API_DEFINITIONS_CONFIG]: {
                types: {
                  group: {
                    transformation: {
                      sourceTypeName: 'groups__groups',
                    },
                  },
                  groups: {
                    request: {
                      url: '/groups',
                    },
                    transformation: {
                      dataField: 'groups',
                    },
                  },
                },
              },
            },
          ),
          elementsSource: buildElementsSourceFromElements([]),
        }).fetch({ progressReporter: { reportProgress: () => null } })
        expect(elements).toHaveLength(3)
        expect(elements.filter(isObjectType)).toHaveLength(2)
        expect(elements.filter(isInstanceElement)).toHaveLength(1)
        expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual([
          'zendesk_support.group',
          'zendesk_support.group.instance.Support_1500002894482',
          'zendesk_support.groups',
        ])
      })
    })
  })

  describe('deploy', () => {
    it('should throw not implemented', async () => {
      const operations = adapter.operations({
        credentials: new InstanceElement(
          'config',
          usernamePasswordCredentialsType,
          { username: 'user123', password: 'pwd456', subdomain: 'abc' },
        ),
        config: new InstanceElement(
          'config',
          configType,
          {
            [FETCH_CONFIG]: {
              includeTypes: [...Object.keys(DEFAULT_TYPES)].sort(),
            },
          }
        ),
        elementsSource: buildElementsSourceFromElements([]),
      })
      await expect(operations.deploy({ changeGroup: { groupID: '', changes: [] } })).rejects.toThrow(new Error('Not implemented.'))
    })
  })
})
