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
import { Element, InstanceElement, isInstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import _ from 'lodash'
import { walkOnElement, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import { FilterCreator } from '../../filter'
import { isWorkflowInstance, WorkflowInstance } from './types'
import { GROUP_TYPE_NAME } from '../../constants'

const ANY_GROUP_CONDITION = 'UserInAnyGroupCondition'
const SINGLE_GROUP_CONDITION = 'UserInGroupCondition'


export const fixGroupNames = (
  instance: WorkflowInstance,
  groups: Record<string, InstanceElement> = {}
): void => {
  walkOnElement({
    element: instance,
    func: ({ value }) => {
      if (!_.isPlainObject(value) || !_.isPlainObject(value.configuration)) {
        return WALK_NEXT_STEP.RECURSE
      }

      if (value.type === ANY_GROUP_CONDITION) {
        value.configuration.groups = value.configuration.groups
          ?.map((groupName: string) => groupName.toLowerCase())
          .map((groupName: string) => (
            groupName in groups
              ? new ReferenceExpression(groups[groupName].elemID.createNestedID('name'), groups[groupName].value.name)
              : groupName
          ))
        return WALK_NEXT_STEP.SKIP
      }

      if (value.type === SINGLE_GROUP_CONDITION) {
        value.configuration.group = value.configuration.group?.toLowerCase()
        const groupInstance = groups[value.configuration.group]

        if (groupInstance !== undefined) {
          value.configuration.group = new ReferenceExpression(
            groupInstance.elemID.createNestedID('name'),
            groupInstance.value.name
          )
        }

        return WALK_NEXT_STEP.SKIP
      }

      return WALK_NEXT_STEP.RECURSE
    },
  })
}

/**
 * This filter is to handle a weird behavior of Jira where in workflow
 * the group name must be lower cased, and if deployed lower cased with
 * the API it will then returned lower cased from fetch, so we need to be
 * able to still create references to the right group
 */
const filter: FilterCreator = () => ({
  name: 'workflowGroupsFilter',
  onFetch: async (elements: Element[]) => {
    const instances = elements.filter(isInstanceElement)

    const groups = _(instances)
      .filter(instance => instance.elemID.typeName === GROUP_TYPE_NAME)
      .keyBy(group => group.value.name.toLowerCase())
      .value()

    instances
      .filter(isWorkflowInstance)
      .forEach(instance => {
        fixGroupNames(instance, groups)
      })
  },
})

export default filter
