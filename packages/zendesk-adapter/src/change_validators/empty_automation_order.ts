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
import {
  ChangeValidator,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { AUTOMATION_ORDER_TYPE_NAME } from '../constants'

export const emptyAutomationOrderValidator: ChangeValidator = async changes =>
  changes
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === AUTOMATION_ORDER_TYPE_NAME)
    .flatMap(instance => {
      if (_.isEmpty(instance.value.active) && _.isEmpty(instance.value.inactive)) {
        return [
          {
            elemID: instance.elemID,
            severity: 'Error',
            message: 'Cannot make this change due to empty automation order',
            detailedMessage: 'Automation order must have at least one active or inactive item',
          },
        ]
      }
      return []
    })
