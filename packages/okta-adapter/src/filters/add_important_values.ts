/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { CORE_ANNOTATIONS, Element, isObjectType } from '@salto-io/adapter-api'
import { ImportantValues } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import {
  APPLICATION_TYPE_NAME,
  AUTHENTICATOR_TYPE_NAME,
  BEHAVIOR_RULE_TYPE_NAME,
  BRAND_TYPE_NAME,
  GROUP_RULE_TYPE_NAME,
  GROUP_TYPE_NAME,
  NETWORK_ZONE_TYPE_NAME,
  POLICY_TYPE_NAMES,
  POLICY_RULE_TYPE_NAMES,
  AUTOMATION_TYPE_NAME,
  AUTOMATION_RULE_TYPE_NAME,
} from '../constants'

const importantValuesMap: Record<string, ImportantValues> = {
  [APPLICATION_TYPE_NAME]: [
    {
      value: 'label',
      highlighted: true,
      indexed: false,
    },
    {
      value: 'signOnMode',
      highlighted: true,
      indexed: true,
    },
    {
      value: 'status',
      highlighted: true,
      indexed: true,
    },
    {
      value: 'accessPolicy',
      highlighted: false,
      indexed: true,
    },
    {
      value: 'profileEnrollment',
      highlighted: false,
      indexed: true,
    },
  ],
  [GROUP_TYPE_NAME]: [
    {
      value: 'type',
      highlighted: false,
      indexed: true,
    },
    {
      value: 'source.id',
      highlighted: false,
      indexed: true,
    },
  ],
  [GROUP_RULE_TYPE_NAME]: [
    {
      value: 'name',
      highlighted: true,
      indexed: false,
    },
    {
      value: 'status',
      highlighted: true,
      indexed: true,
    },
    {
      value: 'actions.assignUserToGroups.groupIds',
      highlighted: false,
      indexed: true,
    },
    {
      value: 'allGroupsValid',
      highlighted: false,
      indexed: true,
    },
  ],
  [AUTHENTICATOR_TYPE_NAME]: [
    {
      value: 'name',
      highlighted: true,
      indexed: false,
    },
    {
      value: 'key',
      highlighted: true,
      indexed: false,
    },
    {
      value: 'status',
      highlighted: true,
      indexed: true,
    },
  ],
  [BEHAVIOR_RULE_TYPE_NAME]: [
    {
      value: 'name',
      highlighted: true,
      indexed: false,
    },
    {
      value: 'type',
      highlighted: true,
      indexed: true,
    },
    {
      value: 'status',
      highlighted: true,
      indexed: true,
    },
  ],
  [NETWORK_ZONE_TYPE_NAME]: [
    {
      value: 'name',
      highlighted: true,
      indexed: false,
    },
    {
      value: 'type',
      highlighted: true,
      indexed: true,
    },
    {
      value: 'status',
      highlighted: true,
      indexed: true,
    },
  ],
  [BRAND_TYPE_NAME]: [
    {
      value: 'name',
      highlighted: true,
      indexed: false,
    },
    {
      value: 'isDefault',
      highlighted: true,
      indexed: false,
    },
    {
      value: 'locale',
      highlighted: true,
      indexed: true,
    },
  ],
  ...Object.fromEntries(
    POLICY_TYPE_NAMES.concat(POLICY_RULE_TYPE_NAMES, AUTOMATION_TYPE_NAME, AUTOMATION_RULE_TYPE_NAME).map(
      policyName => [
        policyName,
        [
          { value: 'name', highlighted: true, indexed: false },
          { value: 'status', highlighted: true, indexed: true },
        ],
      ],
    ),
  ),
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
