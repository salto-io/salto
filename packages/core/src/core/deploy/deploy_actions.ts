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
import {
  AdapterOperations, getChangeData, Change,
  isAdditionOrModificationChange,
  DeployExtraProperties, DeployOptions, Group,
  SaltoElementError, SaltoError, SeverityLevel, DeployResult, ChangeDataType, SaltoErrorType,
} from '@salto-io/adapter-api'
import { detailedCompare, applyDetailedChanges } from '@salto-io/adapter-utils'
import { WalkError, NodeSkippedError } from '@salto-io/dag'
import { logger } from '@salto-io/logging'
import wu from 'wu'
import { Plan, PlanItem, PlanItemId } from '../plan'

const log = logger(module)

type DeployOrValidateParams = {
  adapter: AdapterOperations
  adapterName: string
  opts: DeployOptions
  checkOnly: boolean
}

const addElemIDsToError = (
  changes: readonly Change<ChangeDataType>[], error: Error
): ReadonlyArray<SaltoElementError> =>
  (changes.map(change => (
    { message: error.message,
      severity: 'Error' as SeverityLevel,
      elemID: getChangeData(change).elemID }
  ))
  )

const deployOrValidate = async (
  { adapter, adapterName, opts, checkOnly }: DeployOrValidateParams
): Promise<DeployResult> => {
  const deployOrValidateFn = checkOnly ? adapter.validate?.bind(adapter) : adapter.deploy.bind(adapter)
  if (deployOrValidateFn === undefined) {
    throw new Error(`${checkOnly ? 'Check-Only deployment' : 'Deployment'} is not supported in adapter ${adapterName}`)
  }
  try {
    return await deployOrValidateFn(opts)
  } catch (error) {
    log.warn('adapter threw exception during deploy or validate, attaching to all elements in group: %o', error)
    return {
      appliedChanges: [],
      errors: addElemIDsToError(opts.changeGroup.changes, error as Error),
    }
  }
}

const deployAction = async (
  planItem: PlanItem,
  adapters: Record<string, AdapterOperations>,
  checkOnly: boolean
): Promise<DeployResult> => {
  const changes = [...planItem.changes()]
  const adapterName = getChangeData(changes[0]).elemID.adapter
  const adapter = adapters[adapterName]
  if (!adapter) {
    throw new Error(`Missing adapter for ${adapterName}`)
  }
  const opts = { changeGroup: { groupID: planItem.groupKey, changes } }
  return deployOrValidate({ adapter, adapterName, opts, checkOnly })
}

export type DeployError = (SaltoError | SaltoElementError) & {
  groupId: string | string[]
}

export type ItemStatus = 'started' | 'finished' | 'error' | 'cancelled'

export type StepEvents<T = void> = {
  completed: (params: T) => void
  failed: (errorText?: string) => void
}

type DeployActionResult = {
  errors: DeployError[]
  appliedChanges: Change[]
  extraProperties: Required<DeployExtraProperties>
}

const updatePlanElement = (item: PlanItem, appliedChanges: ReadonlyArray<Change>): void => {
  const planElementById = _.keyBy(
    [...item.items.values()].map(getChangeData),
    changeData => changeData.elemID.getFullName()
  )
  appliedChanges
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .forEach(updatedElement => {
      const planElement = planElementById[updatedElement.elemID.getFullName()]
      if (planElement !== undefined) {
        applyDetailedChanges(planElement, detailedCompare(planElement, updatedElement))
      }
    })
}

class WalkDeployError extends Error {
  constructor(public errors: ReadonlyArray<SaltoElementError | SaltoError>) {
    super()
  }
}

export const deployActions = async (
  deployPlan: Plan,
  adapters: Record<string, AdapterOperations>,
  reportProgress: (item: PlanItem, status: ItemStatus, details?: string) => void,
  postDeployAction: (appliedChanges: ReadonlyArray<Change>) => Promise<void>,
  checkOnly: boolean
): Promise<DeployActionResult> => {
  const appliedChanges: Change[] = []
  const groups: Group[] = []
  try {
    await deployPlan.walkAsync(async (itemId: PlanItemId): Promise<void> => {
      const item = deployPlan.getItem(itemId) as PlanItem
      log.debug('Deploy item %s', item.groupKey)
      wu(item.detailedChanges()).forEach(detailedChange => {
        log.debug('Deploy change %s (action=%s)', detailedChange.id.getFullName(), detailedChange.action)
      })
      reportProgress(item, 'started')
      try {
        const result = await deployAction(item, adapters, checkOnly)
        result.appliedChanges.forEach(appliedChange => appliedChanges.push(appliedChange))
        if (result.extraProperties?.groups !== undefined) {
          groups.push(...result.extraProperties.groups)
        }
        // Update element with changes so references to it
        // will have an updated version throughout the deploy plan
        updatePlanElement(item, result.appliedChanges)
        await postDeployAction(result.appliedChanges)
        if (result.errors.length > 0) {
          log.warn(
            'Failed to deploy %s, errors: %s',
            item.groupKey,
            result.errors.map(err => err.message).join('\n\n'),
          )
          throw new WalkDeployError(result.errors)
        }
        reportProgress(item, 'finished')
      } catch (error) {
        reportProgress(item, 'error', (error as Error).message ?? String(error))
        log.error('Got error deploying item %s: %o', item.groupKey, error)
        throw error
      }
    })
    return { errors: [], appliedChanges, extraProperties: { groups } }
  } catch (error) {
    const deployErrors: DeployError[] = []
    if (error instanceof WalkError) {
      error.handlerErrors.forEach((nodeError: Error, key: PlanItemId) => {
        const item = deployPlan.getItem(key) as PlanItem
        if (nodeError instanceof NodeSkippedError) {
          reportProgress(item, 'cancelled', deployPlan.getItem(nodeError.causingNode).groupKey)
          deployErrors.push(...[...item.changes()].map(change =>
            ({
              elemID: getChangeData(change).elemID,
              groupId: item.groupKey,
              message: `Element was not deployed, as it depends on ${nodeError.causingNode} which failed to deploy`,
              severity: 'Error' as SeverityLevel,
              type: 'dependency' as SaltoErrorType,
            })))
        } else if (nodeError instanceof WalkDeployError) {
          deployErrors.push(...nodeError.errors.map(deployError => ({ ...deployError, groupId: item.groupKey })))
        } else {
          deployErrors.push({ groupId: item.groupKey, message: nodeError.message, severity: 'Error' as SeverityLevel })
        }
      })
      if (error.circularDependencyError) {
        const errMsg = error.circularDependencyError.message
        error.circularDependencyError.causingNodeIds.forEach((id: PlanItemId) => {
          const item = deployPlan.getItem(id) as PlanItem
          reportProgress(item, 'error', errMsg)
          deployErrors.push({ groupId: item.groupKey, message: errMsg, severity: 'Error' as SeverityLevel })
        })
      }
    }
    return { errors: deployErrors, appliedChanges, extraProperties: { groups } }
  }
}
