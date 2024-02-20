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
  isRemovalOrModificationChange,
  SeverityLevel,
} from '@salto-io/adapter-api'

export const RoleName = 'atlassian-addons-project-access'

export const readOnlyProjectRoleChangeValidator: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .filter(isRemovalOrModificationChange)
    .filter(change => getChangeData(change).elemID.typeName === 'ProjectRole')
    .filter(change => getChangeData(change).value.name === RoleName)
    .map(change => ({
      elemID: getChangeData(change).elemID,
      severity: 'Error' as SeverityLevel,
      message: 'Changes to the “atlassian-addons-project-access” Project Role won’t be deployed.',
      detailedMessage:
        'Changes to the “atlassian-addons-project-access” Project Role won’t be deployed, as it’s only used by addons that are not installed on the target environment. See https://confluence.atlassian.com/servicedeskcloud/blog/2017/02/add-on-permissions-update to learn more about this role.',
    }))
