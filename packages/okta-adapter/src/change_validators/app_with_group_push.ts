/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ChangeValidator, getChangeData, isInstanceChange, isAdditionChange } from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { getParent } from '@salto-io/adapter-utils'
import { GROUP_PUSH_RULE_TYPE_NAME, GROUP_PUSH_TYPE_NAME } from '../constants'
import { isAppSupportsGroupPush } from '../filters/group_push'

const log = logger(module)
const { isDefined } = values

const GROUP_PUSH_HELP_ARTICLE =
  'https://help.okta.com/oie/en-us/content/topics/users-groups-profiles/usgp-group-push-prerequisites.htm'

/**
 * Verify application supports group push feature before addition of GroupPush and GroupPushRule instances
 */
export const appWithGroupPushValidator: ChangeValidator = async changes => {
  const groupPushInstances = changes
    .filter(isInstanceChange)
    .filter(isAdditionChange)
    .map(getChangeData)
    .filter(instance => [GROUP_PUSH_TYPE_NAME, GROUP_PUSH_RULE_TYPE_NAME].includes(instance.elemID.typeName))

  const invalidGroupPushToApp = Object.fromEntries(
    groupPushInstances
      .map(groupPush => {
        try {
          const parentApp = getParent(groupPush)
          return isAppSupportsGroupPush(parentApp) ? undefined : [groupPush.elemID.getFullName(), parentApp.elemID.name]
        } catch (err) {
          log.error(`Could not find parent app for: ${groupPush.elemID.getFullName()}: ${err.message}`)
          return undefined
        }
      })
      .filter(isDefined),
  )

  return groupPushInstances
    .filter(instance => invalidGroupPushToApp[instance.elemID.getFullName()] !== undefined)
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Error',
      message: 'Group Push is not supported for application',
      detailedMessage: `Group Push must be enabled for application ${invalidGroupPushToApp[instance.elemID.getFullName()]}, for more info see: ${GROUP_PUSH_HELP_ARTICLE}`,
    }))
}
