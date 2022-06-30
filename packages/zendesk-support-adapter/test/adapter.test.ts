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
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import { InstanceElement, isInstanceElement, ReferenceExpression, isRemovalChange,
  AdapterOperations, toChange, ObjectType, ElemID, getChangeData, BuiltinTypes, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { elements as elementsUtils } from '@salto-io/adapter-components'
import mockReplies from './mock_replies.json'
import { adapter } from '../src/adapter_creator'
import { usernamePasswordCredentialsType } from '../src/auth'
import { configType, FETCH_CONFIG, API_DEFINITIONS_CONFIG } from '../src/config'
import { ZENDESK_SUPPORT } from '../src/constants'

type MockReply = {
  url: string
  params: Record<string, string>
  response: unknown
}

const mockDeployChange = jest.fn()
jest.mock('@salto-io/adapter-components', () => {
  const actual = jest.requireActual('@salto-io/adapter-components')
  return {
    ...actual,
    deployment: {
      ...actual.deployment,
      deployChange: jest.fn((...args) => mockDeployChange(...args)),
    },
  }
})

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
                include: [{
                  type: '.*',
                }],
                exclude: [],
              },
            }
          ),
          elementsSource: buildElementsSourceFromElements([]),
        }).fetch({ progressReporter: { reportProgress: () => null } })
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
          'zendesk_support.account_setting__routing',
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
          'zendesk_support.app_installation.instance.Salesforce_10',
          'zendesk_support.app_installation.instance.Slack_156097',
          'zendesk_support.app_installation__plan_information',
          'zendesk_support.app_installation__settings',
          'zendesk_support.app_installation__settings_objects',
          'zendesk_support.app_installations',
          'zendesk_support.app_owned',
          'zendesk_support.app_owned.instance.xr_app',
          'zendesk_support.app_owned__parameters',
          'zendesk_support.apps_owned',
          'zendesk_support.automation',
          'zendesk_support.automation.instance.Close_ticket_4_days_after_status_is_set_to_solved@s',
          'zendesk_support.automation.instance.Close_ticket_5_days_after_status_is_set_to_solved@s',
          'zendesk_support.automation.instance.Pending_notification_24_hours@s',
          'zendesk_support.automation.instance.Pending_notification_5_days@s',
          'zendesk_support.automation.instance.Tag_tickets_from_Social@s',
          'zendesk_support.automation__actions',
          'zendesk_support.automation__conditions',
          'zendesk_support.automation__conditions__all',
          'zendesk_support.automation__conditions__any',
          'zendesk_support.automation_order',
          'zendesk_support.automation_order.instance',
          'zendesk_support.automations',
          'zendesk_support.brand',
          'zendesk_support.brand.instance.myBrand',
          'zendesk_support.brand_logo',
          'zendesk_support.brands',
          'zendesk_support.business_hours_schedule',
          'zendesk_support.business_hours_schedule.instance.New_schedule@s',
          'zendesk_support.business_hours_schedule.instance.Schedule_2@s',
          'zendesk_support.business_hours_schedule.instance.Schedule_3@s',
          'zendesk_support.business_hours_schedule__intervals',
          'zendesk_support.business_hours_schedule_holiday',
          'zendesk_support.business_hours_schedule_holiday.instance.New_schedule_s__Holiday1@umuu',
          'zendesk_support.business_hours_schedule_holiday.instance.Schedule_3_s__Holi2@umuu',
          'zendesk_support.business_hours_schedule_holiday__holidays',
          'zendesk_support.business_hours_schedules',
          'zendesk_support.channel',
          'zendesk_support.channel.instance.Answer_Bot_for_Web_Widget@s',
          'zendesk_support.channel.instance.Automation',
          'zendesk_support.channel.instance.CTI_phone_call__incoming_@sssjk',
          'zendesk_support.channel.instance.CTI_phone_call__outgoing_@sssjk',
          'zendesk_support.channel.instance.CTI_voicemail@s',
          'zendesk_support.channel.instance.Channel_Integrations@s',
          'zendesk_support.channel.instance.Chat',
          'zendesk_support.channel.instance.Closed_ticket@s',
          'zendesk_support.channel.instance.Email',
          'zendesk_support.channel.instance.Facebook_Messenger@s',
          'zendesk_support.channel.instance.Facebook_Post@s',
          'zendesk_support.channel.instance.Facebook_Private_Message@s',
          'zendesk_support.channel.instance.Forum_topic@s',
          'zendesk_support.channel.instance.Get_Satisfaction@s',
          'zendesk_support.channel.instance.Help_Center_post@s',
          'zendesk_support.channel.instance.Instagram_Direct@s',
          'zendesk_support.channel.instance.LINE',
          'zendesk_support.channel.instance.Mobile',
          'zendesk_support.channel.instance.Mobile_SDK@s',
          'zendesk_support.channel.instance.Phone_call__incoming_@ssjk',
          'zendesk_support.channel.instance.Phone_call__outgoing_@ssjk',
          'zendesk_support.channel.instance.Satisfaction_Prediction@s',
          'zendesk_support.channel.instance.Text',
          'zendesk_support.channel.instance.Ticket_sharing@s',
          'zendesk_support.channel.instance.Twitter',
          'zendesk_support.channel.instance.Twitter_DM@s',
          'zendesk_support.channel.instance.Twitter_Direct_Message@s',
          'zendesk_support.channel.instance.Twitter_Like@s',
          'zendesk_support.channel.instance.Voicemail',
          'zendesk_support.channel.instance.WeChat',
          'zendesk_support.channel.instance.Web_Widget@s',
          'zendesk_support.channel.instance.Web_form@s',
          'zendesk_support.channel.instance.Web_service__API_@ssjk',
          'zendesk_support.channel.instance.WhatsApp',
          'zendesk_support.custom_role',
          'zendesk_support.custom_role.instance.Advisor',
          'zendesk_support.custom_role.instance.Billing_admin@s',
          'zendesk_support.custom_role.instance.Contributor',
          'zendesk_support.custom_role.instance.Light_agent@s',
          'zendesk_support.custom_role.instance.Staff',
          'zendesk_support.custom_role.instance.Team_lead@s',
          'zendesk_support.custom_role__configuration',
          'zendesk_support.custom_roles',
          'zendesk_support.dynamic_content_item',
          'zendesk_support.dynamic_content_item.instance.Dynamic_content_item_title_543@s',
          'zendesk_support.dynamic_content_item.instance.dynamic_content_item_544@s',
          'zendesk_support.dynamic_content_item__variants',
          'zendesk_support.dynamic_content_item__variants.instance.Dynamic_content_item_title_543_s__en_US_b@uuuumuuum',
          'zendesk_support.dynamic_content_item__variants.instance.dynamic_content_item_544_s__en_US_b@uuumuuum',
          'zendesk_support.dynamic_content_item__variants.instance.dynamic_content_item_544_s__es@uuumuu',
          'zendesk_support.dynamic_content_item__variants.instance.dynamic_content_item_544_s__he@uuumuu',
          'zendesk_support.group',
          'zendesk_support.group.instance.Support',
          'zendesk_support.group.instance.Support2',
          'zendesk_support.group.instance.Support4',
          'zendesk_support.group.instance.Support5',
          'zendesk_support.groups',
          'zendesk_support.locale',
          'zendesk_support.locale.instance.en_US@b',
          'zendesk_support.locale.instance.es',
          'zendesk_support.locale.instance.he',
          'zendesk_support.locales',
          'zendesk_support.macro',
          'zendesk_support.macro.instance.Close_and_redirect_to_topics@s',
          'zendesk_support.macro.instance.Close_and_redirect_to_topics_2@s',
          'zendesk_support.macro.instance.Customer_not_responding@s',
          'zendesk_support.macro.instance.Customer_not_responding__copy__with_rich_text@sssjksss',
          'zendesk_support.macro.instance.Downgrade_and_inform@s',
          'zendesk_support.macro.instance.MacroCategory__NewCategory@f',
          'zendesk_support.macro.instance.Take_it_@sl',
          'zendesk_support.macro.instance.Test',
          'zendesk_support.macro__actions',
          'zendesk_support.macro__restriction',
          'zendesk_support.macro_action',
          'zendesk_support.macro_attachment',
          'zendesk_support.macro_attachment.instance.Customer_not_responding__test_txt@ssuuv',
          'zendesk_support.macro_categories',
          'zendesk_support.macro_categories.instance',
          'zendesk_support.macro_category',
          'zendesk_support.macro_definition',
          'zendesk_support.macros',
          'zendesk_support.macros_actions',
          'zendesk_support.macros_definitions',
          'zendesk_support.monitored_twitter_handle',
          'zendesk_support.monitored_twitter_handles',
          'zendesk_support.oauth_client',
          'zendesk_support.oauth_client.instance.c123',
          'zendesk_support.oauth_client.instance.c124_modified',
          'zendesk_support.oauth_client.instance.myBrand_test',
          'zendesk_support.oauth_client.instance.myBrand_test_oauth',
          'zendesk_support.oauth_client.instance.myBrand_zendesk_client',
          'zendesk_support.oauth_clients',
          'zendesk_support.oauth_global_client',
          'zendesk_support.oauth_global_client.instance.myBrand',
          'zendesk_support.oauth_global_client.instance.myBrand_staging@s',
          'zendesk_support.oauth_global_clients',
          'zendesk_support.organization',
          'zendesk_support.organization.instance.myBrand',
          'zendesk_support.organization.instance.test_org_123@s',
          'zendesk_support.organization.instance.test_org_124@s',
          'zendesk_support.organization__organization_fields',
          'zendesk_support.organization_field',
          'zendesk_support.organization_field.instance.dropdown_26',
          'zendesk_support.organization_field.instance.org_field301',
          'zendesk_support.organization_field.instance.org_field302',
          'zendesk_support.organization_field.instance.org_field305',
          'zendesk_support.organization_field.instance.org_field306',
          'zendesk_support.organization_field.instance.org_field307',
          'zendesk_support.organization_field.instance.org_field_n403',
          'zendesk_support.organization_field.instance.org_field_n404',
          'zendesk_support.organization_field__custom_field_options',
          'zendesk_support.organization_field__custom_field_options.instance.dropdown_26__123',
          'zendesk_support.organization_field__custom_field_options.instance.dropdown_26__v1',
          'zendesk_support.organization_field__custom_field_options.instance.dropdown_26__v2',
          'zendesk_support.organization_field__custom_field_options.instance.dropdown_26__v3',
          'zendesk_support.organization_field_order',
          'zendesk_support.organization_field_order.instance',
          'zendesk_support.organization_fields',
          'zendesk_support.organizations',
          'zendesk_support.resource_collection',
          'zendesk_support.resource_collection.instance.unnamed_0_0',
          'zendesk_support.resource_collection__resources',
          'zendesk_support.resource_collections',
          'zendesk_support.routing_attribute',
          'zendesk_support.routing_attribute.instance.Language',
          'zendesk_support.routing_attribute.instance.Location',
          'zendesk_support.routing_attribute_definition',
          'zendesk_support.routing_attribute_definitions',
          'zendesk_support.routing_attribute_value',
          'zendesk_support.routing_attribute_value.instance.Language__Italian',
          'zendesk_support.routing_attribute_value.instance.Language__Spanish',
          'zendesk_support.routing_attribute_value.instance.Location__San_Francisco@uus',
          'zendesk_support.routing_attribute_value.instance.Location__Tel_Aviv@uus',
          'zendesk_support.routing_attribute_value__attribute_values',
          'zendesk_support.routing_attribute_value__conditions',
          'zendesk_support.routing_attribute_value__conditions__all',
          'zendesk_support.routing_attributes',
          'zendesk_support.sharing_agreement',
          'zendesk_support.sharing_agreements',
          'zendesk_support.sla_policies',
          'zendesk_support.sla_policies_definitions',
          'zendesk_support.sla_policies_definitions__value',
          'zendesk_support.sla_policy',
          'zendesk_support.sla_policy.instance.SLA_501@s',
          'zendesk_support.sla_policy.instance.SLA_502@s',
          'zendesk_support.sla_policy__filter',
          'zendesk_support.sla_policy__filter__all',
          'zendesk_support.sla_policy__policy_metrics',
          'zendesk_support.sla_policy_definition',
          'zendesk_support.sla_policy_order',
          'zendesk_support.sla_policy_order.instance',
          'zendesk_support.support_address',
          'zendesk_support.support_address.instance.myBrand',
          'zendesk_support.support_addresses',
          'zendesk_support.tag',
          'zendesk_support.tag.instance.Social',
          'zendesk_support.target',
          'zendesk_support.target.instance.Slack_integration_Endpoint_url_target_v2@ssuuu',
          'zendesk_support.targets',
          'zendesk_support.ticket_field',
          'zendesk_support.ticket_field.instance.Assignee_assignee',
          'zendesk_support.ticket_field.instance.Customer_Tier_multiselect@su',
          'zendesk_support.ticket_field.instance.Description_description',
          'zendesk_support.ticket_field.instance.Group_group',
          'zendesk_support.ticket_field.instance.Priority_priority',
          'zendesk_support.ticket_field.instance.Product_components_multiselect@su',
          'zendesk_support.ticket_field.instance.Status_status',
          'zendesk_support.ticket_field.instance.Subject_subject',
          'zendesk_support.ticket_field.instance.Type_tickettype',
          'zendesk_support.ticket_field.instance.agent_dropdown_643_for_agent_multiselect@ssssu',
          'zendesk_support.ticket_field.instance.agent_field_431_text@ssu',
          'zendesk_support.ticket_field.instance.credit_card_1_partialcreditcard@ssu',
          'zendesk_support.ticket_field.instance.zip_code_with_validation_regexp@sssu',
          'zendesk_support.ticket_field__custom_field_options',
          'zendesk_support.ticket_field__custom_field_options.instance.Customer_Tier_multiselect_su__enterprise@uumuu',
          'zendesk_support.ticket_field__custom_field_options.instance.Customer_Tier_multiselect_su__free@uumuu',
          'zendesk_support.ticket_field__custom_field_options.instance.Customer_Tier_multiselect_su__paying@uumuu',
          'zendesk_support.ticket_field__custom_field_options.instance.Product_components_multiselect_su__component_a@uumuuu',
          'zendesk_support.ticket_field__custom_field_options.instance.Product_components_multiselect_su__component_b@uumuuu',
          'zendesk_support.ticket_field__custom_field_options.instance.agent_dropdown_643_for_agent_multiselect_ssssu__v1@uuuuumuu',
          'zendesk_support.ticket_field__custom_field_options.instance.agent_dropdown_643_for_agent_multiselect_ssssu__v2_modified@uuuuumuuu',
          'zendesk_support.ticket_field__system_field_options',
          'zendesk_support.ticket_fields',
          'zendesk_support.ticket_form',
          'zendesk_support.ticket_form.instance.Amazing_ticket_form@s',
          'zendesk_support.ticket_form.instance.Default_Ticket_Form@s',
          'zendesk_support.ticket_form.instance.Demo_ticket_form@s',
          'zendesk_support.ticket_form.instance.Form_11@s',
          'zendesk_support.ticket_form.instance.Form_12@s',
          'zendesk_support.ticket_form.instance.Form_13@s',
          'zendesk_support.ticket_form.instance.Form_6436@s',
          'zendesk_support.ticket_form_order',
          'zendesk_support.ticket_form_order.instance',
          'zendesk_support.ticket_forms',
          'zendesk_support.trigger',
          'zendesk_support.trigger.instance.Auto_assign_to_first_email_responding_agent@bsssss',
          'zendesk_support.trigger.instance.Notify_all_agents_of_received_request@s',
          'zendesk_support.trigger.instance.Notify_assignee_of_assignment@s',
          'zendesk_support.trigger.instance.Notify_assignee_of_comment_update@s',
          'zendesk_support.trigger.instance.Notify_assignee_of_reopened_ticket@s',
          'zendesk_support.trigger.instance.Notify_group_of_assignment@s',
          'zendesk_support.trigger.instance.Notify_requester_and_CCs_of_comment_update@s',
          'zendesk_support.trigger.instance.Notify_requester_and_CCs_of_received_request@s',
          'zendesk_support.trigger.instance.Notify_requester_of_new_proactive_ticket@s',
          'zendesk_support.trigger.instance.Slack_Ticket_Trigger@s',
          'zendesk_support.trigger__actions',
          'zendesk_support.trigger__conditions',
          'zendesk_support.trigger__conditions__all',
          'zendesk_support.trigger__conditions__any',
          'zendesk_support.trigger_categories',
          'zendesk_support.trigger_categories__links',
          'zendesk_support.trigger_categories__meta',
          'zendesk_support.trigger_category',
          'zendesk_support.trigger_category.instance.Custom_Events@s',
          'zendesk_support.trigger_category.instance.Custom_Events___edited@ssbs',
          'zendesk_support.trigger_category.instance.Notifications',
          'zendesk_support.trigger_definition',
          'zendesk_support.trigger_definition__actions',
          'zendesk_support.trigger_definition__actions__metadata',
          'zendesk_support.trigger_definition__actions__metadata__phone_numbers',
          'zendesk_support.trigger_definition__actions__values',
          'zendesk_support.trigger_definition__conditions_all',
          'zendesk_support.trigger_definition__conditions_all__operators',
          'zendesk_support.trigger_definition__conditions_all__values',
          'zendesk_support.trigger_definition__conditions_any',
          'zendesk_support.trigger_definition__conditions_any__operators',
          'zendesk_support.trigger_definition__conditions_any__values',
          'zendesk_support.trigger_definitions',
          'zendesk_support.trigger_order',
          'zendesk_support.trigger_order.instance',
          'zendesk_support.trigger_order_entry',
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
          'zendesk_support.user_field.instance.f207',
          'zendesk_support.user_field.instance.f208',
          'zendesk_support.user_field.instance.f209',
          'zendesk_support.user_field.instance.f210',
          'zendesk_support.user_field.instance.f211',
          'zendesk_support.user_field.instance.f212',
          'zendesk_support.user_field.instance.f213',
          'zendesk_support.user_field.instance.f214',
          'zendesk_support.user_field.instance.f215',
          'zendesk_support.user_field.instance.f216',
          'zendesk_support.user_field.instance.f217',
          'zendesk_support.user_field.instance.f218',
          'zendesk_support.user_field.instance.f219',
          'zendesk_support.user_field.instance.f220',
          'zendesk_support.user_field.instance.modified_multi75_key',
          'zendesk_support.user_field.instance.numeric65',
          'zendesk_support.user_field.instance.regex_6546',
          'zendesk_support.user_field.instance.this_is_a_checkbox',
          'zendesk_support.user_field__custom_field_options',
          'zendesk_support.user_field__custom_field_options.instance.dropdown_25__another_choice',
          'zendesk_support.user_field__custom_field_options.instance.dropdown_25__bla_edited',
          'zendesk_support.user_field__custom_field_options.instance.dropdown_25__choice1_tag',
          'zendesk_support.user_field_order',
          'zendesk_support.user_field_order.instance',
          'zendesk_support.user_fields',
          'zendesk_support.view',
          'zendesk_support.view.instance.All_unsolved_tickets@s',
          'zendesk_support.view.instance.Copy_of_All_unsolved_tickets@s',
          'zendesk_support.view.instance.Current_tasks@s',
          'zendesk_support.view.instance.Custom_view_1234@s',
          'zendesk_support.view.instance.Custom_view_123@s',
          'zendesk_support.view.instance.New_tickets_in_your_groups@s',
          'zendesk_support.view.instance.Overdue_tasks@s',
          'zendesk_support.view.instance.Pending_tickets@s',
          'zendesk_support.view.instance.Recently_solved_tickets@s',
          'zendesk_support.view.instance.Recently_updated_tickets@s',
          'zendesk_support.view.instance.Test',
          'zendesk_support.view.instance.Test2',
          'zendesk_support.view.instance.Unassigned_tickets@s',
          'zendesk_support.view.instance.Unassigned_tickets___2@ssbs',
          'zendesk_support.view.instance.Unsolved_tickets_in_your_groups@s',
          'zendesk_support.view.instance.Your_unsolved_tickets@s',
          'zendesk_support.view__conditions',
          'zendesk_support.view__conditions__all',
          'zendesk_support.view__conditions__any',
          'zendesk_support.view__execution',
          'zendesk_support.view__execution__columns',
          'zendesk_support.view__execution__custom_fields',
          'zendesk_support.view__execution__fields',
          'zendesk_support.view__execution__group',
          'zendesk_support.view__execution__sort',
          'zendesk_support.view__restriction',
          'zendesk_support.view_order',
          'zendesk_support.view_order.instance',
          'zendesk_support.views',
          'zendesk_support.webhook',
          'zendesk_support.webhook.instance.test',
          'zendesk_support.webhook__authentication',
          'zendesk_support.webhooks',
          'zendesk_support.webhooks__meta',
          'zendesk_support.workspace',
          'zendesk_support.workspace.instance.New_Workspace_123@s',
          'zendesk_support.workspace__apps',
          'zendesk_support.workspace__conditions',
          'zendesk_support.workspace__conditions__all',
          'zendesk_support.workspace__conditions__any',
          'zendesk_support.workspace__selected_macros',
          'zendesk_support.workspace__selected_macros__restriction',
          'zendesk_support.workspace_order',
          'zendesk_support.workspace_order.instance',
          'zendesk_support.workspaces',
        ])

        const supportAddress = elements.filter(isInstanceElement).find(e => e.elemID.getFullName().startsWith('zendesk_support.support_address.instance.myBrand'))
        expect(supportAddress).toBeDefined()
        expect(supportAddress?.value).toMatchObject({
          id: 1500000743022,
          default: true,
          name: 'myBrand',
          email: 'support@myBrand.zendesk.com',
          // eslint-disable-next-line camelcase
          brand_id: expect.any(ReferenceExpression),
        })
        expect(supportAddress?.value.brand_id.elemID.getFullName()).toEqual('zendesk_support.brand.instance.myBrand')
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
                include: [{
                  type: 'group',
                }],
                exclude: [],
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
        const instances = elements.filter(isInstanceElement)
        expect(instances.map(e => e.elemID.getFullName()).sort())
          .toEqual([
            'zendesk_support.group.instance.Support',
            'zendesk_support.group.instance.Support2',
            'zendesk_support.group.instance.Support4',
            'zendesk_support.group.instance.Support5',
            // The order element are always created on fetch
            'zendesk_support.automation_order.instance',
            'zendesk_support.organization_field_order.instance',
            'zendesk_support.sla_policy_order.instance',
            'zendesk_support.ticket_form_order.instance',
            'zendesk_support.trigger_order.instance',
            'zendesk_support.user_field_order.instance',
            'zendesk_support.view_order.instance',
            'zendesk_support.workspace_order.instance',
          ].sort())
      })
    })
    it('should use elemIdGetter', async () => {
      const supportInstanceId = 1500002894482
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
              include: [{
                type: 'group',
              }],
              exclude: [],

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
        getElemIdFunc: (adapterName, serviceIds, name) => {
          if (Number(serviceIds.id) === supportInstanceId) {
            return new ElemID(adapterName, 'group', 'instance', 'Support')
          }
          return new ElemID(adapterName, name)
        },
      })
      const { elements } = await operations
        .fetch({ progressReporter: { reportProgress: () => null } })
      const instances = elements
        .filter(isInstanceElement)
        .filter(inst => inst.elemID.typeName === 'group')
      expect(instances).toHaveLength(4)
      expect(instances.map(e => e.elemID.getFullName()).sort()).toEqual([
        'zendesk_support.group.instance.Support',
        'zendesk_support.group.instance.Support2',
        'zendesk_support.group.instance.Support4',
        'zendesk_support.group.instance.Support5',
      ])
      const response = {
        groups: [
          {
            url: 'https://myBrand.zendesk.com/api/v2/groups/1500002894482.json',
            id: supportInstanceId,
            name: 'Support - Edited',
            description: '',
            default: true,
            deleted: false,
            created_at: '2021-05-18T19:00:44Z',
            updated_at: '2021-05-18T19:00:44Z',
          },
        ],
        next_page: null,
        previous_page: null,
        count: 1,
      }
      mockAxiosAdapter.onGet('/groups').replyOnce(
        200, response
      )
      const usersResponse = {
        users: [
          {
            id: 1529420581222,
            url: 'https://myBrand.zendesk.com/api/v2/users/1529420581222.json',
            name: 'Tester',
            email: 'tester@myBrand.com',
            created_at: '2022-01-11T15:44:17Z',
            updated_at: '2022-01-13T18:57:52Z',
            time_zone: 'America/Los_Angeles',
            iana_time_zone: 'America/Los_Angeles',
            phone: null,
            shared_phone_number: null,
            photo: null,
            locale_id: 1,
            locale: 'en-US',
            organization_id: 1500709144333,
            role: 'admin',
            verified: true,
            external_id: null,
            tags: [],
            alias: null,
            active: true,
            shared: false,
            shared_agent: false,
            last_login_at: '2022-01-13T16:59:44Z',
            two_factor_auth_enabled: null,
            signature: null,
            details: null,
            notes: null,
            role_type: 4,
            custom_role_id: 1500009793441,
            moderator: true,
            ticket_restriction: null,
            only_private_comments: false,
            restricted_agent: false,
            suspended: false,
            default_group_id: 4414969685139,
            report_csv: true,
            user_fields: {
              userfield1: null,
            },
          },
        ],
        next_page: null,
        previous_page: null,
        count: 1,
      }
      mockAxiosAdapter.onGet('/users').replyOnce(
        200, usersResponse
      )
      const { elements: newElements } = await operations
        .fetch({ progressReporter: { reportProgress: () => null } })
      const newInstances = newElements
        .filter(isInstanceElement)
        .filter(inst => inst.elemID.typeName === 'group')
      expect(newInstances.map(e => e.elemID.getFullName()).sort()).toEqual([
        'zendesk_support.group.instance.Support',
      ])
    })
  })

  describe('deploy', () => {
    let operations: AdapterOperations
    const groupType = new ObjectType({ elemID: new ElemID(ZENDESK_SUPPORT, 'group') })
    const brandType = new ObjectType({ elemID: new ElemID(ZENDESK_SUPPORT, 'brand') })
    const anotherType = new ObjectType({ elemID: new ElemID(ZENDESK_SUPPORT, 'anotherType') })
    beforeEach(() => {
      mockDeployChange.mockImplementation(async change => {
        if (isRemovalChange(change)) {
          throw new Error('some error')
        }
        if (getChangeData<InstanceElement>(change).elemID.typeName === 'group') {
          return { group: { id: 1 } }
        }
        if (getChangeData<InstanceElement>(change).elemID.typeName === 'brand') {
          return { brand: { key: 2 } }
        }
        return { key: 2 }
      })
      operations = adapter.operations({
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
              include: [
                {
                  type: 'group',
                },
                {
                  type: 'brand',
                },
              ],
              exclude: [],
            },
            [API_DEFINITIONS_CONFIG]: {
              types: {
                group: {
                  deployRequests: {
                    add: {
                      url: '/groups',
                      deployAsField: 'group',
                      method: 'post',
                    },
                    modify: {
                      url: '/groups/{groupId}',
                      method: 'put',
                      deployAsField: 'group',
                      urlParamsToFields: {
                        groupId: 'id',
                      },
                    },
                    remove: {
                      url: '/groups/{groupId}',
                      method: 'delete',
                      deployAsField: 'group',
                      urlParamsToFields: {
                        groupId: 'id',
                      },
                    },
                  },
                },
                brand: {
                  transformation: {
                    serviceIdField: 'key',
                  },
                  deployRequests: {
                    add: {
                      url: '/brands',
                      method: 'post',
                    },
                  },
                },
                anotherType: {
                  transformation: {
                    serviceIdField: 'key',
                  },
                  deployRequests: {
                    add: {
                      url: '/anotherType',
                      method: 'post',
                    },
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
                brands: {
                  request: {
                    url: '/brands',
                  },
                  transformation: {
                    dataField: 'brands',
                  },
                },
              },
            },
          }
        ),
        elementsSource: buildElementsSourceFromElements([]),
      })
    })
    afterEach(() => {
      mockDeployChange.mockRestore()
    })

    it('should return the applied changes', async () => {
      const ref = new ReferenceExpression(
        new ElemID(ZENDESK_SUPPORT, 'test', 'instance', 'ins'),
        { externalId: 5 },
      )
      const modificationChange = toChange({
        before: new InstanceElement('inst4', brandType, { externalId: 4 }),
        after: new InstanceElement('inst4', brandType, { externalId: 5 }),
      })
      const deployRes = await operations.deploy({
        changeGroup: {
          groupID: 'group',
          changes: [
            toChange({ after: new InstanceElement('inst', groupType) }),
            toChange({ before: new InstanceElement('inst2', groupType) }),
            // explicitly state key so that it appears in the instance's generated type
            toChange({ after: new InstanceElement('inst3', brandType, { ref, key: undefined }) }),
            toChange({ after: new InstanceElement('inst4', anotherType) }),
            modificationChange,
          ],
        },
      })

      // Mind that brands have filter that deploys them before the default instances
      expect(deployRes.appliedChanges).toEqual([
        toChange({ after: new InstanceElement(
          'inst3',
          brandType,
          { key: 2, ref: expect.any(ReferenceExpression) },
          undefined,
          { [CORE_ANNOTATIONS.SERVICE_URL]: 'https://abc.zendesk.com/admin/account/brand_management/brands' },
        ) }),
        modificationChange,
        toChange({ after: new InstanceElement(
          'inst',
          groupType,
          { id: 1 },
          undefined,
          { [CORE_ANNOTATIONS.SERVICE_URL]: 'https://abc.zendesk.com/admin/people/team/groups' },
        ) }),
        toChange({ after: new InstanceElement('inst4', anotherType, { key: 2 }) }),
      ])
    })

    it('should return the errors', async () => {
      const deployRes = await operations.deploy({
        changeGroup: {
          groupID: 'group',
          changes: [
            toChange({ after: new InstanceElement('inst', groupType) }),
            toChange({ before: new InstanceElement('inst2', groupType) }),
          ],
        },
      })

      expect(deployRes.errors).toEqual([
        new Error('some error'),
      ])
    })
    it('should have change validator', () => {
      expect(operations.deployModifiers?.changeValidator).toBeDefined()
    })
    it('should not update id if deployChange result is an array', async () => {
      mockDeployChange.mockImplementation(async () => [{ id: 2 }])
      const deployRes = await operations.deploy({
        changeGroup: {
          groupID: 'group',
          changes: [
            toChange({ after: new InstanceElement('inst', groupType) }),
          ],
        },
      })
      expect(deployRes.appliedChanges).toEqual([
        toChange({ after: new InstanceElement(
          'inst',
          groupType,
          undefined,
          undefined,
          { [CORE_ANNOTATIONS.SERVICE_URL]: 'https://abc.zendesk.com/admin/people/team/groups' },
        ) }),
      ])
    })
    it('should not update id if the response is primitive', async () => {
      mockDeployChange.mockImplementation(async () => 2)
      const deployRes = await operations.deploy({
        changeGroup: {
          groupID: 'group',
          changes: [
            toChange({ after: new InstanceElement('inst', groupType) }),
          ],
        },
      })
      expect(deployRes.appliedChanges).toEqual([
        toChange({ after: new InstanceElement(
          'inst',
          groupType,
          undefined,
          undefined,
          { [CORE_ANNOTATIONS.SERVICE_URL]: 'https://abc.zendesk.com/admin/people/team/groups' },
        ) }),
      ])
    })
    it('should not update id field if it does not exist in the response', async () => {
      mockDeployChange.mockImplementation(async () => ({ test: 2 }))
      const deployRes = await operations.deploy({
        changeGroup: {
          groupID: 'group',
          changes: [
            toChange({ after: new InstanceElement('inst', groupType) }),
          ],
        },
      })
      expect(deployRes.appliedChanges).toEqual([
        toChange({ after: new InstanceElement(
          'inst',
          groupType,
          undefined,
          undefined,
          { [CORE_ANNOTATIONS.SERVICE_URL]: 'https://abc.zendesk.com/admin/people/team/groups' },
        ) }),
      ])
    })
    it('should call deploy with the fixed type', async () => {
      const instance = new InstanceElement('inst', groupType, { name: 'test' })
      await operations.deploy({
        changeGroup: {
          groupID: 'group',
          changes: [
            toChange({ after: instance }),
          ],
        },
      })
      expect(mockDeployChange).toHaveBeenCalledWith(
        toChange({
          after: new InstanceElement(
            instance.elemID.name,
            new ObjectType({
              elemID: groupType.elemID,
              fields: {
                id: {
                  refType: BuiltinTypes.SERVICE_ID_NUMBER,
                  annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true },
                },
                name: { refType: BuiltinTypes.STRING },
              },
              // generateType function creates path
              path: [ZENDESK_SUPPORT, elementsUtils.TYPES_PATH, 'group'],
            }),
            { ...instance.value, id: 1 },
            undefined,
            { [CORE_ANNOTATIONS.SERVICE_URL]: 'https://abc.zendesk.com/admin/people/team/groups' },
          ),
        }),
        expect.anything(),
        expect.anything(),
        undefined,
      )
    })
    it('should not try to deploy instances', async () => {
      mockDeployChange.mockImplementation(async () => ({}))
      const deployRes = await operations.deploy({
        changeGroup: {
          groupID: 'group',
          changes: [
            toChange({ before: new InstanceElement('inst', groupType) }),
            toChange({ after: new ObjectType({ elemID: new ElemID(ZENDESK_SUPPORT, 'test') }) }),
          ],
        },
      })
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith(
        toChange({ before: new InstanceElement(
          'inst',
          new ObjectType({
            elemID: groupType.elemID,
            fields: {
              id: {
                refType: BuiltinTypes.SERVICE_ID_NUMBER,
                annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true },
              },
            },
            // generateType function creates path
            path: [ZENDESK_SUPPORT, elementsUtils.TYPES_PATH, 'group'],
          }),
        ) }),
        expect.anything(),
        expect.anything(),
        undefined,
      )
      expect(deployRes.appliedChanges).toEqual([
        toChange({ before: new InstanceElement('inst', groupType) }),
      ])
    })
  })
})
