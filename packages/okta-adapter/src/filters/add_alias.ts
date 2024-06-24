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
import { addAliasToElements, AliasData } from '@salto-io/adapter-components'
import { FilterCreator } from '../filter'
import {
  POLICY_TYPE_NAMES,
  POLICY_RULE_TYPE_NAMES,
  APPLICATION_TYPE_NAME,
  GROUP_TYPE_NAME,
  GROUP_RULE_TYPE_NAME,
  BEHAVIOR_RULE_TYPE_NAME,
  APP_USER_SCHEMA_TYPE_NAME,
  BRAND_TYPE_NAME,
  FEATURE_TYPE_NAME,
  IDENTITY_PROVIDER_TYPE_NAME,
  INLINE_HOOK_TYPE_NAME,
  NETWORK_ZONE_TYPE_NAME,
  ROLE_TYPE_NAME,
  USERTYPE_TYPE_NAME,
  USER_SCHEMA_TYPE_NAME,
  AUTHENTICATOR_TYPE_NAME,
  GROUP_SCHEMA_TYPE_NAME,
  PROFILE_MAPPING_TYPE_NAME,
  AUTHORIZATION_POLICY_RULE,
  AUTHORIZATION_POLICY,
  AUTHORIZATION_SERVER,
  DEVICE_ASSURANCE,
  EVENT_HOOK,
  GROUP_PUSH_RULE_TYPE_NAME,
  GROUP_PUSH_TYPE_NAME,
  AUTOMATION_TYPE_NAME,
  AUTOMATION_RULE_TYPE_NAME,
  APP_GROUP_ASSIGNMENT_TYPE_NAME,
} from '../constants'

const DEFAULT_ALIAS_TYPES = [
  ...POLICY_RULE_TYPE_NAMES,
  ...POLICY_TYPE_NAMES,
  AUTHORIZATION_POLICY,
  AUTHORIZATION_POLICY_RULE,
  AUTOMATION_TYPE_NAME,
  AUTOMATION_RULE_TYPE_NAME,
  GROUP_RULE_TYPE_NAME,
  BEHAVIOR_RULE_TYPE_NAME,
  BRAND_TYPE_NAME,
  FEATURE_TYPE_NAME,
  IDENTITY_PROVIDER_TYPE_NAME,
  INLINE_HOOK_TYPE_NAME,
  NETWORK_ZONE_TYPE_NAME,
  AUTHENTICATOR_TYPE_NAME,
  AUTHORIZATION_SERVER,
  DEVICE_ASSURANCE,
  EVENT_HOOK,
  GROUP_PUSH_RULE_TYPE_NAME,
  'OAuth2Claim',
]

const DEFAULT_ALIAS_DATA: AliasData = {
  aliasComponents: [{ fieldName: 'name' }],
}

const aliasMap: Record<string, AliasData> = {
  [APPLICATION_TYPE_NAME]: {
    aliasComponents: [{ fieldName: 'label' }],
  },
  [GROUP_TYPE_NAME]: {
    aliasComponents: [{ fieldName: 'profile.name' }],
  },
  [APP_USER_SCHEMA_TYPE_NAME]: {
    aliasComponents: [{ fieldName: 'title' }],
  },
  [GROUP_SCHEMA_TYPE_NAME]: {
    aliasComponents: [{ fieldName: 'title' }],
  },
  [ROLE_TYPE_NAME]: {
    aliasComponents: [{ fieldName: 'label' }],
  },
  ResourceSet: {
    aliasComponents: [{ fieldName: 'label' }],
  },
  [USERTYPE_TYPE_NAME]: {
    aliasComponents: [{ fieldName: 'displayName' }],
  },
  [USER_SCHEMA_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: '_parent.0',
        referenceFieldName: '_alias',
      },
    ],
  },
  [PROFILE_MAPPING_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: 'source.id',
        referenceFieldName: '_alias',
      },
      {
        fieldName: 'target.id',
        referenceFieldName: '_alias',
      },
    ],
    separator: ' : ',
  },
  [GROUP_PUSH_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: 'userGroupId',
        referenceFieldName: '_alias',
      },
      {
        fieldName: 'newAppGroupName',
      },
    ],
    separator: ' : ',
  },
  [APP_GROUP_ASSIGNMENT_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: '_parent.0',
        referenceFieldName: '_alias',
      },
      {
        fieldName: 'id',
        referenceFieldName: '_alias',
      },
    ],
    separator: ' : ',
  },
  OAuth2Scope: {
    aliasComponents: [{ fieldName: 'displayName' }],
  },
  ...Object.fromEntries(DEFAULT_ALIAS_TYPES.map(typeName => [typeName, DEFAULT_ALIAS_DATA])),
}

const filterCreator: FilterCreator = () => ({
  name: 'addAlias',
  onFetch: async (elements: Element[]): Promise<void> => {
    const elementsMap = _.groupBy(elements.filter(isInstanceElement), instance => instance.elemID.typeName)
    addAliasToElements({
      elementsMap,
      aliasMap,
    })
  },
})

export default filterCreator
