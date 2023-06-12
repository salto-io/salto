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

import { isAdditionOrModificationChange, ChangeValidator, getChangeData, isInstanceChange, SeverityLevel, isReferenceExpression, UnresolvedReference, ReferenceExpression } from '@salto-io/adapter-api'
import _ from 'lodash'
import { AUTOMATION_TYPE } from '../constants'


export type ProjectType = { projectId: ReferenceExpression }

export const isProjectType = (element: unknown): element is ProjectType => {
  const projectId = _.get(element, 'projectId')
  return projectId !== undefined && isReferenceExpression(projectId)
}

export const isProjectReferenceBroken = (project: ProjectType): boolean =>
  project.projectId.value instanceof UnresolvedReference


export const automationProjectUnresolvedReferenceValidator: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === AUTOMATION_TYPE)
    .filter(instance => instance.value.projects !== undefined)
    .map(instance => ({
      instance,
      brokenReferencesNames: instance.value.projects
        .filter(isProjectType)
        .filter(isProjectReferenceBroken)
        .map((project: ProjectType) => project.projectId.value.target.name),
    }))
    .filter(({ brokenReferencesNames }) => brokenReferencesNames.length > 0)
    .map(({ instance, brokenReferencesNames }) => {
      const brokenReferencesNamesString = brokenReferencesNames.join(', ')
      // automation must have at least one project to be valid
      if (brokenReferencesNames.length === instance.value.projects.length) {
        return {
          elemID: instance.elemID,
          severity: 'Error' as SeverityLevel,
          message: 'Automation isn’t attached to any existing project',
          detailedMessage: `All projects attached to this automation do not exist in the target environment: ${brokenReferencesNamesString}. The automation can’t be deployed. To solve this, go back and include at least one attached project in your deployment.`,
        }
      }
      return {
        elemID: instance.elemID,
        severity: 'Warning' as SeverityLevel,
        message: 'Automation won’t be attached to some projects',
        detailedMessage: `The automation is attached to some projects which do not exist in the target environment: ${brokenReferencesNamesString}. If you continue, the automation will be deployed without them. Alternatively, you can go back and include these projects in your deployment.`,
      }
    })
