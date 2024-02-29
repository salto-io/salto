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
import { ChangeValidator, getChangeData, isInstanceChange, SeverityLevel, isRemovalChange } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { getInstancesFromElementSource, getParent } from '@salto-io/adapter-utils'
import { ISSUE_TYPE_ICON_NAME, ISSUE_TYPE_NAME } from '../constants'

const { awu } = collections.asynciterable

/*
 * This validator checks whether an issue type icon can be deleted.
 * It is not allowed to delete an issue type icon without deleting the issue type itself.
 */
export const deleteIssueTypeIconValidator: ChangeValidator = async (changes, elementSource) => {
  if (elementSource === undefined) {
    return []
  }
  const issueTypesNames = (await getInstancesFromElementSource(elementSource, [ISSUE_TYPE_NAME])).map(
    issueType => issueType.elemID.name,
  )
  return awu(changes)
    .filter(isInstanceChange)
    .filter(change => getChangeData(change).elemID.typeName === ISSUE_TYPE_ICON_NAME)
    .filter(isRemovalChange)
    .filter(change => {
      try {
        const instance = getChangeData(change)
        const parentName = getParent(instance).elemID.name
        return issueTypesNames.includes(parentName)
      } catch (e) {
        return false
      }
    })
    .map(getChangeData)
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Error' as SeverityLevel,
      message: 'Cannot delete issue type icon without deleting the issue type itself.',
      detailedMessage: `Issue type icon ${instance.elemID.name} cannot be deleted without deleting the issue type itself. Please delete the issue type first and then try again.`,
    }))
    .toArray()
}
