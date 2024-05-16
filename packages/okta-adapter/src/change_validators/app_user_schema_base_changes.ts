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
} from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { APP_USER_SCHEMA_TYPE_NAME } from '../constants'

const getErrorFromChange = (
  change: ModificationChange<InstanceElement> | AdditionChange<InstanceElement>,
): ChangeError | undefined => {
  if (isAdditionChange(change)) {
    return {
      elemID: change.data.after.elemID,
      severity: 'Warning',
      message: 'Cannot deploy the base field in App User Schema',
      detailedMessage:
        'Okta API does not support deploying the base field in App User Schema. Salto will deploy the element without the base field. After fetch the field will be updated as the client',
    }
  }
  const { before, after } = change.data
  const beforeBase = before.value.definitions?.base
  const afterBase = after.value.definitions?.base

  const afterWithSameBase = after.clone()

  if (_.isUndefined(beforeBase)) {
    _.unset(afterWithSameBase.value, ['definitions', 'base'])
  } else {
    _.set(afterWithSameBase.value, ['definitions', 'base'], beforeBase)
  }

  if (!_.isEqual(beforeBase, afterBase)) {
    if (_.isEqual(afterWithSameBase.value, change.data.before.value)) {
      return {
        elemID: change.data.after.elemID,
        severity: 'Error',
        message: 'Cannot change the base field in App User Schema',
        detailedMessage: 'Okta API does not support deploying the base field in App User Schema.',
      }
    }
    return {
      elemID: change.data.after.elemID,
      severity: 'Warning',
      message: 'Cannot modify the base field in App User Schema',
      detailedMessage:
        'Okta API does not support modifying the base field in App User Schema. Salto will deploy the other changes in this appUserSchema.',
    }
  }
  return undefined
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
