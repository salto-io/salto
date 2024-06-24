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
import { Element, isInstanceElement } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { addAliasToElements, AliasData } from '@salto-io/adapter-components'
import { FilterCreator } from '../filter'
import {
  APP_OWNED_TYPE_NAME,
  ARTICLE_ATTACHMENT_TYPE_NAME,
  ARTICLE_ORDER_TYPE_NAME,
  ARTICLE_TRANSLATION_TYPE_NAME,
  ARTICLE_TYPE_NAME,
  AUTOMATION_TYPE_NAME,
  BRAND_LOGO_TYPE_NAME,
  BRAND_TYPE_NAME,
  CATEGORY_ORDER_TYPE_NAME,
  CATEGORY_TRANSLATION_TYPE_NAME,
  CATEGORY_TYPE_NAME,
  CUSTOM_OBJECT_FIELD_OPTIONS_TYPE_NAME,
  CUSTOM_OBJECT_FIELD_TYPE_NAME,
  CUSTOM_OBJECT_TYPE_NAME,
  CUSTOM_ROLE_TYPE_NAME,
  CUSTOM_STATUS_TYPE_NAME,
  GROUP_TYPE_NAME,
  GUIDE_LANGUAGE_SETTINGS_TYPE_NAME,
  GUIDE_SETTINGS_TYPE_NAME,
  GUIDE_THEME_TYPE_NAME,
  MACRO_TYPE_NAME,
  ORG_FIELD_TYPE_NAME,
  PERMISSION_GROUP_TYPE_NAME,
  ROUTING_ATTRIBUTE_VALUE_TYPE_NAME,
  SECTION_ORDER_TYPE_NAME,
  SECTION_TRANSLATION_TYPE_NAME,
  SECTION_TYPE_NAME,
  SUPPORT_ADDRESS_TYPE_NAME,
  TARGET_TYPE_NAME,
  THEME_SETTINGS_TYPE_NAME,
  TICKET_FIELD_CUSTOM_FIELD_OPTION,
  TICKET_FIELD_TYPE_NAME,
  TICKET_FORM_TYPE_NAME,
  USER_FIELD_TYPE_NAME,
  USER_SEGMENT_TYPE_NAME,
  WEBHOOK_TYPE_NAME,
} from '../constants'
import { FETCH_CONFIG } from '../config'

const log = logger(module)

const CATEGORY_ORDER = 'Category Order'
const SECTION_ORDER = 'Section Order'
const ARTICLE_ORDER = 'Article Order'
const LANGUAGE_SETTINGS = 'language settings'
const SETTINGS = 'Settings'
const THEME_SETTINGS = 'Theme settings'

const aliasMap: Record<string, AliasData> = {
  app_installation: {
    aliasComponents: [
      {
        fieldName: 'settings.name',
      },
    ],
  },
  [APP_OWNED_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: 'name',
      },
    ],
  },
  [AUTOMATION_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: 'title',
      },
    ],
  },
  [BRAND_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: 'name',
      },
    ],
  },
  [BRAND_LOGO_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: 'filename',
      },
    ],
  },
  business_hours_schedule: {
    aliasComponents: [
      {
        fieldName: 'name',
      },
    ],
  },
  business_hours_schedule_holiday: {
    aliasComponents: [
      {
        fieldName: 'name',
      },
    ],
  },
  channel: {
    aliasComponents: [
      {
        fieldName: 'name',
      },
    ],
  },
  [CUSTOM_ROLE_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: 'name',
      },
    ],
  },
  [CUSTOM_STATUS_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: 'agent_label',
      },
    ],
  },
  dynamic_content_item: {
    aliasComponents: [
      {
        fieldName: 'name',
      },
    ],
  },
  dynamic_content_item__variants: {
    aliasComponents: [
      {
        fieldName: '_parent.0',
        referenceFieldName: '_alias',
      },
      {
        fieldName: 'locale_id',
        referenceFieldName: 'locale',
      },
    ],
    separator: ' - ',
  },
  [GROUP_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: 'name',
      },
    ],
  },
  locale: {
    aliasComponents: [
      {
        fieldName: 'presentation_name',
      },
    ],
  },
  [MACRO_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: 'title',
      },
    ],
  },
  macro_attachment: {
    aliasComponents: [
      {
        fieldName: 'filename',
      },
    ],
  },
  oauth_client: {
    aliasComponents: [
      {
        fieldName: 'name',
      },
    ],
  },
  [ORG_FIELD_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: 'title',
      },
    ],
  },
  organization_field__custom_field_options: {
    aliasComponents: [
      {
        fieldName: 'raw_name',
      },
    ],
  },
  routing_attribute: {
    aliasComponents: [
      {
        fieldName: 'name',
      },
    ],
  },
  [ROUTING_ATTRIBUTE_VALUE_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: 'name',
      },
    ],
  },
  sla_policy: {
    aliasComponents: [
      {
        fieldName: 'title',
      },
    ],
  },
  [SUPPORT_ADDRESS_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: 'name',
      },
    ],
  },
  tag: {
    aliasComponents: [
      {
        fieldName: 'id',
      },
    ],
  },
  [TARGET_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: 'title',
      },
    ],
  },
  [TICKET_FIELD_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: 'title',
      },
    ],
  },
  [TICKET_FIELD_CUSTOM_FIELD_OPTION]: {
    aliasComponents: [
      {
        fieldName: 'raw_name',
      },
    ],
  },
  [TICKET_FORM_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: 'name',
      },
    ],
  },
  trigger: {
    aliasComponents: [
      {
        fieldName: 'title',
      },
    ],
  },
  trigger_category: {
    aliasComponents: [
      {
        fieldName: 'name',
      },
    ],
  },
  [USER_FIELD_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: 'title',
      },
    ],
  },
  user_field__custom_field_options: {
    aliasComponents: [
      {
        fieldName: 'raw_name',
      },
    ],
  },
  view: {
    aliasComponents: [
      {
        fieldName: 'title',
      },
    ],
  },
  [WEBHOOK_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: 'name',
      },
    ],
  },
  workspace: {
    aliasComponents: [
      {
        fieldName: 'title',
      },
    ],
  },
  [CATEGORY_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: 'name',
      },
    ],
  },
  [CATEGORY_TRANSLATION_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: 'locale',
        referenceFieldName: 'locale',
      },
      {
        fieldName: '_parent.0',
        referenceFieldName: '_alias',
      },
    ],
    separator: ' - ',
  },
  [CATEGORY_ORDER_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: '_parent.0',
        referenceFieldName: '_alias',
      },
      {
        constant: CATEGORY_ORDER,
      },
    ],
  },
  [SECTION_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: 'name',
      },
    ],
  },
  [SECTION_TRANSLATION_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: 'locale',
        referenceFieldName: 'locale',
      },
      {
        fieldName: '_parent.0',
        referenceFieldName: '_alias',
      },
    ],
    separator: ' - ',
  },
  [SECTION_ORDER_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: '_parent.0',
        referenceFieldName: '_alias',
      },
      {
        constant: SECTION_ORDER,
      },
    ],
  },
  [ARTICLE_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: 'title',
      },
    ],
  },
  [ARTICLE_TRANSLATION_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: 'locale',
        referenceFieldName: 'locale',
      },
      {
        fieldName: '_parent.0',
        referenceFieldName: '_alias',
      },
    ],
    separator: ' - ',
  },
  [ARTICLE_ORDER_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: '_parent.0',
        referenceFieldName: '_alias',
      },
      {
        constant: ARTICLE_ORDER,
      },
    ],
  },
  [ARTICLE_ATTACHMENT_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: 'file_name',
      },
      {
        fieldName: '_parent.0',
        referenceFieldName: '_alias',
      },
    ],
    separator: ' - ',
  },
  [GUIDE_LANGUAGE_SETTINGS_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: 'brand',
        referenceFieldName: '_alias',
      },
      {
        fieldName: 'locale',
      },
      {
        constant: LANGUAGE_SETTINGS,
      },
    ],
  },
  [GUIDE_SETTINGS_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: 'brand',
        referenceFieldName: '_alias',
      },
      {
        constant: SETTINGS,
      },
    ],
  },
  [THEME_SETTINGS_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: 'brand',
        referenceFieldName: '_alias',
      },
      {
        constant: THEME_SETTINGS,
      },
    ],
  },
  [GUIDE_THEME_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: 'name',
      },
    ],
  },
  [PERMISSION_GROUP_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: 'name',
      },
    ],
  },
  [USER_SEGMENT_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: 'name',
      },
    ],
  },
  [CUSTOM_OBJECT_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: 'key',
      },
    ],
  },
  [CUSTOM_OBJECT_FIELD_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: 'key',
      },
    ],
  },
  [CUSTOM_OBJECT_FIELD_OPTIONS_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: 'value',
      },
    ],
  },
}

const filterCreator: FilterCreator = ({ config }) => ({
  name: 'addAlias',
  onFetch: async (elements: Element[]): Promise<void> => {
    if (config[FETCH_CONFIG].addAlias === false) {
      log.info('not running addAlias filter as addAlias in the config is false')
      return
    }
    const elementsMap = _.groupBy(elements.filter(isInstanceElement), instance => instance.elemID.typeName)
    addAliasToElements({
      elementsMap,
      aliasMap,
    })
  },
})

export default filterCreator
