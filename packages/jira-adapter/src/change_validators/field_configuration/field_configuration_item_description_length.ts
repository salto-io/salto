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
  SeverityLevel,
  Value,
  isRemovalChange,
} from '@salto-io/adapter-api'
import { 
  FIELD_CONFIGURATION_TYPE_NAME,
  FIELD_CONFIGURATION_ITEM_DESCRIPTION_MAX_LENGTH, 
  FIELD_CONFIGURATION_ITEM_TYPE_NAME, 
} from '../../constants';

type fieldType = {name: string, description: string | undefined}

export const fieldConfigurationItemDescriptionLengthValidator: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .filter(change => !isRemovalChange(change))
    .map(getChangeData)
    .filter(change => change.elemID.typeName === FIELD_CONFIGURATION_TYPE_NAME || change.elemID.typeName === FIELD_CONFIGURATION_ITEM_TYPE_NAME)
    .filter(change => {
      if (change.elemID.typeName === FIELD_CONFIGURATION_ITEM_TYPE_NAME){
        return change.value.description.length > FIELD_CONFIGURATION_ITEM_DESCRIPTION_MAX_LENGTH
      }

      return Object.values(change.value.fields).some(
        (item: Value) => item.description !== undefined && item.description.length > FIELD_CONFIGURATION_ITEM_DESCRIPTION_MAX_LENGTH
      )
    })
    .map(change => {
      const error = {
        elemID: change.elemID,
        severity: 'Error' as SeverityLevel,
        message: 'Description length exceeded maximum.',
        detailedMessage: '',
      }
      if (change.elemID.typeName === FIELD_CONFIGURATION_ITEM_TYPE_NAME) {
        console.log(change)
        error.detailedMessage = `Description length (${change.value.description.length}) of field configuration item (${change.value.id.elemID.getFullName()}) exceeded the allowed maximum of ${FIELD_CONFIGURATION_ITEM_DESCRIPTION_MAX_LENGTH} characters.`
      }
      else {
        const fields = Object.entries(change.value.fields)
        .map(([key, value]: [string, Value]) => ({name: key, description: value.description}))
        .filter((field: fieldType) => field.description !== undefined && field.description.length > FIELD_CONFIGURATION_ITEM_DESCRIPTION_MAX_LENGTH)
        .map(field => field.name)
        if (fields.length > 0) { // Should always be true.
          error.detailedMessage = `Exceeded maximum description length of ${FIELD_CONFIGURATION_ITEM_DESCRIPTION_MAX_LENGTH} characters for the following fields: ${fields}.`
        }
      }

      return error
    })