/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { ChangeValidator, getChangeData, isInstanceChange, isModificationChange, isRemovalChange, SaltoErrorSeverity } from '@salto-io/adapter-api'
import { resolveChangeElement } from '@salto-io/adapter-utils'
import { getLookUpName } from '../reference_mapping'
import { getDiffIds } from '../diff'


export const issueTypeSchemeValidator: ChangeValidator = async changes => {
  const instanceChanges = changes
    .filter(isInstanceChange)

  const defaultIssueTypeSchemeChange = instanceChanges
    .filter(isModificationChange)
    .filter(change => getChangeData(change).elemID.typeName === 'IssueTypeScheme')
    .find(change => getChangeData(change).value.isDefault)

  if (defaultIssueTypeSchemeChange === undefined) {
    return []
  }

  const resolvedDefaultSchemeChange = await resolveChangeElement(
    defaultIssueTypeSchemeChange,
    getLookUpName,
  )
  const { removedIds: removedIdsFromDefaultScheme } = getDiffIds(
    resolvedDefaultSchemeChange.data.before.value.issueTypeIds ?? [],
    resolvedDefaultSchemeChange.data.after.value.issueTypeIds ?? []
  )

  const deletedIds = instanceChanges
    .filter(isRemovalChange)
    .filter(change => getChangeData(change).elemID.typeName === 'IssueType')
    .map(change => getChangeData(change).value.id)

  const deletedIdsSet = new Set(deletedIds)

  if (removedIdsFromDefaultScheme.every(id => deletedIdsSet.has(id))) {
    return []
  }

  const { elemID } = getChangeData(resolvedDefaultSchemeChange)

  return [{
    elemID,
    severity: 'Error' as SaltoErrorSeverity,
    message: 'Cannot remove issue types from default issue type scheme',
    detailedMessage: `Removing issue types from the default issue type scheme ${elemID.getFullName()} is not supported`,
  }]
}
