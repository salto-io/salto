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

import { resolveValues, restoreValues } from '@salto-io/adapter-utils'
import { isAdditionOrModificationChange, getChangeData, InstanceElement, isInstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { references as referenceUtils } from '@salto-io/adapter-components'
import { FilterCreator } from '../../../filter'
import { WORKFLOW_TYPE_NAME } from '../../../constants'
import { getLookUpName } from '../../../reference_mapping'
import { WorkflowInstance, isWorkflowInstance } from '../../workflow/types'
import { transitionKeysToExpectedIds, walkOverTransitionIds } from '../../workflow/transition_structure'


const { awu } = collections.asynciterable

const getTransitionIdToKeyMap = (workflowInstance: WorkflowInstance): Map<string, string> =>
  new Map(Object.entries(workflowInstance.value.transitions)
    .map(([key, transition]) => [transition.id, key])
    .filter((entry): entry is [string, string] => entry[0] !== undefined))

const addTransitionReferences = (workflowInstance: WorkflowInstance, enableMissingReferences: boolean): void => {
  const transitionIdToKey = getTransitionIdToKeyMap(workflowInstance)
  Object.values(workflowInstance.value.transitions).forEach(transition => {
    walkOverTransitionIds(transition, scriptRunner => {
      const transitionKey = transitionIdToKey.get(scriptRunner.transitionId)
      const missingValue = enableMissingReferences
        ? referenceUtils.createMissingValueReference(workflowInstance.elemID.createNestedID('transitions'), scriptRunner.transitionId)
        : scriptRunner.transitionId
      scriptRunner.transitionId = transitionKey === undefined
        ? missingValue
        : new ReferenceExpression(
          workflowInstance.elemID.createNestedID('transitions', transitionKey),
          workflowInstance.value.transitions[transitionKey],
        )
    })
  })
}


// This filter is used to remove and return references in script runner workflows
// As the references are encoded we cannot wait for the references filter to resolve them
const filter: FilterCreator = ({ config, client }) => {
  const originalInstances: Record<string, InstanceElement> = {}
  return {
    name: 'scriptRunnerWorkflowReferencesFilter',
    onFetch: async elements => {
      if (!config.fetch.enableScriptRunnerAddon || client.isDataCenter) {
        return
      }

      elements
        .filter(isInstanceElement)
        .filter(isWorkflowInstance)
        .forEach(workflowInstance => addTransitionReferences(
          workflowInstance,
          config.fetch.enableMissingReferences ?? true
        ))
    },
    preDeploy: async changes => {
      if (!config.fetch.enableScriptRunnerAddon) {
        return
      }
      const workflows = changes
        .filter(isAdditionOrModificationChange)
        .map(getChangeData)
        .filter(isInstanceElement)
        .filter(isWorkflowInstance)

      workflows
        .forEach(workflow => {
          const expectedIdsMap = transitionKeysToExpectedIds(workflow)
          Object.values(workflow.value.transitions).forEach(transition => {
            walkOverTransitionIds(transition, scriptRunner => {
              scriptRunner.transitionId = (scriptRunner.transitionId instanceof ReferenceExpression)
                ? expectedIdsMap.get(scriptRunner.transitionId.elemID.name) ?? scriptRunner.transitionId
                : scriptRunner.transitionId
            })
          })
        })

      await awu(workflows)
        .forEach(async instance => {
          originalInstances[instance.elemID.getFullName()] = instance.clone()
          instance.value.transitions = (
            await resolveValues(instance, getLookUpName)
          ).value.transitions
        })
    },
    onDeploy: async changes => {
      if (!config.fetch.enableScriptRunnerAddon) {
        return
      }
      const workflows = changes
        .filter(isAdditionOrModificationChange)
        .map(getChangeData)
        .filter(isInstanceElement)
        .filter(isWorkflowInstance)

      workflows.forEach(workflow => addTransitionReferences(workflow, config.fetch.enableMissingReferences ?? true))

      await awu(workflows)
        .filter(instance => instance.elemID.typeName === WORKFLOW_TYPE_NAME)
        .forEach(async instance => {
          instance.value.transitions = (await restoreValues(
            originalInstances[instance.elemID.getFullName()],
            instance,
            getLookUpName,
          )).value.transitions
        })
    },
  }
}

export default filter
