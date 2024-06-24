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
  ChangeValidator,
  getChangeData,
  isInstanceChange,
  InstanceElement,
  ModificationChange,
  isAdditionOrModificationChange,
  AdditionChange,
  isAdditionChange,
  ChangeError,
  ElemID,
  SeverityLevel,
} from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { APP_USER_SCHEMA_TYPE_NAME, BASE_FIELD, DEFINITIONS_FIELD } from '../constants'

export const BASE_PATH = [DEFINITIONS_FIELD, BASE_FIELD]

export const getErrorWithSeverity = (elemID: ElemID, severity: SeverityLevel): ChangeError => ({
  elemID,
  severity,
  message: "Base attributes cannot be deployed via Okta's APIs",
  detailedMessage:
    'Salto cannot deploy changes to base attributes, as they are determined by the associated application.',
})

const getModificationError = (change: ModificationChange<InstanceElement>): ChangeError | undefined => {
  const { before, after } = change.data
  const beforeBase = _.get(before.value, BASE_PATH)
  const afterBase = _.get(after.value, BASE_PATH)

  if (_.isEqual(beforeBase, afterBase)) {
    return undefined
  }
  const beforeWithoutBase = _.omit(before, ['value', ...BASE_PATH].join('.'))
  const afterWithoutBase = _.omit(after, ['value', ...BASE_PATH].join('.'))

  // If the base field is the only change, we will not deploy it
  if (_.isEqual(beforeWithoutBase, afterWithoutBase)) {
    return getErrorWithSeverity(change.data.after.elemID, 'Error')
  }

  // If the base field is not the only change, we will deploy the other changes
  return getErrorWithSeverity(change.data.after.elemID, 'Warning')
}

const getErrorFromChange = (
  change: ModificationChange<InstanceElement> | AdditionChange<InstanceElement>,
): ChangeError | undefined => {
  if (isAdditionChange(change)) {
    return getErrorWithSeverity(change.data.after.elemID, 'Info')
  }
  return getModificationError(change)
}

/**
 * Verifies that AppUserSchema is not modified within the base field.
 */
export const appUserSchemaBaseChangesValidator: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .filter(change => getChangeData(change).elemID.typeName === APP_USER_SCHEMA_TYPE_NAME)
    .map(getErrorFromChange)
    .filter(values.isDefined)
