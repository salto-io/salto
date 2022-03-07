/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { BuiltinTypes, CORE_ANNOTATIONS, Element, Field, isInstanceElement, ListType, MapType } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { findObject } from '../../utils'
import { FilterCreator } from '../../filter'
import { postFunctionType, types as postFunctionTypes } from './post_functions_types'
import { Condition, isWorkflowInstance, Rules, Status, Validator, Workflow } from './types'
import { validatorType, types as validatorTypes } from './validators_types'
import { WORKFLOW_RULES_TYPE_NAME, WORKFLOW_TYPE_NAME } from '../../constants'

const log = logger(module)

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

const transformStatus = (status: Status): void => {
  status.properties = status.properties?.additionalProperties
  // This is not deployable and we get another property
  // of "jira.issue.editable" with the same value
  delete status.properties?.issueEditable
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

const transformCondition = (condition: Condition): void => {
  if (isExtensionType(condition.type)) {
    delete condition.configuration?.id
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

const transformWorkflowInstance = (workflowValues: Workflow): void => {
  workflowValues.entityId = workflowValues.id?.entityId
  workflowValues.name = workflowValues.id?.name
  delete workflowValues.id

  workflowValues.statuses?.forEach(transformStatus)

  workflowValues.transitions
    ?.filter(transition => transition.rules !== undefined)
    .forEach(transition => transformRules(transition.rules as Rules, transition.type))
}

// This filter transforms the workflow values structure so it will fit its deployment endpoint
const filter: FilterCreator = ({ config }) => ({
  onFetch: async (elements: Element[]) => {
    const workflowType = findObject(elements, WORKFLOW_TYPE_NAME)
    if (workflowType !== undefined) {
      delete workflowType.fields.id
      workflowType.fields.operations.annotations[CORE_ANNOTATIONS.HIDDEN_VALUE] = true
    }

    const workflowStatusType = findObject(elements, 'WorkflowStatus')
    if (workflowStatusType === undefined) {
      log.warn('WorkflowStatus type was not received in fetch')
    } else {
      workflowStatusType.fields.properties = new Field(workflowStatusType, 'properties', new MapType(BuiltinTypes.STRING))
      if (config.client.usePrivateAPI) {
        workflowStatusType.fields.name.annotations[CORE_ANNOTATIONS.CREATABLE] = true
      }
    }

    const workflowRulesType = findObject(elements, WORKFLOW_RULES_TYPE_NAME)

    if (workflowRulesType === undefined) {
      log.warn('WorkflowRules type was not received in fetch')
    } else {
      workflowRulesType.fields.conditions = new Field(workflowRulesType, 'conditions', await workflowRulesType.fields.conditionsTree.getType())
      delete workflowRulesType.fields.conditionsTree

      workflowRulesType.fields.postFunctions = new Field(workflowRulesType, 'postFunctions', new ListType(postFunctionType))
      workflowRulesType.fields.validators = new Field(workflowRulesType, 'validators', new ListType(validatorType))
    }
    elements.push(...postFunctionTypes)
    elements.push(...validatorTypes)

    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === WORKFLOW_TYPE_NAME)
      .filter(isWorkflowInstance)
      .forEach(instance => transformWorkflowInstance(instance.value))
  },
})

export default filter
