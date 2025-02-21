/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  Element,
  InstanceElement,
  isInstanceElement,
  isReferenceExpression,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { setPath, resolvePath } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { GROUP_MEMBERSHIP_TYPE_NAME, GROUP_RULE_TYPE_NAME, PASSWORD_RULE_TYPE_NAME } from '../constants'
import { isValidGroupMembershipInstance } from './group_members'

const log = logger(module)

const orderTargetGroupsInRule = (instance: InstanceElement): void => {
  const idValidTargetGroups = (groups: unknown): groups is ReferenceExpression[] =>
    _.isArray(groups) && groups.every(group => isReferenceExpression(group))
  const targetGroupsPath = instance.elemID.createNestedID('actions', 'assignUserToGroups', 'groupIds')
  const targetGroups = resolvePath(instance, targetGroupsPath)
  if (!idValidTargetGroups(targetGroups)) {
    log.warn('Invalid target groups path in GroupRule, skipped sorting list')
    return
  }
  setPath(
    instance,
    targetGroupsPath,
    _.sortBy(targetGroups, group => group.elemID.getFullName()),
  )
}

const orderPasswordPolicyRuleMethods = (instance: InstanceElement): void => {
  const methodsPath = instance.elemID.createNestedID(
    'actions',
    'selfServicePasswordReset',
    'requirement',
    'primary',
    'methods',
  )
  const methods = resolvePath(instance, methodsPath)
  if (_.isArray(methods)) {
    setPath(instance, methodsPath, methods.sort())
  }
}

const sortGroupMembershipMembers = (instance: InstanceElement): void => {
  if (isValidGroupMembershipInstance(instance)) {
    instance.value.members = instance.value.members.sort()
  }
}

/**
 * Sort lists whose order changes between fetches, to avoid unneeded noise.
 */
const filterCreator: FilterCreator = () => ({
  name: 'unorderedListsFilter',
  onFetch: async (elements: Element[]): Promise<void> => {
    const instances = elements.filter(isInstanceElement)

    instances
      .filter(instance => instance.elemID.typeName === GROUP_RULE_TYPE_NAME)
      .forEach(instance => orderTargetGroupsInRule(instance))

    instances
      .filter(instance => instance.elemID.typeName === PASSWORD_RULE_TYPE_NAME)
      .forEach(instance => orderPasswordPolicyRuleMethods(instance))

    instances
      .filter(instance => instance.elemID.typeName === GROUP_MEMBERSHIP_TYPE_NAME)
      .forEach(instance => sortGroupMembershipMembers(instance)) // we assume user ids were already converted to emails
  },
})

export default filterCreator
