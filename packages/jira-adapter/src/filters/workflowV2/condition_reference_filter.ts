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
import _ from 'lodash'
import { Element, isInstanceElement } from '@salto-io/adapter-api'
import { FilterCreator } from '../../filter'
import { ConditionParameters, Transition } from './types'
import { JIRA_WORKFLOW_TYPE } from '../../constants'

const RESTRICT_ISSUE_RULE_KEY = 'system:restrict-issue-transition'
const BLOCKING_CONDITION_RULE_KEY = 'system:parent-or-child-blocking-condition'

const convertIdsStringToList = (idOrIdList: string | string[]): string[] => {
  if (_.isArray(idOrIdList)) {
    return idOrIdList
  }
  return _.split(idOrIdList, ',')
}


/*
* This filter uses the new workflow API to fetch workflows
*/
const filter: FilterCreator = ({ config, fetchQuery }) => ({
  name: 'workflowConditionReferenceFilter',
  onFetch: async (elements: Element[]) => {
    if (!config.fetch.enableNewWorkflowAPI || !fetchQuery.isTypeMatch(JIRA_WORKFLOW_TYPE)) {
      return
    }
    elements
      .filter(element => element.elemID.typeName === JIRA_WORKFLOW_TYPE)
      .filter(isInstanceElement)
      .forEach(instance => {
        instance.value.transitions.forEach((transition: Transition) => {
          transition.conditions?.conditions
            ?.forEach(condition => {
              if (condition.ruleKey === RESTRICT_ISSUE_RULE_KEY) {
                const parameters: ConditionParameters = {}
                Object.entries(condition.parameters)
                  .filter(([, value]) => !_.isEmpty(value))
                  .forEach(([key, value]) => {
                    if (value === undefined) {
                      return
                    }
                    parameters[key as keyof ConditionParameters] = convertIdsStringToList(value)
                  })
                condition.parameters = parameters
              }
              if (condition.ruleKey === BLOCKING_CONDITION_RULE_KEY) {
                if (condition.parameters.statusIds !== undefined) {
                  condition.parameters.statusIds = convertIdsStringToList(condition.parameters.statusIds)
                }
              }
            })
        })
      })
  },
})

export default filter
