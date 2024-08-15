/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import {
  Change,
  ChangeError,
  ChangeValidator,
  ElemID,
  getChangeData,
  InstanceElement,
  isInstanceChange,
  isRemovalChange,
  ReferenceExpression,
  RemovalChange,
  SeverityLevel,
} from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import { getInstancesFromElementSource } from '@salto-io/adapter-utils'
import {
  ISSUE_TYPE_SCHEMA_NAME,
  NOTIFICATION_SCHEME_TYPE_NAME,
  PERMISSION_SCHEME_TYPE_NAME,
  PROJECT_TYPE,
  SECURITY_SCHEME_TYPE,
  WORKFLOW_SCHEME_TYPE_NAME,
} from '../constants'

const { isDefined } = values

const SCHEME_TYPE_TO_PROJECT_FIELD: Record<string, string> = {
  [WORKFLOW_SCHEME_TYPE_NAME]: 'workflowScheme',
  [PERMISSION_SCHEME_TYPE_NAME]: 'permissionScheme',
  [NOTIFICATION_SCHEME_TYPE_NAME]: 'notificationScheme',
  [ISSUE_TYPE_SCHEMA_NAME]: 'issueTypeScheme',
  IssueTypeScreenScheme: 'issueTypeScreenScheme',
  ScreenScheme: 'screenScheme',
  [SECURITY_SCHEME_TYPE]: 'issueSecurityScheme',
  FieldConfigurationScheme: 'fieldConfigurationScheme',
  PriorityScheme: 'priorityScheme',
}
const RELEVANT_TYPES = new Set(Object.keys(SCHEME_TYPE_TO_PROJECT_FIELD))

const getRelevantChanges = (changes: ReadonlyArray<Change>): ReadonlyArray<RemovalChange<InstanceElement>> =>
  changes
    .filter(isInstanceChange)
    .filter(isRemovalChange)
    .filter(change => RELEVANT_TYPES.has(getChangeData(change).elemID.typeName))

const isProjectUsingScheme = (project: InstanceElement, schemeId: ElemID): boolean => {
  const projectField = SCHEME_TYPE_TO_PROJECT_FIELD[schemeId.typeName]
  return (
    project.value[projectField] instanceof ReferenceExpression && project.value[projectField].elemID.isEqual(schemeId)
  )
}

const getActiveSchemeRemovalError = (elemID: ElemID, projects: InstanceElement[]): ChangeError => ({
  elemID,
  severity: 'Error' as SeverityLevel,
  message: 'Can’t remove schemes that are being used',
  detailedMessage: `This scheme is currently used by ${projects.length === 1 ? 'project' : 'projects'} ${projects.map(project => project.elemID.name).join(', ')}, and can’t be deleted`,
})

export const activeSchemeDeletionValidator: ChangeValidator = async (changes, elementSource) => {
  const relevantChanges = getRelevantChanges(changes)
  if (elementSource === undefined || relevantChanges.length === 0) {
    return []
  }
  const projects: InstanceElement[] = await getInstancesFromElementSource(elementSource, [PROJECT_TYPE])
  return relevantChanges
    .map(change => {
      const linkedProjects = projects.filter(project => isProjectUsingScheme(project, getChangeData(change).elemID))
      if (linkedProjects.length === 0) {
        return undefined
      }
      return getActiveSchemeRemovalError(getChangeData(change).elemID, linkedProjects)
    })
    .filter(isDefined)
}
