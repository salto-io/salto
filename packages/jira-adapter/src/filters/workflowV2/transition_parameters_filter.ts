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
import { Change, ChangeDataType, Element, Values, getChangeData, isAdditionOrModificationChange, isInstanceChange, isInstanceElement } from '@salto-io/adapter-api'
import { FilterCreator } from '../../filter'
import { JIRA_WORKFLOW_TYPE } from '../../constants'


const VALIDATOR_LIST_FIELDS = new Set(['statusIds', 'groupsExemptFromValidation', 'fieldsRequired'])
const CONDITION_LIST_FIELDS = new Set(['roleIds', 'groupIds', 'statusIds'])

const convertIdsStringToList = (ids: string): string[] => ids.split(',')

const convertParametersFieldsToList = (
  parameters: Values,
  listFields: Set<string>
): void => {
  if (parameters === undefined) {
    return
  }
  Object.entries(parameters)
    .filter(([key, value]) => !_.isEmpty(value) && _.isString(value) && listFields.has(key))
    .forEach(([key, value]) => {
      parameters[key] = convertIdsStringToList(value)
    })
}

const convertParametersFieldsToString = (
  parameters: Values,
  listFields: Set<string>
): void => {
  if (parameters === undefined) {
    return
  }
  Object.entries(parameters)
    .filter(([key, value]) => !_.isEmpty(value) && _.isArray(value) && listFields.has(key))
    .forEach(([key, value]) => {
      parameters[key] = value.join(',')
    })
}

const convertTransitionParametersFieldsToList = (transitions: Values[]): void => {
  transitions.forEach((transition: Values) => {
    transition.conditions?.conditions?.forEach((condition: Values) => {
      convertParametersFieldsToList(condition?.parameters, CONDITION_LIST_FIELDS)
    })
    transition.validators?.forEach((validator:Values) => {
      convertParametersFieldsToList(validator?.parameters, VALIDATOR_LIST_FIELDS)
    })
  })
}
const convertTransitionParametersFieldsToString = (transitions: Values[]): void => {
  transitions.forEach((transition: Values) => {
    transition.conditions?.conditions?.forEach((condition: Values) => {
      convertParametersFieldsToString(condition?.parameters, CONDITION_LIST_FIELDS)
    })
    transition.validators?.forEach((validator:Values) => {
      convertParametersFieldsToString(validator?.parameters, VALIDATOR_LIST_FIELDS)
    })
  })
}

/*
* This filter converts workflow transition validators and conditions parameters from a concatenated string
* to a list of strings to create references
*/
const filter: FilterCreator = ({ config }) => ({
  name: 'workflowTransitionParametersFilter',
  onFetch: async (elements: Element[]) => {
    if (!config.fetch.enableNewWorkflowAPI) {
      return
    }
    elements
      .filter(element => element.elemID.typeName === JIRA_WORKFLOW_TYPE)
      .filter(isInstanceElement)
      .forEach(instance => {
        convertTransitionParametersFieldsToList(instance.value.transitions)
      })
  },
  preDeploy: async (changes: Change<ChangeDataType>[]) => {
    if (!config.fetch.enableNewWorkflowAPI) {
      return
    }
    changes
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === JIRA_WORKFLOW_TYPE)
      .forEach(instance => {
        const workflow = instance.value.workflows[0]
        convertTransitionParametersFieldsToString(workflow.transitions)
      })
  },
  onDeploy: async (changes: Change<ChangeDataType>[]) => {
    if (!config.fetch.enableNewWorkflowAPI) {
      return
    }
    changes
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === JIRA_WORKFLOW_TYPE)
      .forEach(instance => {
        const workflow = instance.value.workflows[0]
        convertTransitionParametersFieldsToList(workflow.transitions)
      })
  },
})

export default filter
