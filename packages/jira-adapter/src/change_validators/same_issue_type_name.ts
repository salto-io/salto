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
import { AdditionChange, Change, ChangeDataType, ChangeError, ChangeValidator, getChangeData, InstanceElement, isAdditionOrModificationChange, isInstanceChange, ModificationChange, SeverityLevel } from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { ISSUE_TYPE_NAME } from '../constants'


const { awu } = collections.asynciterable
const { isDefined } = values

const getSameIssueTypeNameError = (
  change: ModificationChange<InstanceElement> | AdditionChange<InstanceElement>,
  existingIssueType: InstanceElement,
): ChangeError => ({
  elemID: getChangeData(change).elemID,
  severity: 'Error' as SeverityLevel,
  message: 'Issue type must have unique name',
  detailedMessage: `This issue type name ${existingIssueType.value.name} is already being used by another issue type ${existingIssueType.elemID.getFullName()}, and can not be deployed.`,
})

const getRelevantChanges = (
  changes: ReadonlyArray<Change<ChangeDataType>>
): (ModificationChange<InstanceElement> | AdditionChange<InstanceElement>
)[] =>
  changes
    .filter(isAdditionOrModificationChange)
    .filter(change => getChangeData(change).elemID.typeName === ISSUE_TYPE_NAME)
    .filter(isInstanceChange)

export const sameIssueTypeNameChangeValidator: ChangeValidator = async (changes, elementSource) => {
  const relevantChanges = getRelevantChanges(changes)
  if (elementSource === undefined || relevantChanges.length === 0) {
    return []
  }
  const idsIterator = awu(await elementSource.list())
  const issueTypes: InstanceElement[] = await awu(idsIterator)
    .filter(id => id.typeName === ISSUE_TYPE_NAME)
    .filter(id => id.idType === 'instance')
    .map(id => elementSource.get(id))
    .toArray()
  const issuesByNames = _.groupBy(
    [...issueTypes, ...relevantChanges.map(getChangeData)],
    issueType => issueType.value.name,
  )
  return relevantChanges
    .map(change => {
      const otherInstance = issuesByNames[getChangeData(change).value.name]?.find(
        issueType => !issueType.elemID.isEqual(getChangeData(change).elemID)
      )
      if (otherInstance === undefined) {
        return undefined
      }
      return getSameIssueTypeNameError(change, otherInstance)
    }).filter(isDefined)
}
