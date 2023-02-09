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

import { Change, ChangeDataType, getChangeData, isAdditionOrModificationChange, isInstanceChange } from '@salto-io/adapter-api'
import { isProjectReferenceBroken, ProjectType, isProjectType } from '../../change_validators/automation_unresolved_references'
import { AUTOMATION_TYPE } from '../../constants'
import { FilterCreator } from '../../filter'


// we allow broken references between Automation to Project,
// so in this filter we remove those broken references in preDeploy and add them back in onDeploy
export const filter: FilterCreator = () => {
  const preDeployProjects: Record<string, ProjectType[]> = {}
  return {
    name: 'automationProjectBrokenReferenceFilter',
    preDeploy: async (changes: Change<ChangeDataType>[]) => {
      changes.filter(isInstanceChange)
        .filter(isAdditionOrModificationChange)
        .filter(change => getChangeData(change).elemID.typeName === AUTOMATION_TYPE)
        .filter(change => getChangeData(change).value.projects !== undefined)
        .forEach(change => {
          preDeployProjects[getChangeData(change).elemID.getFullName()] = change.data.after.value.projects
          change.data.after.value.projects = change.data.after.value.projects
            .filter((project: unknown) => !isProjectType(project) || !isProjectReferenceBroken(project))
        })
    },

    onDeploy: async (changes: Change<ChangeDataType>[]) => {
      changes.filter(isInstanceChange)
        .filter(isAdditionOrModificationChange)
        .filter(change => getChangeData(change).elemID.typeName === AUTOMATION_TYPE)
        .filter(change => getChangeData(change).value.projects !== undefined)
        .forEach(change => {
          if (preDeployProjects[getChangeData(change).elemID.getFullName()] !== undefined) {
            change.data.after.value.projects = preDeployProjects[getChangeData(change).elemID.getFullName()]
          }
        })
    },
  }
}

export default filter
