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
import { ChangeError, ChangeValidator, ElemID, getChangeData, InstanceElement, isRemovalChange, SeverityLevel } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { PROJECT_TYPE, WORKFLOW_SCHEME_TYPE_NAME } from '../constants'
import { projectHasWorkflowSchemeReference } from './workflow_scheme_migration'


const { awu } = collections.asynciterable

const getActiveSchemeRemovalError = (elemID: ElemID, projects: InstanceElement[]): ChangeError => ({
  elemID,
  severity: 'Error' as SeverityLevel,
  message: 'Can’t remove schemes that are being used',
  detailedMessage: `This scheme is currently used by ${projects.length === 1 ? 'project' : 'projects'} ${projects.map(project => project.elemID.name).join(', ')}, and can’t be deleted`,
})

export const activeSchemeDeletionValidator: ChangeValidator = async (changes, elementSource) => {
  const relevantChanges = changes
    .filter(isRemovalChange)
    .filter(change => getChangeData(change).elemID.typeName === WORKFLOW_SCHEME_TYPE_NAME)
    .filter(change => getChangeData(change).elemID.idType === 'instance')
  if (elementSource === undefined || relevantChanges.length === 0) {
    return []
  }
  const idsIterator = awu(await elementSource.list())
  const projects = await awu(idsIterator)
    .filter(id => id.typeName === PROJECT_TYPE)
    .filter(id => id.idType === 'instance')
    .map(id => elementSource.get(id))
    .toArray()
  const workflowSchemesToProjects = _.groupBy(
    projects.filter(projectHasWorkflowSchemeReference),
    project => project.value.workflowScheme.elemID.getFullName(),
  )
  return relevantChanges
    .filter(change => workflowSchemesToProjects[getChangeData(change).elemID.getFullName()] !== undefined)
    .map(change => getActiveSchemeRemovalError(
      getChangeData(change).elemID,
      workflowSchemesToProjects[getChangeData(change).elemID.getFullName()],
    ))
}
