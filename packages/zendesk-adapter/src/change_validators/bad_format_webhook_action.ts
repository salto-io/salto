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
import {
  ChangeError,
  ChangeValidator,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceChange,
} from '@salto-io/adapter-api'
import { values as lowerDashValues } from '@salto-io/lowerdash'

const { isDefined } = lowerDashValues

type Action = {
    field: string
    value: unknown
}

const isAction = (value: unknown): value is Action => (
  _.isObject(value) && 'field' in value && 'value' in value
)

const POTENTIAL_BAD_FORMAT_TYPES = ['automation', 'trigger']

export const badFormatWebhookActionValidator : ChangeValidator = async changes =>
  changes.filter(isInstanceChange).filter(isAdditionOrModificationChange)
    .map(getChangeData).filter(instance => POTENTIAL_BAD_FORMAT_TYPES.includes(instance.elemID.typeName))
    .filter(instance => _.isArray(instance.value.actions))
    .map((instance) : ChangeError | undefined => {
      const webhookActions = instance.value.actions.filter(isAction).filter((action: Action) => action.field === 'notification_webhook')
      if (webhookActions.some((action: Action) => !_.isArray(action.value))) {
        const { typeName } = instance.elemID
        return {
          elemID: instance.elemID,
          severity: 'Warning',
          message: `${typeName} instance might not work properly`,
          detailedMessage: `The element have an action with of notification_webhook with a value in a bad format. This might cause the ${typeName} to not work properly.`,
        }
      }
      return undefined
    })
    .filter(isDefined)
