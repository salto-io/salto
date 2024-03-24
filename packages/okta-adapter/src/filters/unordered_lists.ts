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
import { GROUP_RULE_TYPE_NAME, PASSWORD_RULE_TYPE_NAME } from '../constants'

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
    'additionalProperties',
    'requirement',
    'primary',
    'methods',
  )
  const methods = resolvePath(instance, methodsPath)
  if (_.isArray(methods)) {
    setPath(instance, methodsPath, methods.sort())
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
  },
})

export default filterCreator
