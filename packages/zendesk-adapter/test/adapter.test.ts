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
import _ from 'lodash'
import axios, { AxiosRequestConfig } from 'axios'
import MockAdapter from 'axios-mock-adapter'
import {
  InstanceElement,
  isInstanceElement,
  ReferenceExpression,
  AdapterOperations,
  toChange,
  ObjectType,
  ElemID,
  BuiltinTypes,
  CORE_ANNOTATIONS,
  isRemovalChange,
  getChangeData, TemplateExpression,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { elements as elementsUtils } from '@salto-io/adapter-components'
import defaultBrandMockReplies from './mock_replies/myBrand_mock_replies.json'
import brandWithGuideMockReplies from './mock_replies/brandWithGuide_mock_replies.json'
import { adapter } from '../src/adapter_creator'
import { usernamePasswordCredentialsType } from '../src/auth'
import { configType, FETCH_CONFIG, API_DEFINITIONS_CONFIG, DEFAULT_CONFIG } from '../src/config'
import {
  BRAND_TYPE_NAME,
  GUIDE_LANGUAGE_SETTINGS_TYPE_NAME,
  USER_SEGMENT_TYPE_NAME,
  ZENDESK,
} from '../src/constants'
import { createEveryoneUserSegmentInstance } from '../src/filters/everyone_user_segment'
import ZendeskAdapter from '../src/adapter'
import { createFilterCreatorParams } from './utils'

type MockReply = {
  url: string
  params: Record<string, string | undefined>
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const callbackResponseFunc = (config: AxiosRequestConfig): any => {
  const { baseURL, url, params } = config
  const requestParams = !_.isEmpty(params) ? { params } : undefined
  if (baseURL?.toLowerCase() === 'https://mybrand.zendesk.com') {
    return [
      200,
      (defaultBrandMockReplies as MockReply[])
        .find(reply => reply.url === url && _.isEqual(reply.params, requestParams?.params))?.response || [],
    ]
  }
  if (baseURL?.toLowerCase() === 'https://brandwithguide.zendesk.com') {
    return [
      200,
      (brandWithGuideMockReplies as MockReply[]).find(reply => reply.url === url, [])?.response
        || [],
    ]
  }
  return [404]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const callbackResponseFuncWith403 = (config: AxiosRequestConfig): any => {
  const { url } = config
  if (url !== undefined && url.includes('custom_status')) {
    return [403]
  }
  return callbackResponseFunc(config)
}


describe('adapter', () => {
  let mockAxiosAdapter: MockAdapter
  const userSegmentType = new ObjectType({
    elemID: new ElemID(ZENDESK, USER_SEGMENT_TYPE_NAME),
  })
  const everyoneUserSegmentInstance = createEveryoneUserSegmentInstance(userSegmentType)

  beforeEach(async () => {
    mockAxiosAdapter = new MockAdapter(axios, { delayResponse: 1, onNoMatch: 'throwException' })
    mockAxiosAdapter.onGet('/api/v2/account/settings').replyOnce(200, { settings: {} })
  })

  afterEach(() => {
    mockAxiosAdapter.restore()
  })

  describe('fetch', () => {
    describe('full fetch', () => {
      it('should generate the right elements on fetch', async () => {
        mockAxiosAdapter.onGet().reply(callbackResponseFunc)
        const { elements } = await adapter.operations({
          credentials: new InstanceElement(
            'config',
            usernamePasswordCredentialsType,
            { username: 'user123', password: 'token456', subdomain: 'myBrand' },
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
                guide: {
                  brands: ['.*'],
                },
              },
            }
          ),
          elementsSource: buildElementsSourceFromElements([]),
        }).fetch({ progressReporter: { reportProgress: () => null } })
        expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual([
          'zendesk.account_features',
          'zendesk.account_setting',
          'zendesk.account_setting.instance',
          'zendesk.account_setting__active_features',
          'zendesk.account_setting__agents',
          'zendesk.account_setting__api',
          'zendesk.account_setting__apps',
          'zendesk.account_setting__billing',
          'zendesk.account_setting__branding',
          'zendesk.account_setting__brands',
          'zendesk.account_setting__cdn',
          'zendesk.account_setting__cdn__hosts',
          'zendesk.account_setting__chat',
          'zendesk.account_setting__cross_sell',
          'zendesk.account_setting__gooddata_advanced_analytics',
          'zendesk.account_setting__google_apps',
          'zendesk.account_setting__groups',
          'zendesk.account_setting__knowledge',
          'zendesk.account_setting__limits',
          'zendesk.account_setting__localization',
          'zendesk.account_setting__lotus',
          'zendesk.account_setting__metrics',
          'zendesk.account_setting__onboarding',
          'zendesk.account_setting__routing',
          'zendesk.account_setting__rule',
          'zendesk.account_setting__screencast',
          'zendesk.account_setting__statistics',
          'zendesk.account_setting__ticket_form',
          'zendesk.account_setting__ticket_sharing_partners',
          'zendesk.account_setting__tickets',
          'zendesk.account_setting__twitter',
          'zendesk.account_setting__user',
          'zendesk.account_setting__voice',
          'zendesk.account_settings',
          'zendesk.api_token',
          'zendesk.api_tokens',
          'zendesk.app_installation',
          'zendesk.app_installation.instance.Salesforce_10',
          'zendesk.app_installation.instance.Slack_156097',
          'zendesk.app_installation__plan_information',
          'zendesk.app_installation__settings',
          'zendesk.app_installation__settings_objects',
          'zendesk.app_installations',
          'zendesk.app_owned',
          'zendesk.app_owned.instance.xr_app',
          'zendesk.app_owned__parameters',
          'zendesk.apps_owned',
          'zendesk.article',
          'zendesk.article.instance.How_can_agents_leverage_knowledge_to_help_customers__Apex_Development_myBrand@sssssssauuu',
          'zendesk.article.instance.Title_Yo___greatSection_greatCategory_brandWithGuide@ssauuu',
          'zendesk.article_attachment',
          'zendesk.article_attachment__article_attachments',
          'zendesk.article_order',
          'zendesk.article_order.instance.Announcements_General_myBrand',
          'zendesk.article_order.instance.Apex_Development_myBrand',
          'zendesk.article_order.instance.Billing_and_Subscriptions_General_myBrand_ssuu@uuuum',
          'zendesk.article_order.instance.FAQ_General_myBrand',
          'zendesk.article_order.instance.Internal_KB_General_myBrand_suu@uuum',
          'zendesk.article_order.instance.greatSection_greatCategory_brandWithGuide',
          'zendesk.article_translation',
          'zendesk.article_translation.instance.How_can_agents_leverage_knowledge_to_help_customers__Apex_Development_myBrand_sssssssauuu__myBrand_en_us_ub@uuuuuuuuuuumuuuum',
          'zendesk.article_translation.instance.Title_Yo___greatSection_greatCategory_brandWithGuide_ssauuu__brandWithGuide_en_us_ub@uuuuuumuuuum',
          'zendesk.article_translation__translations',
          'zendesk.articles',
          'zendesk.automation',
          'zendesk.automation.instance.Close_ticket_4_days_after_status_is_set_to_solved@s',
          'zendesk.automation.instance.Close_ticket_5_days_after_status_is_set_to_solved@s',
          'zendesk.automation.instance.Pending_notification_24_hours@s',
          'zendesk.automation.instance.Pending_notification_5_days@s',
          'zendesk.automation.instance.Tag_tickets_from_Social@s',
          'zendesk.automation__actions',
          'zendesk.automation__conditions',
          'zendesk.automation__conditions__all',
          'zendesk.automation__conditions__any',
          'zendesk.automation_order',
          'zendesk.automation_order.instance',
          'zendesk.automations',
          'zendesk.brand',
          'zendesk.brand.instance.brandWithGuide',
          'zendesk.brand.instance.brandWithoutGuide',
          'zendesk.brand.instance.myBrand',
          'zendesk.brand_logo',
          'zendesk.brands',
          'zendesk.business_hours_schedule',
          'zendesk.business_hours_schedule.instance.New_schedule@s',
          'zendesk.business_hours_schedule.instance.Schedule_2@s',
          'zendesk.business_hours_schedule.instance.Schedule_3@s',
          'zendesk.business_hours_schedule__intervals',
          'zendesk.business_hours_schedule_holiday',
          'zendesk.business_hours_schedule_holiday.instance.New_schedule_s__Holiday1@umuu',
          'zendesk.business_hours_schedule_holiday.instance.Schedule_3_s__Holi2@umuu',
          'zendesk.business_hours_schedule_holiday__holidays',
          'zendesk.business_hours_schedules',
          'zendesk.categories',
          'zendesk.category',
          'zendesk.category.instance.Development_myBrand',
          'zendesk.category.instance.General_myBrand',
          'zendesk.category.instance.greatCategory_brandWithGuide',
          'zendesk.category_order',
          'zendesk.category_order.instance.brandWithGuide',
          'zendesk.category_order.instance.myBrand',
          'zendesk.category_translation',
          'zendesk.category_translation.instance.Development_myBrand__myBrand_en_us_ub@uuuuum',
          'zendesk.category_translation.instance.General_myBrand__myBrand_en_us_ub@uuuuum',
          'zendesk.category_translation__translations',
          'zendesk.channel',
          'zendesk.channel.instance.Answer_Bot_for_Web_Widget@s',
          'zendesk.channel.instance.Automation',
          'zendesk.channel.instance.CTI_phone_call__incoming_@sssjk',
          'zendesk.channel.instance.CTI_phone_call__outgoing_@sssjk',
          'zendesk.channel.instance.CTI_voicemail@s',
          'zendesk.channel.instance.Channel_Integrations@s',
          'zendesk.channel.instance.Chat',
          'zendesk.channel.instance.Closed_ticket@s',
          'zendesk.channel.instance.Email',
          'zendesk.channel.instance.Facebook_Messenger@s',
          'zendesk.channel.instance.Facebook_Post@s',
          'zendesk.channel.instance.Facebook_Private_Message@s',
          'zendesk.channel.instance.Forum_topic@s',
          'zendesk.channel.instance.Get_Satisfaction@s',
          'zendesk.channel.instance.Help_Center_post@s',
          'zendesk.channel.instance.Instagram_Direct@s',
          'zendesk.channel.instance.LINE',
          'zendesk.channel.instance.Mobile',
          'zendesk.channel.instance.Mobile_SDK@s',
          'zendesk.channel.instance.Phone_call__incoming_@ssjk',
          'zendesk.channel.instance.Phone_call__outgoing_@ssjk',
          'zendesk.channel.instance.Satisfaction_Prediction@s',
          'zendesk.channel.instance.Text',
          'zendesk.channel.instance.Ticket_sharing@s',
          'zendesk.channel.instance.Twitter',
          'zendesk.channel.instance.Twitter_DM@s',
          'zendesk.channel.instance.Twitter_Direct_Message@s',
          'zendesk.channel.instance.Twitter_Like@s',
          'zendesk.channel.instance.Voicemail',
          'zendesk.channel.instance.WeChat',
          'zendesk.channel.instance.Web_Widget@s',
          'zendesk.channel.instance.Web_form@s',
          'zendesk.channel.instance.Web_service__API_@ssjk',
          'zendesk.channel.instance.WhatsApp',
          'zendesk.custom_role',
          'zendesk.custom_role.instance.Advisor',
          'zendesk.custom_role.instance.Billing_admin@s',
          'zendesk.custom_role.instance.Contributor',
          'zendesk.custom_role.instance.Light_agent@s',
          'zendesk.custom_role.instance.Staff',
          'zendesk.custom_role.instance.Team_lead@s',
          'zendesk.custom_role__configuration',
          'zendesk.custom_roles',
          'zendesk.custom_status',
          'zendesk.custom_status.instance.new___zd_status_new__@u_00123_00123vu_00125_00125',
          'zendesk.custom_status.instance.open___zd_status_open__@u_00123_00123vu_00125_00125',
          'zendesk.custom_status.instance.open_test_n1',
          'zendesk.custom_status.instance.open_test_n1@ub',
          'zendesk.custom_statuses',
          'zendesk.dynamic_content_item',
          'zendesk.dynamic_content_item.instance.Dynamic_content_item_title_543@s',
          'zendesk.dynamic_content_item.instance.dynamic_content_item_544@s',
          'zendesk.dynamic_content_item__variants',
          'zendesk.dynamic_content_item__variants.instance.Dynamic_content_item_title_543_s__en_US_b@uuuumuuum',
          'zendesk.dynamic_content_item__variants.instance.dynamic_content_item_544_s__en_US_b@uuumuuum',
          'zendesk.dynamic_content_item__variants.instance.dynamic_content_item_544_s__es@uuumuu',
          'zendesk.dynamic_content_item__variants.instance.dynamic_content_item_544_s__he@uuumuu',
          'zendesk.features',
          'zendesk.group',
          'zendesk.group.instance.Support',
          'zendesk.group.instance.Support2',
          'zendesk.group.instance.Support4',
          'zendesk.group.instance.Support5',
          'zendesk.groups',
          'zendesk.guide_language_settings',
          'zendesk.guide_language_settings.instance.brandWithGuide_ar',
          'zendesk.guide_language_settings.instance.brandWithGuide_en_us@ub',
          'zendesk.guide_language_settings.instance.brandWithGuide_he',
          'zendesk.guide_language_settings.instance.myBrand_ar',
          'zendesk.guide_language_settings.instance.myBrand_en_us@ub',
          'zendesk.guide_language_settings.instance.myBrand_he',
          'zendesk.guide_settings',
          'zendesk.guide_settings.instance.brandWithGuide',
          'zendesk.guide_settings.instance.myBrand',
          'zendesk.guide_settings__help_center',
          'zendesk.guide_settings__help_center__settings',
          'zendesk.guide_settings__help_center__settings__preferences',
          'zendesk.guide_settings__help_center__text_filter',
          'zendesk.locale',
          'zendesk.locale.instance.en_US@b',
          'zendesk.locale.instance.es',
          'zendesk.locale.instance.he',
          'zendesk.locales',
          'zendesk.macro',
          'zendesk.macro.instance.Close_and_redirect_to_topics@s',
          'zendesk.macro.instance.Close_and_redirect_to_topics_2@s',
          'zendesk.macro.instance.Customer_not_responding@s',
          'zendesk.macro.instance.Customer_not_responding__copy__with_rich_text@sssjksss',
          'zendesk.macro.instance.Downgrade_and_inform@s',
          'zendesk.macro.instance.MacroCategory__NewCategory@f',
          'zendesk.macro.instance.Take_it_@sl',
          'zendesk.macro.instance.Test',
          'zendesk.macro__actions',
          'zendesk.macro__restriction',
          'zendesk.macro_action',
          'zendesk.macro_attachment',
          'zendesk.macro_attachment.instance.Customer_not_responding__test_txt@ssuuv',
          'zendesk.macro_categories',
          'zendesk.macro_categories.instance',
          'zendesk.macro_category',
          'zendesk.macro_definition',
          'zendesk.macros',
          'zendesk.macros_actions',
          'zendesk.macros_definitions',
          'zendesk.monitored_twitter_handle',
          'zendesk.monitored_twitter_handles',
          'zendesk.oauth_client',
          'zendesk.oauth_client.instance.c123',
          'zendesk.oauth_client.instance.c124_modified',
          'zendesk.oauth_client.instance.myBrand_test',
          'zendesk.oauth_client.instance.myBrand_test_oauth',
          'zendesk.oauth_client.instance.myBrand_zendesk_client',
          'zendesk.oauth_clients',
          'zendesk.oauth_global_client',
          'zendesk.oauth_global_client.instance.myBrand',
          'zendesk.oauth_global_client.instance.myBrand_staging@s',
          'zendesk.oauth_global_clients',
          'zendesk.oauth_token',
          'zendesk.oauth_tokens',
          'zendesk.organization',
          'zendesk.organization.instance.myBrand',
          'zendesk.organization.instance.test_org_123@s',
          'zendesk.organization.instance.test_org_124@s',
          'zendesk.organization__organization_fields',
          'zendesk.organization_field',
          'zendesk.organization_field.instance.dropdown_26',
          'zendesk.organization_field.instance.org_field301',
          'zendesk.organization_field.instance.org_field302',
          'zendesk.organization_field.instance.org_field305',
          'zendesk.organization_field.instance.org_field306',
          'zendesk.organization_field.instance.org_field307',
          'zendesk.organization_field.instance.org_field_n403',
          'zendesk.organization_field.instance.org_field_n404',
          'zendesk.organization_field__custom_field_options',
          'zendesk.organization_field__custom_field_options.instance.dropdown_26__123',
          'zendesk.organization_field__custom_field_options.instance.dropdown_26__v1',
          'zendesk.organization_field__custom_field_options.instance.dropdown_26__v2',
          'zendesk.organization_field__custom_field_options.instance.dropdown_26__v3',
          'zendesk.organization_field_order',
          'zendesk.organization_field_order.instance',
          'zendesk.organization_fields',
          'zendesk.organizations',
          'zendesk.permission_group',
          'zendesk.permission_group.instance.Admins',
          'zendesk.permission_groups',
          'zendesk.resource_collection',
          'zendesk.resource_collection.instance.unnamed_0_0',
          'zendesk.resource_collection__resources',
          'zendesk.resource_collections',
          'zendesk.routing_attribute',
          'zendesk.routing_attribute.instance.Language',
          'zendesk.routing_attribute.instance.Location',
          'zendesk.routing_attribute_definition',
          'zendesk.routing_attribute_definitions',
          'zendesk.routing_attribute_value',
          'zendesk.routing_attribute_value.instance.Language__Italian',
          'zendesk.routing_attribute_value.instance.Language__Spanish',
          'zendesk.routing_attribute_value.instance.Location__San_Francisco@uus',
          'zendesk.routing_attribute_value.instance.Location__Tel_Aviv@uus',
          'zendesk.routing_attribute_value__attribute_values',
          'zendesk.routing_attribute_value__conditions',
          'zendesk.routing_attribute_value__conditions__all',
          'zendesk.routing_attributes',
          'zendesk.section',
          'zendesk.section.instance.Announcements_General_myBrand',
          'zendesk.section.instance.Apex_Development_myBrand',
          'zendesk.section.instance.Billing_and_Subscriptions_General_myBrand@ssuu',
          'zendesk.section.instance.FAQ_General_myBrand',
          'zendesk.section.instance.Internal_KB_General_myBrand@suu',
          'zendesk.section.instance.greatSection_greatCategory_brandWithGuide',
          'zendesk.section_order',
          'zendesk.section_order.instance.Announcements_General_myBrand',
          'zendesk.section_order.instance.Apex_Development_myBrand',
          'zendesk.section_order.instance.Billing_and_Subscriptions_General_myBrand_ssuu@uuuum',
          'zendesk.section_order.instance.Development_myBrand',
          'zendesk.section_order.instance.FAQ_General_myBrand',
          'zendesk.section_order.instance.General_myBrand',
          'zendesk.section_order.instance.Internal_KB_General_myBrand_suu@uuum',
          'zendesk.section_order.instance.greatCategory_brandWithGuide',
          'zendesk.section_order.instance.greatSection_greatCategory_brandWithGuide',
          'zendesk.section_translation',
          'zendesk.section_translation.instance.Announcements_General_myBrand__myBrand_en_us_ub@uuuuuum',
          'zendesk.section_translation.instance.Apex_Development_myBrand__myBrand_en_us_ub@uuuuuum',
          'zendesk.section_translation.instance.Billing_and_Subscriptions_General_myBrand_ssuu__myBrand_en_us_ub@uuuumuuuum',
          'zendesk.section_translation.instance.FAQ_General_myBrand__myBrand_en_us_ub@uuuuuum',
          'zendesk.section_translation.instance.Internal_KB_General_myBrand_suu__myBrand_en_us_ub@uuumuuuum',
          'zendesk.section_translation__translations',
          'zendesk.sections',
          'zendesk.sharing_agreement',
          'zendesk.sharing_agreements',
          'zendesk.sla_policies',
          'zendesk.sla_policies_definitions',
          'zendesk.sla_policies_definitions__value',
          'zendesk.sla_policy',
          'zendesk.sla_policy.instance.SLA_501@s',
          'zendesk.sla_policy.instance.SLA_502@s',
          'zendesk.sla_policy__filter',
          'zendesk.sla_policy__filter__all',
          'zendesk.sla_policy__filter__any',
          'zendesk.sla_policy__policy_metrics',
          'zendesk.sla_policy_definition',
          'zendesk.sla_policy_order',
          'zendesk.sla_policy_order.instance',
          'zendesk.support_address',
          'zendesk.support_address.instance.myBrand_support_myBrand_subdomain_zendesk_com@umvvv',
          'zendesk.support_addresses',
          'zendesk.tag',
          'zendesk.tag.instance.Social',
          'zendesk.tag.instance.checked32',
          'zendesk.target',
          'zendesk.target.instance.Slack_integration_Endpoint_url_target_v2@ssuuu',
          'zendesk.targets',
          'zendesk.ticket_field',
          'zendesk.ticket_field.instance.Assignee_assignee',
          'zendesk.ticket_field.instance.Customer_Tier_multiselect@su',
          'zendesk.ticket_field.instance.Description_description',
          'zendesk.ticket_field.instance.Group_group',
          'zendesk.ticket_field.instance.Priority_priority',
          'zendesk.ticket_field.instance.Product_components_multiselect@su',
          'zendesk.ticket_field.instance.Status_status',
          'zendesk.ticket_field.instance.Subject_subject',
          'zendesk.ticket_field.instance.Type_tickettype',
          'zendesk.ticket_field.instance.agent_dropdown_643_for_agent_multiselect@ssssu',
          'zendesk.ticket_field.instance.agent_field_431_text@ssu',
          'zendesk.ticket_field.instance.credit_card_1_partialcreditcard@ssu',
          'zendesk.ticket_field.instance.zip_code_with_validation_regexp@sssu',
          'zendesk.ticket_field__custom_field_options',
          'zendesk.ticket_field__custom_field_options.instance.Customer_Tier_multiselect_su__enterprise@uumuu',
          'zendesk.ticket_field__custom_field_options.instance.Customer_Tier_multiselect_su__free@uumuu',
          'zendesk.ticket_field__custom_field_options.instance.Customer_Tier_multiselect_su__paying@uumuu',
          'zendesk.ticket_field__custom_field_options.instance.Product_components_multiselect_su__component_a@uumuuu',
          'zendesk.ticket_field__custom_field_options.instance.Product_components_multiselect_su__component_b@uumuuu',
          'zendesk.ticket_field__custom_field_options.instance.agent_dropdown_643_for_agent_multiselect_ssssu__v1@uuuuumuu',
          'zendesk.ticket_field__custom_field_options.instance.agent_dropdown_643_for_agent_multiselect_ssssu__v2_modified@uuuuumuuu',
          'zendesk.ticket_field__system_field_options',
          'zendesk.ticket_fields',
          'zendesk.ticket_form',
          'zendesk.ticket_form.instance.Amazing_ticket_form@s',
          'zendesk.ticket_form.instance.Default_Ticket_Form@s',
          'zendesk.ticket_form.instance.Demo_ticket_form@s',
          'zendesk.ticket_form.instance.Form_11@s',
          'zendesk.ticket_form.instance.Form_12@s',
          'zendesk.ticket_form.instance.Form_13@s',
          'zendesk.ticket_form.instance.Form_6436@s',
          'zendesk.ticket_form_order',
          'zendesk.ticket_form_order.instance',
          'zendesk.ticket_forms',
          'zendesk.trigger',
          'zendesk.trigger.instance.Auto_assign_to_first_email_responding_agent@bsssss',
          'zendesk.trigger.instance.Notify_all_agents_of_received_request@s',
          'zendesk.trigger.instance.Notify_assignee_of_assignment@s',
          'zendesk.trigger.instance.Notify_assignee_of_comment_update@s',
          'zendesk.trigger.instance.Notify_assignee_of_reopened_ticket@s',
          'zendesk.trigger.instance.Notify_group_of_assignment@s',
          'zendesk.trigger.instance.Notify_requester_and_CCs_of_comment_update@s',
          'zendesk.trigger.instance.Notify_requester_and_CCs_of_received_request@s',
          'zendesk.trigger.instance.Notify_requester_of_new_proactive_ticket@s',
          'zendesk.trigger.instance.Slack_Ticket_Trigger@s',
          'zendesk.trigger__actions',
          'zendesk.trigger__conditions',
          'zendesk.trigger__conditions__all',
          'zendesk.trigger__conditions__any',
          'zendesk.trigger_categories',
          'zendesk.trigger_categories__links',
          'zendesk.trigger_categories__meta',
          'zendesk.trigger_category',
          'zendesk.trigger_category.instance.Custom_Events@s',
          'zendesk.trigger_category.instance.Custom_Events___edited@ssbs',
          'zendesk.trigger_category.instance.Notifications',
          'zendesk.trigger_definition',
          'zendesk.trigger_definition__actions',
          'zendesk.trigger_definition__actions__metadata',
          'zendesk.trigger_definition__actions__metadata__phone_numbers',
          'zendesk.trigger_definition__actions__values',
          'zendesk.trigger_definition__conditions_all',
          'zendesk.trigger_definition__conditions_all__operators',
          'zendesk.trigger_definition__conditions_all__values',
          'zendesk.trigger_definition__conditions_any',
          'zendesk.trigger_definition__conditions_any__operators',
          'zendesk.trigger_definition__conditions_any__values',
          'zendesk.trigger_definitions',
          'zendesk.trigger_order',
          'zendesk.trigger_order.instance',
          'zendesk.trigger_order_entry',
          'zendesk.triggers',
          'zendesk.user_field',
          'zendesk.user_field.instance.another_text_3425',
          'zendesk.user_field.instance.date6436',
          'zendesk.user_field.instance.decimal_765_field',
          'zendesk.user_field.instance.description_123',
          'zendesk.user_field.instance.dropdown_25',
          'zendesk.user_field.instance.f201',
          'zendesk.user_field.instance.f202',
          'zendesk.user_field.instance.f203',
          'zendesk.user_field.instance.f204',
          'zendesk.user_field.instance.f205',
          'zendesk.user_field.instance.f206',
          'zendesk.user_field.instance.f207',
          'zendesk.user_field.instance.f208',
          'zendesk.user_field.instance.f209',
          'zendesk.user_field.instance.f210',
          'zendesk.user_field.instance.f211',
          'zendesk.user_field.instance.f212',
          'zendesk.user_field.instance.f213',
          'zendesk.user_field.instance.f214',
          'zendesk.user_field.instance.f215',
          'zendesk.user_field.instance.f216',
          'zendesk.user_field.instance.f217',
          'zendesk.user_field.instance.f218',
          'zendesk.user_field.instance.f219',
          'zendesk.user_field.instance.f220',
          'zendesk.user_field.instance.modified_multi75_key',
          'zendesk.user_field.instance.numeric65',
          'zendesk.user_field.instance.regex_6546',
          'zendesk.user_field.instance.this_is_a_checkbox',
          'zendesk.user_field__custom_field_options',
          'zendesk.user_field__custom_field_options.instance.dropdown_25__another_choice',
          'zendesk.user_field__custom_field_options.instance.dropdown_25__bla_edited',
          'zendesk.user_field__custom_field_options.instance.dropdown_25__choice1_tag',
          'zendesk.user_field_order',
          'zendesk.user_field_order.instance',
          'zendesk.user_fields',
          'zendesk.user_segment',
          'zendesk.user_segment.instance.Agents_and_admins@s',
          'zendesk.user_segment.instance.Everyone',
          'zendesk.user_segment.instance.Signed_in_users@bs',
          'zendesk.user_segment.instance.Tier_3_Articles@s',
          'zendesk.user_segment.instance.VIP_Customers@s',
          'zendesk.user_segments',
          'zendesk.view',
          'zendesk.view.instance.All_unsolved_tickets@s',
          'zendesk.view.instance.Copy_of_All_unsolved_tickets@s',
          'zendesk.view.instance.Current_tasks@s',
          'zendesk.view.instance.Custom_view_1234@s',
          'zendesk.view.instance.Custom_view_123@s',
          'zendesk.view.instance.New_tickets_in_your_groups@s',
          'zendesk.view.instance.Overdue_tasks@s',
          'zendesk.view.instance.Pending_tickets@s',
          'zendesk.view.instance.Recently_solved_tickets@s',
          'zendesk.view.instance.Recently_updated_tickets@s',
          'zendesk.view.instance.Test',
          'zendesk.view.instance.Test2',
          'zendesk.view.instance.Unassigned_tickets@s',
          'zendesk.view.instance.Unassigned_tickets___2@ssbs',
          'zendesk.view.instance.Unsolved_tickets_in_your_groups@s',
          'zendesk.view.instance.Your_unsolved_tickets@s',
          'zendesk.view__conditions',
          'zendesk.view__conditions__all',
          'zendesk.view__conditions__any',
          'zendesk.view__execution',
          'zendesk.view__execution__columns',
          'zendesk.view__execution__custom_fields',
          'zendesk.view__execution__fields',
          'zendesk.view__execution__group',
          'zendesk.view__execution__sort',
          'zendesk.view__restriction',
          'zendesk.view_order',
          'zendesk.view_order.instance',
          'zendesk.views',
          'zendesk.webhook',
          'zendesk.webhook.instance.test',
          'zendesk.webhook__authentication',
          'zendesk.webhooks',
          'zendesk.webhooks__meta',
          'zendesk.workspace',
          'zendesk.workspace.instance.New_Workspace_123@s',
          'zendesk.workspace__apps',
          'zendesk.workspace__conditions',
          'zendesk.workspace__conditions__all',
          'zendesk.workspace__conditions__any',
          'zendesk.workspace__selected_macros',
          'zendesk.workspace__selected_macros__restriction',
          'zendesk.workspace_order',
          'zendesk.workspace_order.instance',
          'zendesk.workspaces',
        ])

        const supportAddress = elements.filter(isInstanceElement).find(e => e.elemID.getFullName().startsWith('zendesk.support_address.instance.myBrand_support_myBrand_subdomain_zendesk_com@umvvv'))
        const brand = elements.filter(isInstanceElement).find(e => e.elemID.getFullName().startsWith('zendesk.brand.instance.myBrand'))
        expect(brand).toBeDefined()
        if (brand === undefined) {
          return
        }
        expect(supportAddress).toBeDefined()
        expect(supportAddress?.value).toMatchObject({
          id: 1500000743022,
          default: true,
          name: 'myBrand',
          email: new TemplateExpression({
            parts: [
              'support@',
              new ReferenceExpression(brand.elemID.createNestedID('subdomain'), brand.value.subdomain),
              '.zendesk.com',
            ],
          }),
          // eslint-disable-next-line camelcase
          brand_id: expect.any(ReferenceExpression),
        })
        expect(supportAddress?.value.brand_id.elemID.getFullName()).toEqual('zendesk.brand.instance.myBrand')
      })
      it('should return an 403 error for custom statuses', async () => {
        mockAxiosAdapter.onGet().reply(callbackResponseFuncWith403)
        const { elements, errors } = await adapter.operations({
          credentials: new InstanceElement(
            'config',
            usernamePasswordCredentialsType,
            { username: 'user123', password: 'token456', subdomain: 'myBrand' },
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
                guide: {
                  brands: ['.*'],
                },
              },
            }
          ),
          elementsSource: buildElementsSourceFromElements([]),
        }).fetch({ progressReporter: { reportProgress: () => null } })
        expect(errors).toBeDefined()
        expect(errors).toEqual([
          {
            severity: 'Warning',
            message: "Salto could not access the custom_statuses resource. Elements from that type were not fetched. Please make sure that this type is enabled in your service, and that the supplied user credentials have sufficient permissions to access this data. You can also exclude this data from Salto's fetches by changing the environment configuration. Learn more at https://help.salto.io/en/articles/6947061-salto-could-not-access-the-resource",
          },
        ])
        const elementsNames = elements.map(e => e.elemID.getFullName())
        expect(elementsNames).not.toContain('zendesk.custom_status.instance.new___zd_status_new__@u_00123_00123vu_00125_00125')
        expect(elementsNames).not.toContain('zendesk.custom_status.instance.open___zd_status_open__@u_00123_00123vu_00125_00125')
        expect(elementsNames).not.toContain('zendesk.custom_status.instance.open_test_n1')
        expect(elementsNames).not.toContain('zendesk.custom_status.instance.open_test_n1@ub')
      })

      it('should generate guide elements according to brands config', async () => {
        mockAxiosAdapter.onGet().reply(callbackResponseFunc)
        const creds = new InstanceElement(
          'config',
          usernamePasswordCredentialsType,
          { username: 'user123', password: 'token456', subdomain: 'myBrand' },
        )
        const config = new InstanceElement(
          'config',
          configType,
          {
            [FETCH_CONFIG]: {
              include: [{
                type: '.*',
              }],
              exclude: [],
              guide: {
                brands: ['.WithGuide'],
              },
            },
          }
        )
        const { elements } = await adapter.operations({
          credentials: creds,
          config,
          elementsSource: buildElementsSourceFromElements([]),
        }).fetch({ progressReporter: { reportProgress: () => null } })
        expect(elements
          .filter(isInstanceElement)
          .filter(e => e.elemID.typeName === 'article')
          .map(e => e.elemID.getFullName()).sort()).toEqual([
          'zendesk.article.instance.Title_Yo___greatSection_greatCategory_brandWithGuide@ssauuu',
        ])

        config.value[FETCH_CONFIG].guide.brands = ['[^myBrand]']
        const fetchRes = await adapter.operations({
          credentials: creds,
          config,
          elementsSource: buildElementsSourceFromElements([]),
        }).fetch({ progressReporter: { reportProgress: () => null } })
        expect(fetchRes.elements
          .filter(isInstanceElement)
          .filter(e => e.elemID.typeName === 'article')
          .map(e => e.elemID.getFullName()).sort()).toEqual([
          'zendesk.article.instance.Title_Yo___greatSection_greatCategory_brandWithGuide@ssauuu',
        ])
      })

      it('should return fetch error when no brand matches brands config ', async () => {
        mockAxiosAdapter.onGet().reply(callbackResponseFunc)
        const creds = new InstanceElement(
          'config',
          usernamePasswordCredentialsType,
          { username: 'user123', password: 'token456', subdomain: 'myBrand' },
        )
        const config = new InstanceElement(
          'config',
          configType,
          {
            [FETCH_CONFIG]: {
              include: [{
                type: '.*',
              }],
              exclude: [],
              guide: {
                brands: ['BestBrand'],
              },
            },
          }
        )
        const { errors } = await adapter.operations({
          credentials: creds,
          config,
          elementsSource: buildElementsSourceFromElements([]),
        }).fetch({ progressReporter: { reportProgress: () => null } })
        expect(errors).toEqual([
          {
            message: 'Could not find any brands matching the included patterns: [BestBrand]. Please update the configuration under fetch.guide.brands in the configuration file',
            severity: 'Warning',
          },
        ])
      })
    })

    describe('type overrides', () => {
      it('should fetch only the relevant types', async () => {
        (defaultBrandMockReplies as MockReply[]).forEach(({ url, params }) => {
          mockAxiosAdapter.onGet(url, !_.isEmpty(params) ? { params } : undefined)
            .replyOnce(callbackResponseFunc)
        })
        const { elements } = await adapter.operations({
          credentials: new InstanceElement(
            'config',
            usernamePasswordCredentialsType,
            { username: 'user123', password: 'pwd456', subdomain: 'myBrand' },
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
                      url: '/api/v2/groups',
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
            'zendesk.group.instance.Support',
            'zendesk.group.instance.Support2',
            'zendesk.group.instance.Support4',
            'zendesk.group.instance.Support5',
            // The order element are always created on fetch
            'zendesk.automation_order.instance',
            'zendesk.organization_field_order.instance',
            'zendesk.sla_policy_order.instance',
            'zendesk.ticket_form_order.instance',
            'zendesk.trigger_order.instance',
            'zendesk.user_field_order.instance',
            'zendesk.view_order.instance',
            'zendesk.workspace_order.instance',
          ].sort())
      })
    })
    it('should use elemIdGetter', async () => {
      (defaultBrandMockReplies as MockReply[]).forEach(({ url, params }) => {
        mockAxiosAdapter.onGet(url, !_.isEmpty(params) ? { params } : undefined)
          .replyOnce(callbackResponseFunc)
      })
      const supportInstanceId = 1500002894482
      const operations = adapter.operations({
        credentials: new InstanceElement(
          'config',
          usernamePasswordCredentialsType,
          { username: 'user123', password: 'pwd456', subdomain: 'myBrand' },
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
                    url: '/api/v2/groups',
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
        'zendesk.group.instance.Support',
        'zendesk.group.instance.Support2',
        'zendesk.group.instance.Support4',
        'zendesk.group.instance.Support5',
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
      mockAxiosAdapter.onGet('/api/v2/groups').replyOnce(
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
      mockAxiosAdapter.onGet('/api/v2/users').replyOnce(
        200, usersResponse
      )
      const { elements: newElements } = await operations
        .fetch({ progressReporter: { reportProgress: () => null } })
      const newInstances = newElements
        .filter(isInstanceElement)
        .filter(inst => inst.elemID.typeName === 'group')
      expect(newInstances.map(e => e.elemID.getFullName()).sort()).toEqual([
        'zendesk.group.instance.Support',
      ])
    })
  })

  describe('deploy', () => {
    let operations: AdapterOperations
    const groupType = new ObjectType({ elemID: new ElemID(ZENDESK, 'group') })
    const brandType = new ObjectType({ elemID: new ElemID(ZENDESK, 'brand') })
    const anotherType = new ObjectType({ elemID: new ElemID(ZENDESK, 'anotherType') })

    beforeEach(() => {
      (defaultBrandMockReplies as MockReply[]).forEach(({ url, params, response }) => {
        mockAxiosAdapter.onGet(url, !_.isEmpty(params) ? { params } : undefined)
          .replyOnce(200, response)
      })
      mockDeployChange.mockImplementation(async ({ change }) => {
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
          { username: 'user123', password: 'pwd456', subdomain: 'myBrand' },
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
                      url: '/api/v2/groups',
                      deployAsField: 'group',
                      method: 'post',
                    },
                    modify: {
                      url: '/api/v2/groups/{groupId}',
                      method: 'put',
                      deployAsField: 'group',
                      urlParamsToFields: {
                        groupId: 'id',
                      },
                    },
                    remove: {
                      url: '/api/v2/groups/{groupId}',
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
                      url: '/api/v2/brands',
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
                      url: '/api/v2/anotherType',
                      method: 'post',
                    },
                  },
                },
                groups: {
                  request: {
                    url: '/api/v2/groups',
                  },
                  transformation: {
                    dataField: 'groups',
                  },
                },
                brands: {
                  request: {
                    url: '/api/v2/brands',
                  },
                  transformation: {
                    dataField: 'brands',
                  },
                },
              },
            },
          }
        ),
        elementsSource: buildElementsSourceFromElements([
          userSegmentType,
          everyoneUserSegmentInstance,
        ]),
      })
    })
    afterEach(() => {
      mockDeployChange.mockRestore()
    })

    it('should return the applied changes', async () => {
      const ref = new ReferenceExpression(
        new ElemID(ZENDESK, 'test', 'instance', 'ins'),
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
          { [CORE_ANNOTATIONS.SERVICE_URL]: 'https://mybrand.zendesk.com/admin/account/brand_management/brands' },
        ) }),
        modificationChange,
        toChange({ after: new InstanceElement(
          'inst',
          groupType,
          { id: 1 },
          undefined,
          { [CORE_ANNOTATIONS.SERVICE_URL]: 'https://mybrand.zendesk.com/admin/people/team/groups' },
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
          { [CORE_ANNOTATIONS.SERVICE_URL]: 'https://mybrand.zendesk.com/admin/people/team/groups' },
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
          { [CORE_ANNOTATIONS.SERVICE_URL]: 'https://mybrand.zendesk.com/admin/people/team/groups' },
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
          { [CORE_ANNOTATIONS.SERVICE_URL]: 'https://mybrand.zendesk.com/admin/people/team/groups' },
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
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: toChange({
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
              path: [ZENDESK, elementsUtils.TYPES_PATH, 'group'],
            }),
            { ...instance.value, id: 1 },
            undefined,
            { [CORE_ANNOTATIONS.SERVICE_URL]: 'https://mybrand.zendesk.com/admin/people/team/groups' },
          ),
        }),
        client: expect.anything(),
        endpointDetails: expect.anything(),
      })
    })
    it('should not try to deploy instances', async () => {
      mockDeployChange.mockImplementation(async () => ({}))
      const deployRes = await operations.deploy({
        changeGroup: {
          groupID: 'group',
          changes: [
            toChange({ before: new InstanceElement('inst', groupType) }),
            toChange({ after: new ObjectType({ elemID: new ElemID(ZENDESK, 'test') }) }),
          ],
        },
      })
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: toChange({ before: new InstanceElement(
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
            path: [ZENDESK, elementsUtils.TYPES_PATH, 'group'],
          }),
        ) }),
        client: expect.anything(),
        endpointDetails: expect.anything(),
        fieldsToIgnore: undefined,
      })
      expect(deployRes.appliedChanges).toEqual([
        toChange({ before: new InstanceElement('inst', groupType) }),
      ])
    })
    describe('clients tests', () => {
      const { client } = createFilterCreatorParams({})
      const brand1 = new InstanceElement('brand1', new ObjectType({ elemID: new ElemID(ZENDESK, BRAND_TYPE_NAME) }), {
        subdomain: 'domain1',
        id: 1,
      })
      const brand2 = new InstanceElement('brand2', new ObjectType({ elemID: new ElemID(ZENDESK, BRAND_TYPE_NAME) }), {
        subdomain: 'domain2',
        id: 2,
      })
      const settings1 = new InstanceElement('guide_language_settings1', new ObjectType({ elemID: new ElemID(ZENDESK, GUIDE_LANGUAGE_SETTINGS_TYPE_NAME) }), { brand: 1 })
      const settings2 = new InstanceElement('guide_language_settings2', new ObjectType({ elemID: new ElemID(ZENDESK, GUIDE_LANGUAGE_SETTINGS_TYPE_NAME) }), { brand: 2 })
      it('should rate limit guide requests to 1, and not limit support requests', async () => {
        const zendeskAdapter = new ZendeskAdapter({
          config: DEFAULT_CONFIG,
          client,
          credentials: { accessToken: '', subdomain: '' },
          elementsSource: buildElementsSourceFromElements([brand1, brand2, settings1, settings2]),
        })
        // any is needed to be able to spy on private method
        // eslint-disable-next-line
        const createClientSpy = jest.spyOn(zendeskAdapter as any, 'createClientBySubdomain')
        // eslint-disable-next-line
        const createFiltersRunnerSpy = jest.spyOn(zendeskAdapter as any, 'createFiltersRunner')
        await zendeskAdapter.deploy({
          changeGroup: {
            groupID: '1',
            changes: [toChange({ after: settings1 }), toChange({ after: settings2 })],
          },
        })
        const guideFilterRunnerCall = expect.objectContaining({
          filterRunnerClient: expect.objectContaining({
            config: {
              rateLimit: {
                deploy: 1,
              },
            },
          }),
        })

        expect(createClientSpy).toHaveBeenCalledTimes(2)
        expect(createFiltersRunnerSpy).toHaveBeenCalledTimes(3)
        expect(createFiltersRunnerSpy).toHaveBeenNthCalledWith(1, {}) // Regular deploy
        expect(createFiltersRunnerSpy).toHaveBeenNthCalledWith(2, guideFilterRunnerCall) // guide deploy
        expect(createFiltersRunnerSpy).toHaveBeenNthCalledWith(3, guideFilterRunnerCall) // guide deploy
      })
      it('should use the same client for all guide requests of the same subdomain', async () => {
        const zendeskAdapter = new ZendeskAdapter({
          config: DEFAULT_CONFIG,
          client,
          credentials: { accessToken: '', subdomain: '' },
          elementsSource: buildElementsSourceFromElements([brand1, brand2, settings1, settings2]),
        })
        // any is needed to be able to spy on private method
        // eslint-disable-next-line
        const getClientSpy = jest.spyOn(zendeskAdapter as any, 'getClientBySubdomain')
        // eslint-disable-next-line
        const createClientSpy = jest.spyOn(zendeskAdapter as any, 'createClientBySubdomain')

        await zendeskAdapter.deploy({
          changeGroup: {
            groupID: '1',
            changes: [toChange({ after: settings1 })],
          },
        })
        await zendeskAdapter.deploy({
          changeGroup: {
            groupID: '2',
            changes: [toChange({ before: settings1 })],
          },
        })
        expect(getClientSpy).toHaveBeenCalledTimes(2)
        expect(createClientSpy).toHaveBeenCalledTimes(1)
      })
    })
  })
})
