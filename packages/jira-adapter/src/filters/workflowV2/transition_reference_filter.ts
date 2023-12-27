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
import { ConditionParameters, Transition, ValidatorParameters } from './types'
import { JIRA_WORKFLOW_TYPE } from '../../constants'


const VALIDATOR_LIST_FIELDS = new Set(['statusIds', 'groupsExemptFromValidation', 'fieldsRequired'])
const CONDITION_LIST_FIELDS = new Set(['roleIds', 'groupIds', 'statusIds'])

const convertIdsStringToList = (idOrIdList: string | string[]): string[] => {
  if (_.isArray(idOrIdList)) {
    return idOrIdList
  }
  return _.split(idOrIdList, ',')
}

const convertParameters = (
  parameters: ConditionParameters | ValidatorParameters | undefined,
  listFields: Set<string>
): void => {
  if (parameters === undefined) {
    return
  }
  Object.entries(parameters)
    .filter(([, value]) => !_.isEmpty(value))
    .forEach(([key, value]) => {
      if (value === undefined || !listFields.has(key)) {
        return
      }
      parameters[key as keyof (typeof parameters)] = convertIdsStringToList(value)
    })
}

/*
* This filter converts workflow transition validators and conditions parameters from a concatenated string
* to a list of strings to create references
*/
const filter: FilterCreator = ({ config, fetchQuery }) => ({
  name: 'workflowTransitionReferenceFilter',
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
              convertParameters(condition.parameters, CONDITION_LIST_FIELDS)
            })
          transition.validators?.forEach(validator => {
            convertParameters(validator.parameters, VALIDATOR_LIST_FIELDS)
          })
        })
      })
  },
})

export default filter
