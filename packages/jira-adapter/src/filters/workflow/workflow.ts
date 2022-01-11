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
import { AdditionChange, BuiltinTypes, Element, Field, getChangeData, InstanceElement, isAdditionChange, isInstanceChange, isInstanceElement, ListType, MapType, toChange } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { resolveValues } from '@salto-io/adapter-utils'
import { findObject } from '../../utils'
import { FilterCreator } from '../../filter'
import { postFunctionType, types as postFunctionTypes } from './post_functions_types'
import { isWorkflowInstance, Rules, Status, Validator, Workflow, WorkflowInstance } from './types'
import { validatorType, types as validatorTypes } from './validators_types'
import JiraClient from '../../client/client'
import { JiraConfig } from '../../config'
import { getLookUpName } from '../../reference_mapping'
import { defaultDeployChange, deployChanges } from '../../deployment'

const log = logger(module)

export const UNDEPLOYALBE_VALIDATOR_TYPES = [
  'com.onresolve.jira.groovy.groovyrunner__script-workflow-validators',
]

export const UNDEPLOYALBE_POST_FUNCTION_TYPES = [
  'com.onresolve.jira.groovy.groovyrunner__script-postfunction',
]

// Taken from https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-workflows/#api-rest-api-3-workflow-post
const FETCHED_POST_FUNCTIONS_TYPES = [
  'FireIssueEventFunction',
  'AssignToCurrentUserFunction',
  'AssignToLeadFunction',
  'AssignToReporterFunction',
  'ClearFieldValuePostFunction',
  'CopyValueFromOtherFieldPostFunction',
  'CreateCrucibleReviewWorkflowFunction',
  'SetIssueSecurityFromRoleFunction',
  'TriggerWebhookFunction',
  'UpdateIssueCustomFieldPostFunction',
  'UpdateIssueFieldFunction',
  ...UNDEPLOYALBE_POST_FUNCTION_TYPES,
]

const FETCHED_ONLY_INITIAL_POST_FUNCTION = [
  'UpdateIssueStatusFunction',
  'CreateCommentFunction',
  'IssueStoreFunction',
  ...FETCHED_POST_FUNCTIONS_TYPES,
]


const WORKFLOW_TYPE_NAME = 'Workflow'

const transformStatus = (status: Status): void => {
  status.properties = status.properties?.additionalProperties
  // This is not deployable and we get another property
  // of "jira.issue.editable" with the same value
  delete status.properties?.issueEditable
}

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

    rules.postFunctions = rules.postFunctions?.filter(
      postFunction => (transitionType === 'initial'
        ? FETCHED_ONLY_INITIAL_POST_FUNCTION.includes(postFunction.type ?? '')
        : FETCHED_POST_FUNCTIONS_TYPES.includes(postFunction.type ?? '')),
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
}

const transformRules = (rules: Rules, transitionType?: string): void => {
  rules.conditions = rules.conditionsTree
  delete rules.conditionsTree
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

/**
 * When creating a workflow, the initial transition is always created
 * with an extra PermissionValidator with CREATE_ISSUES permission key.
 * Currently the API does not allow us to remove it but we can at least make sure to
 * not create an additional one if one validator like that is already appears in the nacl.
 */
const removeCreateIssuePermissionValidator = (instance: WorkflowInstance): void => {
  instance.value.transitions
    ?.filter(transition => transition.type === 'initial')
    .forEach(transition => {
      const createIssuePermissionValidatorIndex = _.findLastIndex(
        transition.rules?.validators ?? [],
        validator => _.isEqual(
          validator,
          {
            type: 'PermissionValidator',
            configuration: {
              permissionKey: 'CREATE_ISSUES',
            },
          },
        ),
      )

      _.pullAt(
        transition.rules?.validators ?? [],
        createIssuePermissionValidatorIndex,
      )
    })
}

const removeUnsupportedRules = (instance: WorkflowInstance): void => {
  instance.value.transitions
    ?.forEach(transition => {
      if (transition.rules?.postFunctions !== undefined) {
        transition.rules.postFunctions = transition.rules.postFunctions.filter(
          postFunction => !UNDEPLOYALBE_POST_FUNCTION_TYPES.includes(postFunction.type ?? ''),
        )
      }

      if (transition.rules?.validators !== undefined) {
        transition.rules.validators = transition.rules.validators.filter(
          validator => !UNDEPLOYALBE_VALIDATOR_TYPES.includes(validator.type ?? ''),
        )
      }
    })
}

const deployWorkflow = async (
  change: AdditionChange<InstanceElement>,
  client: JiraClient,
  config: JiraConfig,
): Promise<void> => {
  const instance = await resolveValues(getChangeData(change), getLookUpName)
  if (isWorkflowInstance(instance)) {
    removeCreateIssuePermissionValidator(instance)
    removeUnsupportedRules(instance)
  }
  await defaultDeployChange({
    change: toChange({ after: instance }),
    client,
    apiDefinitions: config.apiDefinitions,
  })
  getChangeData(change).value.entityId = instance.value.entityId
}

// This filter transforms the workflow values structure so it will fit its deployment endpoint
const filter: FilterCreator = ({ config, client }) => ({
  onFetch: async (elements: Element[]) => {
    const workflowType = findObject(elements, WORKFLOW_TYPE_NAME)
    if (workflowType !== undefined) {
      delete workflowType.fields.id
    }

    const workflowStatusType = findObject(elements, 'WorkflowStatus')
    if (workflowStatusType === undefined) {
      log.warn('WorkflowStatus type was not received in fetch')
    } else {
      workflowStatusType.fields.properties = new Field(workflowStatusType, 'properties', new MapType(BuiltinTypes.STRING))
    }

    const workflowRulesType = findObject(elements, 'WorkflowRules')

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
  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change)
        && isAdditionChange(change)
        && getChangeData(change).elemID.typeName === 'Workflow'
    )


    const deployResult = await deployChanges(
      relevantChanges
        .filter(isInstanceChange)
        .filter(isAdditionChange),
      async change => deployWorkflow(change, client, config)
    )

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filter
