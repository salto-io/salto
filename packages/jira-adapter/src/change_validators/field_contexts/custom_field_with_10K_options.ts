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

import {
  AdditionChange,
  ChangeValidator,
  InstanceElement,
  ModificationChange,
  getChangeData,
  isAdditionChange,
  isAdditionOrModificationChange,
  isEqualValues,
  isInstanceChange,
} from '@salto-io/adapter-api'
import { getParents } from '@salto-io/adapter-utils'
import { FIELD_CONTEXT_TYPE_NAME, FIELD_TYPE_NAME } from '../../filters/fields/constants'
import { getOptionsFromContext } from '../../filters/fields/context_options'

const hasNewOption = (change: ModificationChange<InstanceElement> | AdditionChange<InstanceElement>): boolean => {
  if (isAdditionChange(change)) {
    return true
  }
  const { before, after } = change.data
  const optionsBefore = getOptionsFromContext(before)
  const optionsAfter = getOptionsFromContext(after)
  return !isEqualValues(optionsBefore, optionsAfter)
}

export const customFieldsWith10KOptionValidator: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .filter(change => getChangeData(change).elemID.typeName === FIELD_CONTEXT_TYPE_NAME)
    .filter(change => getOptionsFromContext(getChangeData(change)).length > 10000)
    .filter(hasNewOption)
    .map(getChangeData)
    .filter(instance => getParents(instance)[0].elemID.typeName === FIELD_TYPE_NAME)
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Info',
      message: 'Slow deployment due to field with more than 10K options',
      detailedMessage: `The deployment of custom field ${getParents(instance)[0].elemID.name} will be slower because it is associated with this context, which has more than 10K options.`,
    }))
