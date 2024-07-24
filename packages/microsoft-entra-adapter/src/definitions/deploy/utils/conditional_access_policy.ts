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
import { isAdditionChange } from '@salto-io/adapter-api'
import { CONDITIONAL_ACCESS_POLICY_TYPE_NAME } from '../../../constants'
import { AdjustFunctionSingle } from '../types'

/*
 * Adjust the conditional access policy object to include the includeUsers field.
 * The includeUsers field is only included on specific conditions, but is required on addition.
 * Therefore, we set it to a default of 'none' when it's not specified.
 */
export const adjustConditionalAccessPolicy: AdjustFunctionSingle = async ({ value, context: { change } }) => {
  validatePlainObject(value, CONDITIONAL_ACCESS_POLICY_TYPE_NAME)

  if (!isAdditionChange(change)) {
    return { value }
  }

  return {
    value: {
      ...value,
      conditions: {
        ..._.get(value, 'conditions', {}),
        users: {
          ..._.get(value, 'conditions.users', {}),
          // We store the includeUsers field only on specific conditions.
          // However, this field is required on addition, so we set it to a default of 'none' when it's not specified.
          includeUsers: _.get(value, 'conditions.users.includeUsers') ?? ['none'],
        },
      },
    },
  }
}
