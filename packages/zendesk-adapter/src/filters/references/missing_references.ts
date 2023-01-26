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
import { ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { references as referenceUtils } from '@salto-io/adapter-components'
import { naclCase } from '@salto-io/adapter-utils'
import { ORG_FIELD_TYPE_NAME, TICKET_FIELD_TYPE_NAME, USER_FIELD_TYPE_NAME } from '../../constants'

const MISSING_REF_PREFIX = 'missing_'

export const VALUES_TO_SKIP_BY_TYPE: Record<string, string[]> = {
  group: ['current_groups', 'group_id'],
  webhook: ['(Value no longer exists. Choose another.)'],
}

const VALUE_BY_TYPE: Record<string, string> = {
  [TICKET_FIELD_TYPE_NAME]: 'custom_fields_',
  [USER_FIELD_TYPE_NAME]: 'requester.custom_fields.',
  [ORG_FIELD_TYPE_NAME]: 'organization.custom_fields.',
}

export const createMissingInstance = (
  adapter: string,
  typeName: string,
  refName: string
): InstanceElement => (
  new InstanceElement(
    naclCase(`${MISSING_REF_PREFIX}${refName}`),
    new ObjectType({ elemID: new ElemID(adapter, typeName) }),
    {},
    undefined,
    { [referenceUtils.MISSING_ANNOTATION]: true },
  )
)

export const ZendeskMissingReferenceStrategyLookup: Record<
referenceUtils.MissingReferenceStrategyName, referenceUtils.MissingReferenceStrategy
> = {
  typeAndValue: {
    create: ({ value, adapter, typeName }) => {
      if (!_.isString(typeName) || !value || VALUES_TO_SKIP_BY_TYPE[typeName]?.includes(value)) {
        return undefined
      }
      return createMissingInstance(adapter, typeName, value)
    },
  },
  startsWith: {
    create: ({ value, adapter, typeName }) => {
      if (_.isString(typeName)
        && value
        && !VALUES_TO_SKIP_BY_TYPE[typeName]?.includes(value)
        && value.startsWith(VALUE_BY_TYPE[typeName])
      ) {
        return createMissingInstance(adapter, typeName, value)
      }
      return undefined
    },
  },
}
