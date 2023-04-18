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

import { ChangeError, ChangeValidator, InstanceElement, ModificationChange, getChangeData, isEqualValues, isInstanceChange, isModificationChange } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { GROUP_SCHEMA_TYPE_NAME } from '../constants'

const { awu } = collections.asynciterable

const isBaseFieldModified = (
  change: ModificationChange<InstanceElement>
): boolean => {
  const { before, after } = change.data
  const beforeBase = before.value.definitions.base
  const afterBase = after.value.definitions.base
  return !isEqualValues(beforeBase, afterBase)
}

export const groupSchemaModifyBaseValidator: ChangeValidator = async changes => (
  awu(changes)
    .filter(isInstanceChange)
    .filter(isModificationChange)
    .filter(change => getChangeData(change).elemID.typeName === GROUP_SCHEMA_TYPE_NAME)
    .filter(isBaseFieldModified)
    .map(getChangeData)
    .map((instance: InstanceElement): ChangeError => ({
      elemID: instance.elemID,
      severity: 'Error',
      message: `Cannot change base attributes of ${GROUP_SCHEMA_TYPE_NAME}`,
      detailedMessage: `Cannot change ${GROUP_SCHEMA_TYPE_NAME}, because base properties section can not be changed.`,
    }))
    .toArray()
)
