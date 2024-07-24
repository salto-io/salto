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
import {
  APP_USER_SCHEMA_TYPE_NAME,
  BASE_FIELD,
  DEFINITIONS_FIELD,
  GROUP_SCHEMA_TYPE_NAME,
  USER_SCHEMA_TYPE_NAME,
} from '../constants'

const CUSTOM_PROPERTIES_PATH = ['definitions', 'custom', 'properties']

const SCHEMAS_TO_PATH: Record<string, string[]> = {
  [GROUP_SCHEMA_TYPE_NAME]: CUSTOM_PROPERTIES_PATH,
  [APP_USER_SCHEMA_TYPE_NAME]: CUSTOM_PROPERTIES_PATH,
  [USER_SCHEMA_TYPE_NAME]: CUSTOM_PROPERTIES_PATH,
}

export const BASE_PATH = [DEFINITIONS_FIELD, BASE_FIELD]

export const getErrorWithSeverity = (elemID: ElemID, severity: SeverityLevel): ChangeError => ({
  elemID,
  severity,
  message: "Base attributes cannot be deployed via Okta's APIs",
  detailedMessage:
    'Salto cannot deploy changes to base attributes, as they are automatically determined by the associated schema.',
})

const getModificationError = (change: ModificationChange<InstanceElement>): ChangeError | undefined => {
  const { before, after } = change.data
  const beforeBase = _.get(before.value, BASE_PATH)
  const afterBase = _.get(after.value, BASE_PATH)

  if (_.isEqual(beforeBase, afterBase)) {
    return undefined
  }
  const beforeValueWithoutBase = _.omit(before.value, BASE_PATH.join('.'))
  const afterValueWithoutBase = _.omit(after.value, BASE_PATH.join('.'))
  // If the base field is the only change, we will not deploy it
  if (_.isEqual(beforeValueWithoutBase, afterValueWithoutBase)) {
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
 * Verifies that schema instances are not modified within the base field.
 */
// TODO: change the file name to schema_base_changes.ts
export const schemaBaseChangesValidator: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .filter(change => Object.keys(SCHEMAS_TO_PATH).includes(getChangeData(change).elemID.typeName))
    .map(getErrorFromChange)
    .filter(values.isDefined)
