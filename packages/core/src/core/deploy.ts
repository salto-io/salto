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
import _ from 'lodash'
import {
  AdapterOperations, getChangeElement, Change, isAdditionOrModificationChange, DeployResult,
} from '@salto-io/adapter-api'
import { detailedCompare, applyDetailedChanges } from '@salto-io/adapter-utils'
import { WalkError, NodeSkippedError } from '@salto-io/dag'
import { logger } from '@salto-io/logging'
import { Plan, PlanItem, PlanItemId } from './plan'

const log = logger(module)

const deployAction = (
  planItem: PlanItem,
  adapters: Record<string, AdapterOperations>
): Promise<DeployResult> => {
  const changes = [...planItem.changes()]
  const adapterName = getChangeElement(changes[0]).elemID.adapter
  const adapter = adapters[adapterName]

  if (!adapter) {
    throw new Error(`Missing adapter for ${adapterName}`)
  }
  return adapter.deploy({ groupID: planItem.groupKey, changes })
}

export class DeployError extends Error {
  constructor(readonly elementId: string | string[], message: string) {
    super(message)
  }
}

export type ItemStatus = 'started' | 'finished' | 'error' | 'cancelled'

export type StepEvents = {
  completed: () => void
  failed: (errorText?: string) => void
}

const updatePlanElement = (item: PlanItem, appliedChanges: ReadonlyArray<Change>): void => {
  const planElementById = _.keyBy(
    [...item.items.values()].map(getChangeElement),
    changeElement => changeElement.elemID.getFullName()
  )
  appliedChanges
    .filter(isAdditionOrModificationChange)
    .map(getChangeElement)
    .forEach(updatedElement => {
      const planElement = planElementById[updatedElement.elemID.getFullName()]
      if (planElement !== undefined) {
        applyDetailedChanges(planElement, detailedCompare(planElement, updatedElement))
      }
    })
}

export const deployActions = async (
  deployPlan: Plan,
  adapters: Record<string, AdapterOperations>,
  reportProgress: (item: PlanItem, status: ItemStatus, details?: string) => void,
  postDeployAction: (appliedChanges: ReadonlyArray<Change>) => Promise<void>
): Promise<DeployError[]> => {
  try {
    await deployPlan.walkAsync(async (itemId: PlanItemId): Promise<void> => {
      const item = deployPlan.getItem(itemId) as PlanItem
      reportProgress(item, 'started')
      try {
        const result = await deployAction(item, adapters)
        // Update element with changes so references to it
        // will have an updated version throughout the deploy plan
        updatePlanElement(item, result.appliedChanges)
        await postDeployAction(result.appliedChanges)
        if (result.errors.length > 0) {
          throw new Error(
            `Failed to deploy ${item.groupKey} with errors:\n${result.errors.join('\n')}`
          )
        }
        reportProgress(item, 'finished')
      } catch (error) {
        reportProgress(item, 'error', error.message ?? String(error))
        log.error('Got error deploying item %s: %o', item.groupKey, error)
        throw error
      }
    })
    return []
  } catch (error) {
    const deployErrors: DeployError[] = []
    if (error instanceof WalkError) {
      error.handlerErrors.forEach((nodeError: Error, key: PlanItemId) => {
        const item = deployPlan.getItem(key) as PlanItem
        if (nodeError instanceof NodeSkippedError) {
          reportProgress(item, 'cancelled', deployPlan.getItem(nodeError.causingNode).groupKey)
        }
        deployErrors.push(new DeployError(item.groupKey, nodeError.message))
      })
      if (error.circularDependencyError) {
        error.circularDependencyError.causingNodeIds.forEach((id: PlanItemId) => {
          const item = deployPlan.getItem(id) as PlanItem
          reportProgress(item, 'error', error.circularDependencyError.message)
          deployErrors.push(new DeployError(item.groupKey, error.circularDependencyError.message))
        })
      }
    }
    return deployErrors
  }
}
