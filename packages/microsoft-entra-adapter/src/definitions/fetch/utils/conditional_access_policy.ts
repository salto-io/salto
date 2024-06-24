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

import { validatePlainObject } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { AdjustFunction } from '../types'
import {
  CONDITIONAL_ACCESS_POLICY_TYPE_NAME,
  EXCLUDE_USERS_FIELD_NAME,
  INCLUDE_USERS_FIELD_NAME,
} from '../../../constants'

/*
 * Adjust the conditional access policy object to include the includeUsers field and excludeUsers fields
 * only if they do not include user ids, which we don't handle.
 */
export const adjustConditionalAccessPolicy: AdjustFunction = async ({ value }) => {
  validatePlainObject(value, CONDITIONAL_ACCESS_POLICY_TYPE_NAME)
  const includeUsers = _.get(value, `conditions.users.${INCLUDE_USERS_FIELD_NAME}`, [])
  const excludeUsers = _.get(value, `conditions.users.${EXCLUDE_USERS_FIELD_NAME}`, [])
  return {
    value: {
      ...value,
      conditions: {
        ...value.conditions,
        users: {
          ..._.get(value, 'conditions.users'),
          // We don't handle users, and therefore will include this field only if it doesn't include user ids
          [INCLUDE_USERS_FIELD_NAME]: _.isEqual(includeUsers, ['All']) ? includeUsers : undefined,
          [EXCLUDE_USERS_FIELD_NAME]: _.isEqual(excludeUsers, ['All']) ? excludeUsers : undefined,
        },
      },
    },
  }
}
