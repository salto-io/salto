/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/

import _ from 'lodash'
import { references as referenceUtils } from '@salto-io/adapter-components'
import {
  CUSTOM_OBJECT_FIELD_TYPE_NAME,
  CUSTOM_STATUS_TYPE_NAME,
  ORG_FIELD_TYPE_NAME,
  TAG_TYPE_NAME,
  TICKET_FIELD_TYPE_NAME,
  USER_FIELD_TYPE_NAME,
} from '../../constants'

export type ZendeskMissingReferenceStrategyName =
  | referenceUtils.MissingReferenceStrategyName
  | 'startsWith'
  | 'prefixAndNumber'

export const VALUES_TO_SKIP_BY_TYPE: Record<string, string[]> = {
  group: ['current_groups', 'group_id'],
  webhook: ['(Value no longer exists. Choose another.)'],
}

const VALUE_BY_TYPE: Record<string, string[]> = {
  [TICKET_FIELD_TYPE_NAME]: ['custom_fields_', 'zen:custom_object:'],
  [USER_FIELD_TYPE_NAME]: ['requester.custom_fields.'],
  [ORG_FIELD_TYPE_NAME]: ['organization.custom_fields.'],
  [CUSTOM_OBJECT_FIELD_TYPE_NAME]: ['zen:custom_object:'],
  [CUSTOM_STATUS_TYPE_NAME]: ['custom_status_'],
}

export const ZendeskMissingReferenceStrategyLookup: Record<
  ZendeskMissingReferenceStrategyName,
  referenceUtils.MissingReferenceStrategy
> = {
  typeAndValue: {
    create: ({ value, adapter, typeName }) => {
      if (
        !_.isString(typeName) ||
        !value ||
        VALUES_TO_SKIP_BY_TYPE[typeName]?.includes(value) ||
        typeName === TAG_TYPE_NAME
      ) {
        return undefined
      }
      return referenceUtils.createMissingInstance(adapter, typeName, value)
    },
  },
  startsWith: {
    create: ({ value, adapter, typeName }) => {
      if (
        _.isString(typeName) &&
        value &&
        !VALUES_TO_SKIP_BY_TYPE[typeName]?.includes(value) &&
        (VALUE_BY_TYPE[typeName] ?? []).some(prefix => value.startsWith(prefix))
      ) {
        return referenceUtils.createMissingInstance(adapter, typeName, value)
      }
      return undefined
    },
  },
  prefixAndNumber: {
    create: ({ value, adapter, typeName }) => {
      if (
        _.isString(typeName) &&
        value &&
        !VALUES_TO_SKIP_BY_TYPE[typeName]?.includes(value) &&
        (VALUE_BY_TYPE[typeName] ?? []).some(prefix => value.match(`${prefix}\\d+`) !== null)
      ) {
        return referenceUtils.createMissingInstance(adapter, typeName, value)
      }
      return undefined
    },
  },
}
