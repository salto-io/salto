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
import { FIELD_CONFIGURATION_DESCRIPTION_MAX_LENGTH } from '../constants'

export const fieldConfigurationDescriptionValidator: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .filter(isModificationChange)
    .filter(change => getChangeData(change).elemID.typeName === 'FieldConfiguration')
    .filter(
      change => change.data.after.value.description.length > FIELD_CONFIGURATION_DESCRIPTION_MAX_LENGTH
    )
    .map(change => ({
      elemID: getChangeData(change).elemID,
      severity: 'Error' as SeverityLevel,
      message: 'Exceeded field configuration description maximum length.',
      detailedMessage: `Description length (${change.data.after.value.description.length}) of the field configuration exceeded the maximum of ${FIELD_CONFIGURATION_DESCRIPTION_MAX_LENGTH} characters.`,
    }))
