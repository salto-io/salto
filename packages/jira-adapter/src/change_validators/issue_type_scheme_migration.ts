/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Change,
  ChangeError,
  ChangeValidator,
  getChangeData,
  InstanceElement,
  isInstanceChange,
  isInstanceElement,
  isModificationChange,
  ModificationChange,
  ReferenceExpression,
  SeverityLevel,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { client as clientUtils } from '@salto-io/adapter-components'
import { collections, values } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import {
  getInstancesFromElementSource,
  isResolvedReferenceExpression,
  safeJsonStringify,
} from '@salto-io/adapter-utils'
import JiraClient from '../client/client'
import { ISSUE_TYPE_SCHEMA_NAME, PROJECT_TYPE } from '../constants'

const { awu } = collections.asynciterable
const log = logger(module)
const { isDefined } = values

const isSameRef = (ref1: ReferenceExpression, ref2: ReferenceExpression): boolean => ref1.elemID.isEqual(ref2.elemID)

const getRemovedIssueTypeIds = (change: ModificationChange<InstanceElement>): ReferenceExpression[] => {
  const { before, after } = change.data
  const beforeIssueIds = (before.value.issueTypeIds ?? []).filter(isResolvedReferenceExpression)
  const afterIssueIds = (after.value.issueTypeIds ?? []).filter(isResolvedReferenceExpression)
  return _.differenceWith(beforeIssueIds, afterIssueIds, isSameRef)
}

const getRelevantChanges = (changes: ReadonlyArray<Change>): ModificationChange<InstanceElement>[] =>
  changes
    .filter(isModificationChange)
    .filter(isInstanceChange)
    .filter(change => getChangeData(change).elemID.typeName === ISSUE_TYPE_SCHEMA_NAME)
    .filter(change => getRemovedIssueTypeIds(change).length > 0)

const getIssueTypeSchemeMigrationError = (
  issueTypeScheme: InstanceElement,
  removedIssueTypeNames: string[],
): ChangeError => {
  const plural = removedIssueTypeNames.length > 1
  return {
    elemID: issueTypeScheme.elemID,
    severity: 'Error' as SeverityLevel,
    message: `Cannot remove issue ${plural ? 'types' : 'type'} from scheme`,
    detailedMessage: `The issue ${plural ? 'types' : 'type'} ${removedIssueTypeNames.join(', ')} have assigned issues and cannot be removed from this issue type scheme`,
  }
}

const areIssueTypesUsed = async (
  client: JiraClient,
  issueType: string,
  linkedProjectNames: string[],
): Promise<boolean> => {
  const jql = `project in (${linkedProjectNames.join(',')}) AND issuetype = ${issueType}`
  let response: clientUtils.Response<clientUtils.ResponseValue | clientUtils.ResponseValue[]>
  try {
    response = await client.get({
      url: '/rest/api/3/search',
      queryParams: {
        jql,
        maxResults: '0',
      },
    })
  } catch (e) {
    log.error(`Received an error Jira search API, ${e.message}. Assuming issue type "${issueType}" has no issues.`)
    return false
  }

  if (Array.isArray(response.data) || response.data.total === undefined) {
    log.error(
      `Received invalid response from Jira search API, ${safeJsonStringify(response.data, undefined, 2)}. Assuming issue type "${issueType}" has no issues.`,
    )
    return false
  }
  return response.data.total !== 0
}

export const issueTypeSchemeMigrationValidator =
  (client: JiraClient): ChangeValidator =>
  async (changes, elementSource) => {
    const relevantChanges = getRelevantChanges(changes)
    if (elementSource === undefined || relevantChanges.length === 0) {
      return []
    }
    const projects = await getInstancesFromElementSource(elementSource, [PROJECT_TYPE])
    const issueTypeSchemesToProjects = _.groupBy(
      projects.filter(
        project =>
          project.value.issueTypeScheme !== undefined && isResolvedReferenceExpression(project.value.issueTypeScheme),
      ),
      project => project.value.issueTypeScheme.elemID.getFullName(),
    )
    const errors = await awu(relevantChanges)
      .map(async change => {
        const issueTypeScheme = getChangeData(change)
        const linkedProjectNames =
          issueTypeSchemesToProjects[issueTypeScheme.elemID.getFullName()]?.map(project => project.value.name) ?? []
        if (linkedProjectNames.length === 0) {
          return undefined
        }
        const removedIssueTypeNames = await awu(getRemovedIssueTypeIds(change))
          .filter(async (ref: ReferenceExpression): Promise<boolean> => isInstanceElement(ref.value))
          .map(issueTypeId => issueTypeId.value.value.name)
          .toArray()
        const removedTypesWithIssues = await awu(removedIssueTypeNames)
          .filter(async issueType => areIssueTypesUsed(client, issueType, linkedProjectNames))
          .toArray()
        if (removedTypesWithIssues.length > 0) {
          return getIssueTypeSchemeMigrationError(issueTypeScheme, removedTypesWithIssues)
        }
        return undefined
      })
      .filter(isDefined)
      .toArray()
    return errors
  }
