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
  InstanceElement,
  ModificationChange,
  getChangeData,
  isEqualValues,
  isInstanceChange,
  isModificationChange,
} from '@salto-io/adapter-api'
import { GROUP_SCHEMA_TYPE_NAME } from '../constants'

const isBaseFieldModified = (change: ModificationChange<InstanceElement>): boolean => {
  const { before, after } = change.data
  const beforeBase = before.value.definitions?.base
  const afterBase = after.value.definitions?.base
  return !isEqualValues(beforeBase, afterBase, { compareByValue: true })
}

export const groupSchemaModifyBaseValidator: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .filter(isModificationChange)
    .filter(change => getChangeData(change).elemID.typeName === GROUP_SCHEMA_TYPE_NAME)
    .filter(isBaseFieldModified)
    .map(getChangeData)
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Error',
      message: `Cannot change base attributes of ${GROUP_SCHEMA_TYPE_NAME}`,
      detailedMessage: `Cannot change base attributes for ${instance.elemID.name}. It is possible to modify the custom attributes section of the group schema.`,
    }))
