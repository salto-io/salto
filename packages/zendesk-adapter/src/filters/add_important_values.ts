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
import { CORE_ANNOTATIONS, Element, isObjectType } from '@salto-io/adapter-api'
import { ImportantValues } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import {
  APP_INSTALLATION_TYPE_NAME,
  APP_OWNED_TYPE_NAME,
  ARTICLE_TRANSLATION_TYPE_NAME,
  ARTICLE_TYPE_NAME,
  AUTOMATION_TYPE_NAME,
  BRAND_TYPE_NAME,
  BUSINESS_HOUR_SCHEDULE,
  CATEGORY_TRANSLATION_TYPE_NAME,
  CUSTOM_STATUS_TYPE_NAME,
  DYNAMIC_CONTENT_ITEM_TYPE_NAME,
  GROUP_TYPE_NAME,
  MACRO_TYPE_NAME,
  ORG_FIELD_TYPE_NAME,
  SECTION_TRANSLATION_TYPE_NAME,
  SECTION_TYPE_NAME,
  SUPPORT_ADDRESS_TYPE_NAME,
  TARGET_TYPE_NAME,
  TICKET_FIELD_TYPE_NAME,
  TICKET_FORM_TYPE_NAME,
  TRIGGER_TYPE_NAME,
  USER_FIELD_TYPE_NAME,
  USER_SEGMENT_TYPE_NAME,
  VIEW_TYPE_NAME,
  WEBHOOK_TYPE_NAME,
  WORKSPACE_TYPE_NAME,
} from '../constants'
import { DYNAMIC_CONTENT_ITEM_VARIANT_TYPE_NAME } from './dynamic_content'

const importantValuesMap: Record<string, ImportantValues> = {
  [APP_INSTALLATION_TYPE_NAME]: [
    {
      value: 'enabled',
      highlighted: false,
      indexed: true,
    },
    {
      value: 'paid',
      highlighted: false,
      indexed: true,
    },
    {
      value: 'product',
      highlighted: false,
      indexed: true,
    },
  ],
  [APP_OWNED_TYPE_NAME]: [
    {
      value: 'name',
      highlighted: true,
      indexed: false,
    },
    {
      value: 'raw_long_description',
      highlighted: true,
      indexed: false,
    },
    {
      value: 'state',
      highlighted: true,
      indexed: true,
    },
    {
      value: 'visibility',
      highlighted: true,
      indexed: true,
    },
    {
      value: 'paid',
      highlighted: false,
      indexed: true,
    },
    {
      value: 'author_email',
      highlighted: true,
      indexed: false,
    },
    {
      value: 'author_name',
      highlighted: true,
      indexed: false,
    },
    {
      value: 'author_url',
      highlighted: true,
      indexed: false,
    },
  ],
  [AUTOMATION_TYPE_NAME]: [
    {
      value: 'raw_title',
      highlighted: true,
      indexed: false,
    },
    {
      value: 'active',
      highlighted: true,
      indexed: true,
    },
  ],
  [BRAND_TYPE_NAME]: [
    {
      value: 'brand_url',
      highlighted: true,
      indexed: false,
    },
    {
      value: 'active',
      highlighted: true,
      indexed: true,
    },
    {
      value: 'default',
      highlighted: true,
      indexed: false,
    },
    {
      value: 'help_center_state',
      highlighted: true,
      indexed: true,
    },
  ],
  [CUSTOM_STATUS_TYPE_NAME]: [
    {
      value: 'active',
      highlighted: false,
      indexed: true,
    },
    {
      value: 'status_category',
      highlighted: false,
      indexed: true,
    },
  ],
  [DYNAMIC_CONTENT_ITEM_VARIANT_TYPE_NAME]: [
    {
      value: 'content',
      highlighted: true,
      indexed: false,
    },
    {
      value: 'locale_id',
      highlighted: true,
      indexed: true,
    },
    {
      value: 'active',
      highlighted: false,
      indexed: true,
    },
    {
      value: 'active',
      highlighted: false,
      indexed: true,
    },
  ],
  [GROUP_TYPE_NAME]: [
    {
      value: 'name',
      highlighted: true,
      indexed: false,
    },
    {
      value: 'description',
      highlighted: true,
      indexed: false,
    },
    {
      value: 'is_public',
      highlighted: true,
      indexed: true,
    },
  ],
  [MACRO_TYPE_NAME]: [
    {
      value: 'title',
      highlighted: true,
      indexed: false,
    },
    {
      value: 'actions',
      highlighted: true,
      indexed: false,
    },
    {
      value: 'active',
      highlighted: false,
      indexed: true,
    },
  ],
  [ORG_FIELD_TYPE_NAME]: [
    {
      value: 'raw_title',
      highlighted: true,
      indexed: false,
    },
    {
      value: 'raw_description',
      highlighted: true,
      indexed: false,
    },
    {
      value: 'active',
      highlighted: false,
      indexed: true,
    },
    {
      value: 'system',
      highlighted: false,
      indexed: true,
    },
    {
      value: 'type',
      highlighted: true,
      indexed: true,
    },
  ],
  [SUPPORT_ADDRESS_TYPE_NAME]: [
    {
      value: 'name',
      highlighted: true,
      indexed: false,
    },
    {
      value: 'email',
      highlighted: true,
      indexed: false,
    },
    {
      value: 'brand_id',
      highlighted: true,
      indexed: true,
    },
  ],
  [TARGET_TYPE_NAME]: [
    {
      value: 'active',
      highlighted: false,
      indexed: true,
    },
  ],
  [TICKET_FIELD_TYPE_NAME]: [
    {
      value: 'raw_title',
      highlighted: true,
      indexed: false,
    },
    {
      value: 'type',
      highlighted: true,
      indexed: false,
    },
    {
      value: 'raw_description',
      highlighted: true,
      indexed: false,
    },
    {
      value: 'active',
      highlighted: false,
      indexed: true,
    },
    {
      value: 'removable',
      highlighted: false,
      indexed: true,
    },
    {
      value: 'required',
      highlighted: false,
      indexed: true,
    },
  ],
  [TICKET_FORM_TYPE_NAME]: [
    {
      value: 'raw_name',
      highlighted: true,
      indexed: false,
    },
    {
      value: 'ticket_field_ids',
      highlighted: true,
      indexed: false,
    },
    {
      value: 'active',
      highlighted: false,
      indexed: true,
    },
    {
      value: 'end_user_visible',
      highlighted: false,
      indexed: true,
    },
  ],
  [TRIGGER_TYPE_NAME]: [
    {
      value: 'raw_title',
      highlighted: true,
      indexed: false,
    },
    {
      value: 'actions',
      highlighted: true,
      indexed: false,
    },
    {
      value: 'conditions',
      highlighted: true,
      indexed: false,
    },
    {
      value: 'active',
      highlighted: false,
      indexed: true,
    },
    {
      value: 'category_id',
      highlighted: false,
      indexed: true,
    },
  ],
  [USER_FIELD_TYPE_NAME]: [
    {
      value: 'raw_title',
      highlighted: true,
      indexed: false,
    },
    {
      value: 'raw_description',
      highlighted: true,
      indexed: false,
    },
    {
      value: 'type',
      highlighted: true,
      indexed: true,
    },
    {
      value: 'system',
      highlighted: false,
      indexed: true,
    },
    {
      value: 'active',
      highlighted: false,
      indexed: true,
    },
  ],
  [VIEW_TYPE_NAME]: [
    {
      value: 'title',
      highlighted: true,
      indexed: false,
    },
    {
      value: 'conditions',
      highlighted: true,
      indexed: false,
    },
    {
      value: 'execution',
      highlighted: true,
      indexed: false,
    },
    {
      value: 'restriction',
      highlighted: true,
      indexed: false,
    },
    {
      value: 'active',
      highlighted: false,
      indexed: true,
    },
  ],
  [WEBHOOK_TYPE_NAME]: [
    {
      value: 'name',
      highlighted: true,
      indexed: false,
    },
    {
      value: 'endpoint',
      highlighted: true,
      indexed: false,
    },
    {
      value: 'subscriptions',
      highlighted: true,
      indexed: false,
    },
    {
      value: 'status',
      highlighted: false,
      indexed: true,
    },
  ],
  [WORKSPACE_TYPE_NAME]: [
    {
      value: 'title',
      highlighted: true,
      indexed: false,
    },
    {
      value: 'description',
      highlighted: true,
      indexed: false,
    },
    {
      value: 'conditions',
      highlighted: true,
      indexed: false,
    },
    {
      value: 'apps',
      highlighted: true,
      indexed: false,
    },
    {
      value: 'activated',
      highlighted: false,
      indexed: true,
    },
  ],
  [ARTICLE_TYPE_NAME]: [
    {
      value: 'draft',
      highlighted: false,
      indexed: true,
    },
    {
      value: 'author_id',
      highlighted: false,
      indexed: true,
    },
    {
      value: 'user_segment_id',
      highlighted: false,
      indexed: true,
    },
    {
      value: 'permission_group_id',
      highlighted: false,
      indexed: true,
    },
    {
      value: 'label_names',
      highlighted: false,
      indexed: true,
    },
  ],
  [ARTICLE_TRANSLATION_TYPE_NAME]: [
    {
      value: 'title',
      highlighted: true,
      indexed: false,
    },
    {
      value: 'locale',
      highlighted: true,
      indexed: true,
    },
    {
      value: 'body',
      highlighted: true,
      indexed: false,
    },
    {
      value: 'draft',
      highlighted: true,
      indexed: true,
    },
    {
      value: 'hidden',
      highlighted: true,
      indexed: true,
    },
  ],
  [SECTION_TRANSLATION_TYPE_NAME]: [
    {
      value: 'title',
      highlighted: true,
      indexed: false,
    },
    {
      value: 'locale',
      highlighted: true,
      indexed: true,
    },
    {
      value: 'draft',
      highlighted: true,
      indexed: true,
    },
    {
      value: 'hidden',
      highlighted: true,
      indexed: true,
    },
  ],
  [CATEGORY_TRANSLATION_TYPE_NAME]: [
    {
      value: 'title',
      highlighted: true,
      indexed: false,
    },
    {
      value: 'locale',
      highlighted: true,
      indexed: true,
    },
    {
      value: 'draft',
      highlighted: true,
      indexed: true,
    },
    {
      value: 'hidden',
      highlighted: true,
      indexed: true,
    },
  ],
  [BUSINESS_HOUR_SCHEDULE]: [
    {
      value: 'time_zone',
      highlighted: false,
      indexed: true,
    },
  ],
  [DYNAMIC_CONTENT_ITEM_TYPE_NAME]: [
    {
      value: 'placeholder',
      highlighted: true,
      indexed: false,
    },
  ],
  [SECTION_TYPE_NAME]: [
    {
      value: 'sorting',
      highlighted: false,
      indexed: true,
    },
  ],
  [USER_SEGMENT_TYPE_NAME]: [
    {
      value: 'added_user_ids',
      highlighted: false,
      indexed: true,
    },
  ],
}

const filterCreator: FilterCreator = () => ({
  name: 'addImportantValues',
  onFetch: async (elements: Element[]): Promise<void> => {
    const objectTypes = elements.filter(isObjectType)
    objectTypes.forEach(obj => {
      const { typeName } = obj.elemID
      const importantValuesArray = importantValuesMap[typeName]
      if (Array.isArray(importantValuesArray)) {
        obj.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES] = importantValuesArray
      }
    })
  },
})

export default filterCreator
