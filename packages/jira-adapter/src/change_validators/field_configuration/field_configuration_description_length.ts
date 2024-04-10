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
  isModificationChange,
  SeverityLevel,
} from '@salto-io/adapter-api'
import { 
  FIELD_CONFIGURATION_DESCRIPTION_MAX_LENGTH, 
  FIELD_CONFIGURATION_ITEM_DESCRIPTION_MAX_LENGTH, 
  FIELD_CONFIGURATION_ITEM_TYPE_NAME, 
  FIELD_CONFIGURATION_TYPE_NAME 
} from '../../constants';

const maxLengthsMap: Map<string, number> = new Map();
maxLengthsMap.set(FIELD_CONFIGURATION_TYPE_NAME, FIELD_CONFIGURATION_DESCRIPTION_MAX_LENGTH)
maxLengthsMap.set(FIELD_CONFIGURATION_ITEM_TYPE_NAME, FIELD_CONFIGURATION_ITEM_DESCRIPTION_MAX_LENGTH)

export const fieldConfigurationDescriptionLengthValidator: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .filter(isModificationChange)
    .filter(change => maxLengthsMap.has(getChangeData(change).elemID.typeName))
    .filter(change => change.data.after.value.description !== undefined)
    .filter(
      change => {
        const maxLength = maxLengthsMap.get(getChangeData(change).elemID.typeName)
        return maxLength!== undefined && change.data.after.value.description.length > maxLength
      }
    )
    .map(change => ({
      elemID: getChangeData(change).elemID,
      severity: 'Error' as SeverityLevel,
      message: 'Description length exceeded maximum.',
      detailedMessage: `Description length (${change.data.after.value.description.length}) exceeded the allowed maximum of ${maxLengthsMap.get(getChangeData(change).elemID.typeName)} characters.`,
    }))
