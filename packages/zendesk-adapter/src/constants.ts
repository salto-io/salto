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
export const ZENDESK = 'zendesk'
export const GUIDE = 'guide'
export const BRAND_TYPE_NAME = 'brand'
export const TARGET_TYPE_NAME = 'target'
export const APP_INSTALLATION_TYPE_NAME = 'app_installation'
export const APP_OWNED_TYPE_NAME = 'app_owned'
export const BRAND_LOGO_TYPE_NAME = 'brand_logo'
export const ARTICLE_TYPE_NAME = 'article'
export const ARTICLE_TRANSLATION_TYPE_NAME = 'article_translation'
export const SECTION_TYPE_NAME = 'section'
export const SECTION_TRANSLATION_TYPE_NAME = 'section_translation'
export const CATEGORY_TYPE_NAME = 'category'
export const CATEGORY_TRANSLATION_TYPE_NAME = 'category_translation'
export const TRANSLATION_TYPE_NAMES = [
  CATEGORY_TRANSLATION_TYPE_NAME,
  SECTION_TRANSLATION_TYPE_NAME,
  ARTICLE_TRANSLATION_TYPE_NAME,
]
export const USER_SEGMENT_TYPE_NAME = 'user_segment'
export const GUIDE_SETTINGS_TYPE_NAME = 'guide_settings'
export const GUIDE_LANGUAGE_SETTINGS_TYPE_NAME = 'guide_language_settings'
export const GUIDE_THEME_TYPE_NAME = 'theme'
export const THEME_SETTINGS_TYPE_NAME = 'theme_settings'
export const PERMISSION_GROUP_TYPE_NAME = 'permission_group'
export const TICKET_FIELD_TYPE_NAME = 'ticket_field'
export const ORG_FIELD_TYPE_NAME = 'organization_field'
export const USER_FIELD_TYPE_NAME = 'user_field'
export const FIELD_TYPE_NAMES = [TICKET_FIELD_TYPE_NAME, USER_FIELD_TYPE_NAME, ORG_FIELD_TYPE_NAME]
export const CUSTOM_ROLE_TYPE_NAME = 'custom_role'
export const MACRO_TYPE_NAME = 'macro'
export const ACCOUNT_FEATURES_TYPE_NAME = 'account_features'
export const EVERYONE_USER_TYPE = 'Everyone'
export const TICKET_FORM_TYPE_NAME = 'ticket_form'
export const TICKET_FORM_ORDER_TYPE_NAME = 'ticket_form_order'
export const WEBHOOK_TYPE_NAME = 'webhook'
export const WORKSPACE_TYPE_NAME = 'workspace'
export const SUPPORT_ADDRESS_TYPE_NAME = 'support_address'
export const CUSTOM_STATUS_TYPE_NAME = 'custom_status'
export const DEFAULT_CUSTOM_STATUSES_TYPE_NAME = 'default_custom_statuses'
export const PENDING_CATEGORY = 'pending'
export const SOLVED_CATEGORY = 'solved'
export const HOLD_CATEGORY = 'hold'
export const OPEN_CATEGORY = 'open'
export const ROUTING_ATTRIBUTE_TYPE_NAME = 'routing_attribute'
export const ROUTING_ATTRIBUTE_VALUE_TYPE_NAME = 'routing_attribute_value'
export const GROUP_TYPE_NAME = 'group'
export const AUDIT_TIME_TYPE_NAME = 'audit_time'
export const AUTOMATION_TYPE_NAME = 'automation'
export const TICKET_FIELD_CUSTOM_FIELD_OPTION = 'ticket_field__custom_field_options'
export const TAG_TYPE_NAME = 'tag'
export const BUSINESS_HOUR_SCHEDULE = 'business_hours_schedule'
export const BUSINESS_HOUR_SCHEDULE_HOLIDAY = 'business_hours_schedule_holiday'

export const CATEGORY_ORDER_TYPE_NAME = 'category_order'
export const SECTION_ORDER_TYPE_NAME = 'section_order'
export const ARTICLE_ORDER_TYPE_NAME = 'article_order'
export const CATEGORIES_FIELD = 'categories'
export const SECTIONS_FIELD = 'sections'
export const ARTICLES_FIELD = 'articles'
export const BRAND_FIELD = 'brand'
export const SOURCE_LOCALE_FIELD = 'source_locale'
export const TRANSLATIONS_FIELD = 'translations'
export const ARTICLE_ATTACHMENTS_FIELD = 'article_attachments'
export const ARTICLE_ATTACHMENT_TYPE_NAME = 'article_attachment'
export const SLA_POLICY_TYPE_NAME = 'sla_policy'
export const TRIGGER_TYPE_NAME = 'trigger'
export const TRIGGER_CATEGORY_TYPE_NAME = 'trigger_category'
export const LOCALE_TYPE_NAME = 'locale'
export const TICKET_STATUS_CUSTOM_STATUS_TYPE_NAME = 'custom_status'
export const DEFLECTION_ACTION = 'deflection'
export const CUSTOM_TICKET_STATUS_ACTION = 'custom_status_id'
export const VIEW_TYPE_NAME = 'view'
export const CUSTOM_FIELD_OPTIONS_FIELD_NAME = 'custom_field_options'
export const DYNAMIC_CONTENT_ITEM_TYPE_NAME = 'dynamic_content_item'
export const CUSTOM_OBJECT_TYPE_NAME = 'custom_object'
export const CUSTOM_OBJECT_FIELD_TYPE_NAME = 'custom_object_field'
export const CUSTOM_OBJECT_FIELD_ORDER_TYPE_NAME = 'custom_object_field_order'
export const CUSTOM_OBJECT_FIELD_OPTIONS_TYPE_NAME = `${CUSTOM_OBJECT_FIELD_TYPE_NAME}__${CUSTOM_FIELD_OPTIONS_FIELD_NAME}`
export const ORDER_FIELD = `${CUSTOM_OBJECT_FIELD_TYPE_NAME}s`
export const AUTOMATION_ORDER_TYPE_NAME = 'automation_order'
export const ORGANIZATION_FIELD_ORDER_TYPE_NAME = 'organization_field_order'
export const SLA_POLICY_ORDER_TYPE_NAME = 'sla_policy_order'
export const TRIGGER_ORDER_TYPE_NAME = 'trigger_order'
export const USER_FIELD_ORDER_TYPE_NAME = 'user_field_order'
export const VIEW_ORDER_TYPE_NAME = 'view_order'
export const WORKSPACE_ORDER_TYPE_NAME = 'workspace_order'
export const THEME_FOLDER_TYPE_NAME = 'theme_folder'
export const THEME_FILE_TYPE_NAME = 'theme_file'
export const ORDER_TYPE_NAMES = [
  CATEGORY_ORDER_TYPE_NAME,
  SECTION_ORDER_TYPE_NAME,
  ARTICLE_ORDER_TYPE_NAME,
  TICKET_FORM_ORDER_TYPE_NAME,
  CUSTOM_OBJECT_FIELD_ORDER_TYPE_NAME,
  AUTOMATION_ORDER_TYPE_NAME,
  ORGANIZATION_FIELD_ORDER_TYPE_NAME,
  SLA_POLICY_ORDER_TYPE_NAME,
  TRIGGER_ORDER_TYPE_NAME,
  USER_FIELD_ORDER_TYPE_NAME,
  VIEW_ORDER_TYPE_NAME,
  WORKSPACE_ORDER_TYPE_NAME,
]
export const USER_FIELD_CUSTOM_FIELD_OPTIONS = 'user_field__custom_field_options'
export const ORGANIZATION_FIELD_CUSTOM_FIELD_OPTIONS = 'organization_field__custom_field_options'
