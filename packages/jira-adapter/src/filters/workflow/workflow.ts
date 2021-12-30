/*
*                      Copyright 2021 Salto Labs Ltd.
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
/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { BuiltinTypes, Element, Field, InstanceElement, isInstanceElement, isObjectType, ListType, MapType, Value, Values } from '@salto-io/adapter-api'
import { FilterCreator } from '../../filter'
import { postFunctionType, types as postFunctionTypes } from './post_functions_types'

// Taken from https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-workflows/#api-rest-api-3-workflow-post
const SUPPORTED_POST_FUNCTIONS_TYPES = [
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
]

const SUPPORTED_ONLY_INITIAL_POST_FUNCTION = [
  'UpdateIssueStatusFunction',
  'CreateCommentFunction',
  'IssueStoreFunction',
  ...SUPPORTED_POST_FUNCTIONS_TYPES,
]

const WORKFLOW_TYPE_NAME = 'Workflow'

const transformWorkflowInstance = (instance: InstanceElement): void => {
  instance.value.entityId = instance.value.id?.entityId
  instance.value.name = instance.value.id?.name
  delete instance.value.id

  instance.value.statuses?.forEach((status: Value) => {
    status.properties = status.properties?.additionalProperties
    // This is not deployable and we get another property
    // of "jira.issue.editable" with the same value
    delete status.properties?.issueEditable
  })

  instance.value.transitions
    ?.filter((transition: Values) => transition.rules !== undefined)
    .forEach((transition: Values) => {
      transition.rules.conditions = transition.rules.conditionsTree
      delete transition.rules.conditionsTree

      transition.rules.postFunctions
        ?.filter(({ type }: Values) => type === 'FireIssueEventFunction')
        .forEach((postFunc: Values) => {
          // This is not deployable and the id property provides the same info
          delete postFunc.configuration?.event?.name
        })

        transition.rules.postFunctions
          ?.filter(({ type }: Values) => type === 'SetIssueSecurityFromRoleFunction')
          .forEach((postFunc: Values) => {
            // This is not deployable and the id property provides the same info
            delete postFunc.configuration?.projectRole?.name
          })

        transition.rules.postFunctions = transition.rules.postFunctions?.filter(
          (postFunction: Values) => (transition.type === 'initial'
            ? SUPPORTED_ONLY_INITIAL_POST_FUNCTION.includes(postFunction.type)
            : SUPPORTED_POST_FUNCTIONS_TYPES.includes(postFunction.type)),
        )
    })
}

// This filter transforms the workflow values structure so it will fit its deployment endpoint
const filter: FilterCreator = () => ({
  onFetch: async (elements: Element[]) => {
    const types = elements.filter(isObjectType)
    const workflowType = types.find(element => element.elemID.name === WORKFLOW_TYPE_NAME)
    if (workflowType !== undefined) {
      delete workflowType.fields.id
    }

    const workflowStatusType = types.find(element => element.elemID.name === 'WorkflowStatus')
    if (workflowStatusType !== undefined) {
      workflowStatusType.fields.properties = new Field(workflowStatusType, 'properties', new MapType(BuiltinTypes.STRING))
    }

    const workflowRulesType = types.find(element => element.elemID.name === 'WorkflowRules')
    if (workflowRulesType !== undefined) {
      workflowRulesType.fields.conditions = new Field(workflowRulesType, 'conditions', await workflowRulesType.fields.conditionsTree.getType())
      delete workflowRulesType.fields.conditionsTree

      workflowRulesType.fields.postFunctions = new Field(workflowRulesType, 'postFunctions', new ListType(postFunctionType))
    }

    elements.push(...postFunctionTypes)

    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === WORKFLOW_TYPE_NAME)
      .forEach(transformWorkflowInstance)
  },
})

export default filter
