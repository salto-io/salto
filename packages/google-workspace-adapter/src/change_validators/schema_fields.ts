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
  isInstanceChange,
  isModificationChange,
} from '@salto-io/adapter-api'
import { SCHEMA_TYPE_NAME } from '../constants'

const isIllegalFieldChange = (change: ModificationChange<InstanceElement>): boolean => {
  const { before, after } = change.data
  const fieldsName = Object.keys(before.value.fields)
  return fieldsName.some(key => {
    const beforeField = before.value.fields[key]
    const afterField = after.value.fields[key]

    if (afterField !== undefined) {
      // Check if fieldType has changed
      if (beforeField.fieldType !== afterField.fieldType) {
        return true
      }
      // Check if a field was made non-multiValued from multiValued
      if (beforeField.multiValued === true && afterField.multiValued === false) {
        return true
      }
    }
    return false
  })
}

// This validator checks that schema fields are not changed to be single valued or have their type changed
export const schemaFieldsValidator: ChangeValidator = async changes =>
  changes
    .filter(isModificationChange)
    .filter(isInstanceChange)
    .filter(change => change.data.after.elemID.typeName === SCHEMA_TYPE_NAME)
    .filter(isIllegalFieldChange)
    .map(getChangeData)
    .flatMap(instance => [
      {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Can not change field type or change existing field to be single valued',
        detailedMessage: 'Can not change field type or change existing field to be multiValue',
      },
    ])
