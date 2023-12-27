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
import { CORE_ANNOTATIONS, ChangeError, ChangeValidator, getChangeData, isAdditionChange, isInstanceChange, isInstanceElement } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { GROUP_PUSH_TYPE_NAME } from '../constants'

const { awu } = collections.asynciterable
const log = logger(module)

/**
 * Validate uniqueness of group push to application
 */
export const groupPushToApplicationUniquenessValidator: ChangeValidator = async (changes, elementsSource) => {
  if (!elementsSource) {
    log.warn('elementsSource was not provided to groupPushToApplicationUniqueness, skipping validator')
    return []
  }
  const groupPushAdditionChanges = changes
    .filter(isInstanceChange)
    .filter(isAdditionChange)
    .map(change => getChangeData(change))
    .filter(instance => instance.elemID.typeName === GROUP_PUSH_TYPE_NAME)
  if (groupPushAdditionChanges.length === 0) {
    return []
  }
  const existingGroupToApplication = await awu(await elementsSource.getAll())
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === GROUP_PUSH_TYPE_NAME)
    .reduce<Record<string, { application: string; groupPushAlias: string }[]>>((record, currentGroupPush) => {
      const currentGroup = currentGroupPush.value?.userGroupId?.elemID?.getFullName() as string
      const currentApplication = currentGroupPush
        .annotations[CORE_ANNOTATIONS.PARENT]?.[0]?.elemID?.getFullName() as string
      if (!currentGroup || !currentApplication) {
        return record
      }
      return {
        ...record,
        [currentGroup]: (record[currentGroup] || [])
          .concat({
            application: currentApplication,
            groupPushAlias: currentGroupPush.annotations[CORE_ANNOTATIONS.ALIAS],
          }),
      }
    }, {})

  return groupPushAdditionChanges
    .flatMap((instance): ChangeError[] => {
      const group = instance.value?.userGroupId?.elemID?.getFullName()
      const application = instance.annotations[CORE_ANNOTATIONS.PARENT]?.[0]?.elemID?.getFullName()
      const existingRecord = (existingGroupToApplication[group] || [])
        .find(record => record.application === application)
      if (existingRecord) {
        return [{
          elemID: instance.elemID,
          severity: 'Error',
          message: `Group ${group} is already mapped to ${application}`,
          detailedMessage: `GroupPush ${existingRecord.groupPushAlias} already maps group ${group} to application ${application}`,
        }]
      }
      return []
    })
}
