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
import { BuiltinTypes, CORE_ANNOTATIONS, Element, ElemID, Field, isInstanceElement, ListType, MapType, SaltoError, Value } from '@salto-io/adapter-api'
import _ from 'lodash'
import { walkOnValue, WALK_NEXT_STEP, naclCase, invertNaclCase } from '@salto-io/adapter-utils'
import { findObject } from '../../utils'
import { FilterCreator } from '../../filter'
import { postFunctionType, types as postFunctionTypes } from './post_functions_types'
import { createConditionConfigurationTypes } from './conditions_types'
import { Condition, isWorkflowResponseInstance, Rules, WorkflowResponse, Status, Transition, Validator } from './types'
import { validatorType, types as validatorTypes } from './validators_types'
import { JIRA, WORKFLOW_RULES_TYPE_NAME, WORKFLOW_TRANSITION_TYPE_NAME, WORKFLOW_TYPE_NAME } from '../../constants'

const NOT_FETCHED_POST_FUNCTION_TYPES = [
  'GenerateChangeHistoryFunction',
  'IssueReindexFunction',
  'IssueCreateFunction',
]

const FETCHED_ONLY_INITIAL_POST_FUNCTION = [
  'UpdateIssueStatusFunction',
  'CreateCommentFunction',
  'IssueStoreFunction',
]

const PARTS_SEPARATOR = '::'

const TYPE_TO_FROM_MAP = new Map([
  ['Initial', 'none'],
  ['Global', 'any status'],
  ['Circular', 'any status'],
])

type TransitionType = 'Directed' | 'Initial' | 'Global' | 'Circular'

const createStatusMap = (statuses: Status[]): Map<string, string> => new Map(statuses
  .filter((status): status is {id: string; name: string} => typeof status.id === 'string' && status.name !== undefined)
  .map((status => [status.id, status.name])))

const getTransitionType = (transition: Transition): TransitionType => {
  if (transition.type === 'initial') {
    return 'Initial'
  }
  if (transition.from !== undefined
    && transition.from.length !== 0) {
    return 'Directed'
  }
  if ((transition.to ?? '') === '') {
    return 'Circular'
  }
  return 'Global'
}

// The key will be in the format of {transition name}::From: {from name}::{transition type}
// Transitions that were created from any in the UI will have From: any status
// The initial transition will have From: none
// In case the user has a status named none or any status there will still be no problem due to the type
// The types can be Directed, Initial, Global, and Circular (which is global circular)
export const getTransitionKey = (transition: Transition, statusesMap: Map<string, string>): string => {
  const type = getTransitionType(transition)
  const fromSorted = type === 'Directed'
    ? (transition.from?.map(from => (
      typeof from === 'string' ? from : from.id ?? ''
    )) ?? [])
      .map(from => statusesMap.get(from) ?? from)
      .sort()
      .join(',')
    : TYPE_TO_FROM_MAP.get(type) ?? ''

  return naclCase([transition.name ?? '', `From: ${fromSorted}`, type].join(PARTS_SEPARATOR))
}

const transformProperties = (item: Status | Transition): void => {
  item.properties = item.properties?.additionalProperties
  // This is not deployable and we get another property
  // of "jira.issue.editable" with the same value
  delete item.properties?.issueEditable
}

const isExtensionType = (type: string | undefined): boolean => type !== undefined && type.includes('__')

const transformPostFunctions = (rules: Rules, transitionType?: string): void => {
  rules.postFunctions
    ?.filter(({ type }) => type === 'FireIssueEventFunction')
    .forEach(postFunc => {
      // This is not deployable and the id property provides the same info
      delete postFunc.configuration?.event?.name
    })

    rules.postFunctions
      ?.filter(({ type }) => type === 'SetIssueSecurityFromRoleFunction')
      .forEach(postFunc => {
        // This is not deployable and the id property provides the same info
        delete postFunc.configuration?.projectRole?.name
      })

    rules.postFunctions
      ?.filter(({ type }) => isExtensionType(type))
      .forEach(postFunc => {
        delete postFunc.configuration?.id
      })

    rules.postFunctions = rules.postFunctions?.filter(
      postFunction => (transitionType === 'initial'
        ? !NOT_FETCHED_POST_FUNCTION_TYPES.includes(postFunction.type ?? '')
        : ![...NOT_FETCHED_POST_FUNCTION_TYPES, ...FETCHED_ONLY_INITIAL_POST_FUNCTION].includes(postFunction.type ?? '')),
    )
}

const transformValidator = (validator: Validator): void => {
  const config = validator.configuration
  if (config === undefined) {
    return
  }

  config.windowsDays = _.isString(config.windowsDays)
    ? parseInt(config.windowsDays, 10)
    : config.windowsDays

  // The name value is not deployable and the id property provides the same info
  config.parentStatuses?.forEach(status => { delete status.name })
  delete config.previousStatus?.name

  if (config.field !== undefined) {
    config.fieldId = config.field
    delete config.field
  }

  if (config.fields !== undefined) {
    config.fieldIds = config.fields
    delete config.fields
  }

  if (isExtensionType(validator.type)) {
    delete config.id
  }
}

const removeNameValues = (values: Record<string | number, unknown>): void => {
  walkOnValue({
    elemId: new ElemID(JIRA, WORKFLOW_TYPE_NAME, 'instance', 'workflow'),
    value: values,
    func: ({ value }) => {
      if (_.isPlainObject(value)) {
        delete value.name
      }
      return WALK_NEXT_STEP.RECURSE
    },
  })
}

const transformCondition = (condition: Condition): void => {
  if (isExtensionType(condition.type)) {
    delete condition.configuration?.id
  }

  if (condition.configuration !== undefined) {
    removeNameValues(condition.configuration)
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  condition.conditions?.forEach(transformCondition)
}

const transformRules = (rules: Rules, transitionType?: string): void => {
  rules.conditions = rules.conditionsTree
  delete rules.conditionsTree

  if (rules.conditions !== undefined) {
    transformCondition(rules.conditions)
  }
  transformPostFunctions(rules, transitionType)
  rules.validators?.forEach(transformValidator)
}

const transformTransitions = (value: Value): SaltoError[] => {
  const statusesMap = createStatusMap(value.statuses ?? [])
  const maxCounts: Record<string, number> = {}
  value.transitions.forEach((transition: Transition) => {
    const key = getTransitionKey(transition, statusesMap)
    maxCounts[key] = (maxCounts[key] ?? 0) + 1
  })

  const counts: Record<string, number> = {}

  value.transitions = Object.fromEntries(value.transitions
    // This is Value and not the actual type as we change types
    .map((transition: Value) => {
      const key = getTransitionKey(transition, statusesMap)
      counts[key] = (counts[key] ?? 0) + 1
      if (maxCounts[key] > 1) {
        return [naclCase(`${invertNaclCase(key)}${PARTS_SEPARATOR}${counts[key]}`), transition]
      }
      return [key, transition]
    }))
  const errorKeys = Object.entries(counts)
    .filter(([, count]) => count > 1)
    .map(([key]) => key)

  return errorKeys.length === 0
    ? []
    : [{
      message: `The following transitions of workflow ${value.name} have the same key: ${errorKeys.join(', ')}.
It is strongly recommended to rename these transitions so they are unique in Jira, then re-fetch`,
      severity: 'Warning',
    }]
}

const transformWorkflowInstance = (workflowValues: WorkflowResponse): SaltoError[] => {
  workflowValues.entityId = workflowValues.id?.entityId
  workflowValues.name = workflowValues.id?.name
  delete workflowValues.id

  workflowValues.statuses?.forEach(transformProperties)

  workflowValues.transitions.forEach(transformProperties)
  workflowValues.transitions
    .filter(transition => transition.rules !== undefined)
    .forEach(transition => {
      transformRules(transition.rules as Rules, transition.type)
    })

  // The type is changed after transform Transitions, so should be last
  return transformTransitions(workflowValues)
}

// This filter transforms the workflow values structure so it will fit its deployment endpoint
const filter: FilterCreator = ({ config }) => ({
  name: 'workflowStructureFilter',
  onFetch: async (elements: Element[]) => {
    const workflowTransitionType = findObject(elements, WORKFLOW_TRANSITION_TYPE_NAME)

    const workflowType = findObject(elements, WORKFLOW_TYPE_NAME)
    if (workflowType !== undefined) {
      delete workflowType.fields.id
      workflowType.fields.operations.annotations[CORE_ANNOTATIONS.HIDDEN_VALUE] = true
      if (workflowTransitionType !== undefined) {
        workflowType.fields.transitions = new Field(workflowType, 'transitions', new MapType(workflowTransitionType))
      }
    }

    const workflowStatusType = findObject(elements, 'WorkflowStatus')
    if (workflowStatusType !== undefined) {
      workflowStatusType.fields.properties = new Field(workflowStatusType, 'properties', new MapType(BuiltinTypes.STRING))
      if (config.client.usePrivateAPI) {
        workflowStatusType.fields.name.annotations[CORE_ANNOTATIONS.CREATABLE] = true
      }
    }

    const workflowRulesType = findObject(elements, WORKFLOW_RULES_TYPE_NAME)

    const conditionConfigurationTypes = createConditionConfigurationTypes()

    if (workflowRulesType !== undefined) {
      workflowRulesType.fields.conditions = new Field(workflowRulesType, 'conditions', await workflowRulesType.fields.conditionsTree.getType())
      delete workflowRulesType.fields.conditionsTree

      workflowRulesType.fields.postFunctions = new Field(workflowRulesType, 'postFunctions', new ListType(postFunctionType))
      workflowRulesType.fields.validators = new Field(workflowRulesType, 'validators', new ListType(validatorType))
    }

    const worfkflowConditionType = findObject(elements, 'WorkflowCondition')

    if (worfkflowConditionType !== undefined) {
      worfkflowConditionType.fields.configuration = new Field(worfkflowConditionType, 'configuration', conditionConfigurationTypes.type)
    }

    elements.push(...postFunctionTypes)
    elements.push(...validatorTypes)
    elements.push(conditionConfigurationTypes.type, ...conditionConfigurationTypes.subTypes)

    const errors = elements
      .filter(isInstanceElement)
      .filter(isWorkflowResponseInstance)
      .map(instance => transformWorkflowInstance(instance.value)) // also changes the instance
      .flat()
    return { errors }
  },
})

export default filter
