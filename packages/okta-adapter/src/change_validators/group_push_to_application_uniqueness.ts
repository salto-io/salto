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
import {
  CORE_ANNOTATIONS,
  ChangeError,
  ChangeValidator,
  getChangeData,
  isAdditionChange,
  isInstanceChange,
  isInstanceElement,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { groupBy } from 'lodash'
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
  const addedGroupPushInstances = changes
    .filter(isInstanceChange)
    .filter(isAdditionChange)
    .map(change => getChangeData(change))
    .filter(instance => instance.elemID.typeName === GROUP_PUSH_TYPE_NAME)
    .filter(
      groupPush =>
        isReferenceExpression(groupPush.value.userGroupId) &&
        isReferenceExpression(groupPush.annotations[CORE_ANNOTATIONS.PARENT]?.[0]),
    )

  if (addedGroupPushInstances.length === 0) {
    return []
  }

  const existingGroupPushInstances = await awu(await elementsSource.getAll())
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === GROUP_PUSH_TYPE_NAME)
    .filter(
      groupPush =>
        isReferenceExpression(groupPush.value.userGroupId) &&
        isReferenceExpression(groupPush.annotations[CORE_ANNOTATIONS.PARENT]?.[0]),
    )
    .toArray()

  const groupPushByApp = groupBy(
    existingGroupPushInstances,
    groupPush => groupPush.annotations[CORE_ANNOTATIONS.PARENT][0],
  )

  return addedGroupPushInstances.flatMap((instance): ChangeError[] => {
    const groupElemId = instance.value.userGroupId.elemID
    const applicationElemId = instance.annotations[CORE_ANNOTATIONS.PARENT][0].elemID
    const groupName = groupElemId.getFullName()
    const applicationName = applicationElemId.getFullName()
    const existingGroupPushInstance = (groupPushByApp[applicationElemId] ?? []).find(
      groupPush =>
        groupPush.value.userGroupId.elemID.isEqual(groupElemId) && !groupPush.elemID.isEqual(instance.elemID),
    )
    if (existingGroupPushInstance) {
      return [
        {
          elemID: instance.elemID,
          severity: 'Error',
          message: `Group ${groupName} is already mapped to ${applicationName}`,
          detailedMessage: `GroupPush ${existingGroupPushInstance.annotations[CORE_ANNOTATIONS.ALIAS]} already maps group ${groupName} to application ${applicationName}`,
        },
      ]
    }
    return []
  })
}
