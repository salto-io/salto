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

import { ChangeValidator, getChangeData, isAdditionOrModificationChange, isInstanceChange } from '@salto-io/adapter-api'
import { ASSIGNEE_TYPE_FIELD, PROJECT_TYPE } from '../../constants'

const VALID_ASSIGNEE_TYPES = ['PROJECT_LEAD', 'UNASSIGNED']

export const projectAssigneeTypeValidator: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .filter(change => change.data.after.elemID.typeName === PROJECT_TYPE)
    .map(getChangeData)
    .filter(project => project.value[ASSIGNEE_TYPE_FIELD] !== undefined)
    .filter(project => !VALID_ASSIGNEE_TYPES.includes(project.value[ASSIGNEE_TYPE_FIELD]))
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Error',
      message: 'Invalid assignee type',
      detailedMessage: `Project assignee type must be one of [${VALID_ASSIGNEE_TYPES.map(str => `'${str}'`).join(', ')}].`,
    }))
