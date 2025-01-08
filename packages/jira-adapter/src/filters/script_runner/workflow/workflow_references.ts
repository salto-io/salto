/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { isResolvedReferenceExpression, resolvePath } from '@salto-io/adapter-utils'
import {
  isAdditionOrModificationChange,
  getChangeData,
  InstanceElement,
  isInstanceElement,
  Value,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { resolveValues, restoreValues } from '@salto-io/adapter-components'
import { FilterCreator } from '../../../filter'
import { WORKFLOW_CONFIGURATION_TYPE, WORKFLOW_TYPE_NAME } from '../../../constants'
import { getLookUpName } from '../../../reference_mapping'
import { WorkflowV1Instance, isWorkflowV1Instance } from '../../workflow/types'
import {
  transitionKeysToExpectedIds,
  walkOverTransitionIds,
  walkOverTransitionIdsV2,
} from '../../workflow/transition_structure'
import { WorkflowV2Instance, isWorkflowInstance, isWorkflowV2Instance } from '../../workflowV2/types'
import { getTransitionIdToKeyMap, createTransitionReference } from '../../../common/workflow/transitions'

const { awu } = collections.asynciterable

const WALK_OVER_TRANSITION_IDS_FUNCS: Record<string, (transition: Value, func: (scriptRunner: Value) => void) => void> =
  {
    [WORKFLOW_TYPE_NAME]: walkOverTransitionIds,
    [WORKFLOW_CONFIGURATION_TYPE]: walkOverTransitionIdsV2,
  }

const addTransitionReferences = (
  workflowInstance: WorkflowV1Instance | WorkflowV2Instance,
  enableMissingReferences: boolean,
): void => {
  const transitionIdToKey = getTransitionIdToKeyMap(workflowInstance)
  Object.values(workflowInstance.value.transitions).forEach(transition => {
    WALK_OVER_TRANSITION_IDS_FUNCS[workflowInstance.elemID.typeName](transition, scriptRunner => {
      scriptRunner.transitionId = createTransitionReference({
        workflowInstance,
        transitionId: scriptRunner.transitionId,
        enableMissingReferences,
        transitionKey: transitionIdToKey.get(scriptRunner.transitionId),
      })
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
        .forEach(instance => {
          addTransitionReferences(instance, config.fetch.enableMissingReferences ?? true)
        })
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

      workflows.filter(isWorkflowV1Instance).forEach(workflow => {
        const expectedIdsMap = transitionKeysToExpectedIds(workflow)
        Object.values(workflow.value.transitions).forEach(transition => {
          walkOverTransitionIds(transition, scriptRunner => {
            scriptRunner.transitionId =
              isReferenceExpression(scriptRunner.transitionId) &&
              expectedIdsMap.get(scriptRunner.transitionId.elemID.name) !== undefined
                ? expectedIdsMap.get(scriptRunner.transitionId.elemID.name)
                : scriptRunner.transitionId
          })
        })
      })
      workflows.filter(isWorkflowV2Instance).forEach(workflow => {
        Object.values(workflow.value.transitions).forEach(transition => {
          walkOverTransitionIdsV2(transition, scriptRunner => {
            const { transitionId } = scriptRunner
            scriptRunner.transitionId = isResolvedReferenceExpression(transitionId)
              ? // because the reference value has been changed in transition_ids filter
                resolvePath(workflow, transitionId.elemID.createNestedID('id'))
              : scriptRunner.transitionId
          })
        })
      })

      await awu(workflows).forEach(async instance => {
        originalInstances[instance.elemID.getFullName()] = instance.clone()
        instance.value.transitions = (await resolveValues(instance, getLookUpName)).value.transitions
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

      workflows.forEach(workflow => {
        addTransitionReferences(workflow, config.fetch.enableMissingReferences ?? true)
      })

      await awu(workflows)
        .filter(
          instance =>
            instance.elemID.typeName === WORKFLOW_TYPE_NAME || instance.elemID.typeName === WORKFLOW_CONFIGURATION_TYPE,
        )
        .forEach(async instance => {
          instance.value.transitions = (
            await restoreValues(originalInstances[instance.elemID.getFullName()], instance, getLookUpName)
          ).value.transitions
        })
    },
  }
}

export default filter
