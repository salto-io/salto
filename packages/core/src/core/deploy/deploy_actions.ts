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
import {
  AdapterOperations,
  Change,
  DeployOptions,
  DeployResult as AdapterDeployResult,
  getChangeData,
  isAdditionOrModificationChange,
  SaltoElementError,
  SaltoError,
  SeverityLevel,
  ChangeDataType,
  SaltoErrorType,
  ProgressReporter,
  Progress,
} from '@salto-io/adapter-api'
import { applyDetailedChanges, detailedCompare } from '@salto-io/adapter-utils'
import { NodeSkippedError, WalkError } from '@salto-io/dag'
import { logger } from '@salto-io/logging'
import wu from 'wu'
import { collections } from '@salto-io/lowerdash'
import { Plan, PlanItem, PlanItemId } from '../plan'
import { DeployError, DeployResult, GroupProperties } from '../../types'

const log = logger(module)
const { makeArray } = collections.array

type DeployOrValidateParams = {
  adapter: AdapterOperations
  adapterName: string
  opts: DeployOptions
  checkOnly: boolean
}

const addElemIDsToError = (
  changes: readonly Change<ChangeDataType>[],
  error: Error,
): ReadonlyArray<SaltoElementError> =>
  changes.map(change => ({
    message: error.message,
    severity: 'Error' as SeverityLevel,
    elemID: getChangeData(change).elemID,
  }))

const deployOrValidate = async ({
  adapter,
  adapterName,
  opts,
  checkOnly,
}: DeployOrValidateParams): Promise<AdapterDeployResult> => {
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
  adapterByAccountName: Record<string, AdapterOperations>,
  checkOnly: boolean,
  progressReporter: ProgressReporter,
): Promise<AdapterDeployResult> => {
  const changes = [...planItem.changes()]
  const accountName = planItem.account
  const adapter = adapterByAccountName[accountName]
  if (!adapter) {
    throw new Error(`Missing adapter for ${accountName}`)
  }
  const opts = { changeGroup: { groupID: planItem.groupKey, changes }, progressReporter }
  return deployOrValidate({ adapter, adapterName: accountName, opts, checkOnly })
}

export type ItemStatus = 'started' | 'finished' | 'error' | 'cancelled'

export type StepEvents<T = void> = {
  completed: (params: T) => void
  failed: (errorText?: string) => void
}

type DeployActionResult = {
  errors: DeployError[]
  appliedChanges: Change[]
  extraProperties: DeployResult['extraProperties']
}

const updatePlanElement = (item: PlanItem, appliedChanges: ReadonlyArray<Change>): void => {
  const planElementById = _.keyBy([...item.items.values()].map(getChangeData), changeData =>
    changeData.elemID.getFullName(),
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
  checkOnly: boolean,
): Promise<DeployActionResult> => {
  const appliedChanges: Change[] = []
  const groups: GroupProperties[] = []
  const accumulatedNonFatalErrors: DeployError[] = []
  try {
    await deployPlan.walkAsync(async (itemId: PlanItemId): Promise<void> => {
      const item = deployPlan.getItem(itemId) as PlanItem
      log.debug('Deploy item %s', item.groupKey)
      wu(item.detailedChanges()).forEach(detailedChange => {
        log.debug('Deploy change %s (action=%s)', detailedChange.id.getFullName(), detailedChange.action)
      })
      reportProgress(item, 'started')
      try {
        const progressReporter = {
          reportProgress: (progress: Progress) => reportProgress(item, 'started', progress.message),
        }
        const result = await deployAction(item, adapters, checkOnly, progressReporter)
        result.appliedChanges.forEach(appliedChange => appliedChanges.push(appliedChange))
        makeArray(result.extraProperties?.groups).forEach(group =>
          groups.push({
            ...group,
            accountName: item.account,
            id: item.groupKey,
          }),
        )
        // Update element with changes so references to it
        // will have an updated version throughout the deploy plan
        updatePlanElement(item, result.appliedChanges)
        await postDeployAction(result.appliedChanges)
        const [fatalErrors, nonFatalErrors] = _.partition(result.errors, error => error.severity === 'Error')
        if (nonFatalErrors.length > 0) {
          log.warn(
            'Deploy of %s encountered non-fatal issues: %s',
            item.groupKey,
            nonFatalErrors.map(err => err.message).join('\n\n'),
          )
          accumulatedNonFatalErrors.push(...nonFatalErrors.map(err => ({ ...err, groupId: item.groupKey })))
        }
        if (fatalErrors.length > 0) {
          log.warn('Failed to deploy %s, errors: %s', item.groupKey, fatalErrors.map(err => err.message).join('\n\n'))
          throw new WalkDeployError(fatalErrors)
        }
        reportProgress(item, 'finished')
      } catch (error) {
        reportProgress(item, 'error', error.message ?? String(error))
        log.error('Got error deploying item %s: %o', item.groupKey, error)
        throw error
      }
    })
    return { errors: accumulatedNonFatalErrors, appliedChanges, extraProperties: { groups } }
  } catch (error) {
    const deployErrors: DeployError[] = []
    if (error instanceof WalkError) {
      error.handlerErrors.forEach((nodeError: Error, key: PlanItemId) => {
        const item = deployPlan.getItem(key) as PlanItem
        if (nodeError instanceof NodeSkippedError) {
          reportProgress(item, 'cancelled', deployPlan.getItem(nodeError.causingNode).groupKey)
          deployErrors.push(
            ...[...item.changes()].map(change => ({
              elemID: getChangeData(change).elemID,
              groupId: item.groupKey,
              message: `Element was not deployed, as it depends on ${nodeError.causingNode} which failed to deploy`,
              severity: 'Error' as SeverityLevel,
              type: 'dependency' as SaltoErrorType,
            })),
          )
        } else if (nodeError instanceof WalkDeployError) {
          deployErrors.push(...nodeError.errors.map(deployError => ({ ...deployError, groupId: item.groupKey })))
        } else {
          deployErrors.push({ groupId: item.groupKey, message: nodeError.message, severity: 'Error' as SeverityLevel })
        }
      })
      if (error.circularDependencyError) {
        error.circularDependencyError.causingNodeIds.forEach((id: PlanItemId) => {
          const item = deployPlan.getItem(id) as PlanItem
          reportProgress(item, 'error', error.circularDependencyError.message)
          deployErrors.push({
            groupId: item.groupKey,
            message: error.circularDependencyError.message,
            severity: 'Error' as SeverityLevel,
          })
        })
      }
    }
    return { errors: deployErrors.concat(accumulatedNonFatalErrors), appliedChanges, extraProperties: { groups } }
  }
}
