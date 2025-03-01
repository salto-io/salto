/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
import { getParentElemID } from '@salto-io/adapter-utils'
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

  const groupPushByApp = groupBy(existingGroupPushInstances, groupPush => getParentElemID(groupPush).getFullName())

  return addedGroupPushInstances.flatMap((instance): ChangeError[] => {
    const groupElemId = instance.value.userGroupId.elemID
    const applicationElemId = instance.annotations[CORE_ANNOTATIONS.PARENT][0].elemID
    const groupName = groupElemId.getFullName()
    const applicationName = applicationElemId.getFullName()
    const existingGroupPushInstance = (groupPushByApp[applicationName] ?? []).find(
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
