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

  const existingGroupToApplication = Object.fromEntries(await (awu(await elementsSource.getAll())
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === GROUP_PUSH_TYPE_NAME)
    .map(groupPush =>
      ([
        groupPush.value?.userGroupId?.elemID?.getFullName(),
        groupPush.annotations[CORE_ANNOTATIONS.PARENT]?.[0]?.elemID?.getFullName(),
      ])))
    .toArray())

  return changes
    .filter(isInstanceChange)
    .filter(isAdditionChange)
    .map(change => getChangeData(change))
    .filter(instance => instance.elemID.typeName === GROUP_PUSH_TYPE_NAME)
    .flatMap((instance): ChangeError[] => {
      const group = instance.value?.userGroupId?.elemID?.getFullName()
      const application = instance.annotations[CORE_ANNOTATIONS.PARENT]?.[0]?.elemID?.getFullName()
      if (group && application && existingGroupToApplication[group] === application) {
        return [{
          elemID: instance.elemID,
          severity: 'Error',
          message: `${group} to ${application} can only be defined on a single groupPush instance`,
          detailedMessage: `${group} to ${application} can only be defined on a single groupPush instance`,
        }]
      }
      return []
    })
}
