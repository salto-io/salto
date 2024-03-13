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
  isFieldChange,
  Field,
  getChangeData,
  ChangeError,
} from '@salto-io/adapter-api'
import { EVENT_CUSTOM_OBJECT, TASK_CUSTOM_OBJECT } from '../constants'
import { apiNameSync, isCustomObjectSync } from '../filters/utils'

const isFieldOfTaskOrEvent = ({ parent }: Field): boolean =>
  isCustomObjectSync(parent) &&
  [TASK_CUSTOM_OBJECT, EVENT_CUSTOM_OBJECT].includes(apiNameSync(parent) ?? '')

const createFieldOfTaskOrEventChangeError = (field: Field): ChangeError => ({
  elemID: field.elemID,
  severity: 'Error',
  message: 'Modifying a field of Task or Event is not allowed',
  detailedMessage: `Modifing the field ${field.name} of the ${apiNameSync(field.parent)} object directly is forbidden. Instead, modify the corresponding field in the Activity Object`,
})

const changeValidator: ChangeValidator = async (changes) =>
  changes
    .filter(isFieldChange)
    .map(getChangeData)
    .filter(isFieldOfTaskOrEvent)
    .map(createFieldOfTaskOrEventChangeError)

export default changeValidator
