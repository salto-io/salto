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
  isAdditionOrModificationChange,
  isInstanceChange,
  SeverityLevel,
} from '@salto-io/adapter-api'
import { PROJECT_TYPE } from '../../constants'
import JiraClient from '../../client/client'

export const teamManagedProjectValidator: (client: JiraClient) => ChangeValidator = client => async changes => {
  if (client.isDataCenter) {
    return []
  }

  return changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .filter(change => change.data.after.elemID.typeName === PROJECT_TYPE)
    .map(getChangeData)
    .filter(instance => instance.value.style === 'next-gen')
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Error' as SeverityLevel,
      message: "Can't deploy a team-managed project",
      detailedMessage: 'Currently team-managed projects are not supported. The project will not be deployed.',
    }))
}
