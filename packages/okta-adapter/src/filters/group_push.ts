/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import Joi from 'joi'
import { InstanceElement, Change, getChangeData, isRemovalChange, isInstanceChange } from '@salto-io/adapter-api'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import { GROUP_PUSH_TYPE_NAME, GROUP_PUSH_RULE_TYPE_NAME } from '../constants'

type GroupPushEntry = {
  mappingId: string
  status: string
  sourceUserGroupId: string
  targetGroupName: string
  ruleId: string
}

const GROUP_PUSH_SCHEMA = Joi.object({
  mappingId: Joi.string().required(),
  status: Joi.string().required(),
  sourceUserGroupId: Joi.string().required(),
  targetGroupName: Joi.string().required(),
  ruleId: Joi.string().allow(null),
}).unknown(true)

export const isGroupPushEntry = createSchemeGuard<GroupPushEntry>(
  GROUP_PUSH_SCHEMA,
  'Received an invalid group push entry',
)

export const isAppSupportsGroupPush = (instance: InstanceElement): boolean =>
  Array.isArray(instance.value.features) && instance.value.features.includes('GROUP_PUSH')

/**
 * Prepare payload for group push and group push rule removals
 */
const groupPushFilter: FilterCreator = () => ({
  name: 'groupPushFilter',
  preDeploy: async (changes: Change<InstanceElement>[]) => {
    changes
      .filter(isInstanceChange)
      .filter(isRemovalChange)
      .filter(change =>
        [GROUP_PUSH_TYPE_NAME, GROUP_PUSH_RULE_TYPE_NAME].includes(getChangeData(change).elemID.typeName),
      )
      .map(getChangeData)
      .forEach(instance => {
        // The payload on removal change should only include
        // the desired side affect of removing a push group or a push group rule
        if (instance.elemID.typeName === GROUP_PUSH_TYPE_NAME) {
          // The associated group created in the target app will be deleted
          instance.value.deleteAppGroup = true
        }
        if (instance.elemID.typeName === GROUP_PUSH_RULE_TYPE_NAME) {
          // All groups pushed by this rule will be deleteds from the target app
          instance.value.action = 'DELETE_MAPPINGS_AND_DELETE_APP_GROUPS'
        }
      })
  },
  onDeploy: async (changes: Change<InstanceElement>[]) => {
    changes
      .filter(isInstanceChange)
      .filter(isRemovalChange)
      .filter(change =>
        [GROUP_PUSH_TYPE_NAME, GROUP_PUSH_RULE_TYPE_NAME].includes(getChangeData(change).elemID.typeName),
      )
      .map(getChangeData)
      .forEach(instance => {
        if (instance.elemID.typeName === GROUP_PUSH_TYPE_NAME) {
          delete instance.value.deleteAppGroup
        }
        if (instance.elemID.typeName === GROUP_PUSH_RULE_TYPE_NAME) {
          delete instance.value.action
        }
      })
  },
})

export default groupPushFilter
