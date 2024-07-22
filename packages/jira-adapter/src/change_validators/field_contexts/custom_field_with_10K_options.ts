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
  ChangeError,
  ChangeValidator,
  ElemID,
  InstanceElement,
  ModificationChange,
  SeverityLevel,
  getChangeData,
  isAdditionChange,
  isAdditionOrModificationChange,
  isEqualValues,
  isInstanceChange,
} from '@salto-io/adapter-api'
import { getParents } from '@salto-io/adapter-utils'
import { FIELD_CONTEXT_TYPE_NAME, FIELD_TYPE_NAME, OPTIONS_ORDER_TYPE_NAME } from '../../filters/fields/constants'
import { getOptionsFromContext } from '../../filters/fields/context_options'
import { JiraConfig } from '../../config/config'
import { getContextParent } from '../../common/fields'

const hasNewOption = (change: ModificationChange<InstanceElement> | AdditionChange<InstanceElement>): boolean => {
  if (isAdditionChange(change)) {
    return true
  }
  const { before, after } = change.data
  const optionsBefore = getOptionsFromContext(before)
  const optionsAfter = getOptionsFromContext(after)
  return !isEqualValues(optionsBefore, optionsAfter)
}

const getError = (elemID: ElemID, fieldName: string): ChangeError => {
  const bla = {
    elemID,
    severity: 'Info' as SeverityLevel,
    message: 'Slow deployment due to field with more than 10K options',
    detailedMessage: `The deployment of custom field ${fieldName}'s options will be slower because there are more than 10K options.`,
  }
  return bla
}
// const getError = (elemID: ElemID, fieldName: string): ChangeError => ({
//   elemID,
//   severity: 'Info' as SeverityLevel,
//   message: 'Slow deployment due to field with more than 10K options',
//   detailedMessage: `The deployment of custom field ${fieldName}'s options will be slower because there are more than 10K options.`,
// })

export const customFieldsWith10KOptionValidator: (config: JiraConfig) => ChangeValidator = config => async changes =>
  config.fetch.splitFieldContextOptions
    ? changes
        .filter(isInstanceChange)
        .filter(isAdditionOrModificationChange)
        .filter(change => getChangeData(change).elemID.typeName === OPTIONS_ORDER_TYPE_NAME)
        .map(getChangeData)
        .filter(instance => instance.value.options.length > 10000)
        .map(instance => getError(instance.elemID, getParents(getContextParent(instance))[0].value.elemID.name))
    : changes
        .filter(isInstanceChange)
        .filter(isAdditionOrModificationChange)
        .filter(change => getChangeData(change).elemID.typeName === FIELD_CONTEXT_TYPE_NAME)
        .filter(change => getOptionsFromContext(getChangeData(change)).length > 10000)
        .filter(hasNewOption)
        .map(getChangeData)
        .filter(instance => getParents(instance)[0].elemID.typeName === FIELD_TYPE_NAME)
        .map(instance => getError(instance.elemID, getParents(instance)[0].elemID.name))
