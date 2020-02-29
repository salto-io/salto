/*
*                      Copyright 2020 Salto Labs Ltd.
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
import wu from 'wu'
import {
  ActionName,
  Adapter,
  DataModificationResult,
  Element,
  ElemID,
  ElemIdGetter,
  InstanceElement,
  ObjectType,
  AdapterCreatorConfig,
} from '@salto-io/adapter-api'
import { EventEmitter } from 'pietile-eventemitter'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { promises } from '@salto-io/lowerdash'
import { deployActions, DeployError, ItemStatus } from './core/deploy'
import { deleteInstancesOfType, getInstancesOfType, importInstancesOfType } from './core/records'
import {
  adapterCreators, getAdaptersConfigType, initAdapters, getAdapterChangeValidators,
  getAdapterDependencyChangers,
} from './core/adapters'
import { addServiceToConfig, loadConfig, currentEnvConfig } from './workspace/config'
import { getPlan, Plan, PlanItem } from './core/plan'
import { findElement, SearchResult } from './core/search'
import {
  createElemIdGetter,
  FatalFetchMergeError,
  FetchChange,
  fetchChanges,
  FetchProgressEvents,
  getDetailedChanges,
  MergeErrorWithElements,
  toChangesWithPath,
} from './core/fetch'
import { Workspace } from './workspace/workspace'
import { AdapterCredentials, AdapterConfig } from './workspace/adapter_config'
import { defaultDependencyChangers } from './core/plan/plan'

const log = logger(module)

export const updateLoginConfig = async (
  workspace: Workspace,
  newConfig: Readonly<InstanceElement>
): Promise<void> => {
  const adapterCreator = adapterCreators[newConfig.elemID.adapter]
  if (adapterCreator) {
    await adapterCreator.validateConfig(newConfig)
  } else {
    throw new Error(`unknown adapter: ${newConfig.elemID.adapter}`)
  }
  await workspace.adapterCredentials.set(newConfig.elemID.adapter, newConfig)
  log.debug(`persisted new configs for adapter: ${newConfig.elemID.adapter}`)
}

const filterElementsByServices = (
  elements: Element[] | readonly Element[],
  services: string[]
): Element[] => elements.filter(e => services.includes(e.elemID.adapter))

export const preview = async (
  workspace: Workspace,
  services: string[] = currentEnvConfig(workspace.config).services
): Promise<Plan> => getPlan(
  filterElementsByServices(await workspace.state.getAll(), services),
  filterElementsByServices(await workspace.elements, services),
  getAdapterChangeValidators(),
  defaultDependencyChangers.concat(getAdapterDependencyChangers()),
)

const getAdapters = async (
  adapters: string[],
  credentials: AdapterCredentials,
  config: AdapterConfig,
  elemIdGetter?: ElemIdGetter,
): Promise<Record<string, Adapter>> => {
  const creatorConfig: Record<string, AdapterCreatorConfig> = _
    .fromPairs(await Promise.all(adapters.map(
      async adapter => ([adapter, {
        credentials: await credentials.get(adapter),
        config: await config.get(adapter),
      }])
    )))
  return initAdapters(creatorConfig, elemIdGetter)
}

export interface DeployResult {
  success: boolean
  errors: DeployError[]
  changes?: Iterable<FetchChange>
}

export const deploy = async (
  workspace: Workspace,
  shouldDeploy: (plan: Plan) => Promise<boolean>,
  reportProgress: (item: PlanItem, status: ItemStatus, details?: string) => void,
  services: string[] = currentEnvConfig(workspace.config).services,
  force = false
): Promise<DeployResult> => {
  const changedElements: Element[] = []
  const actionPlan = await preview(workspace, services)
  if (force || await shouldDeploy(actionPlan)) {
    const adapters = await getAdapters(
      services, workspace.adapterCredentials, workspace.adapterConfig,
    )

    const postDeploy = async (action: ActionName, element: Element): Promise<void> =>
      ((action === 'remove')
        ? workspace.state.remove(element.elemID)
        : workspace.state.set(element)
          .then(() => { changedElements.push(element) }))
    const errors = await deployActions(actionPlan, adapters, reportProgress, postDeploy)

    const changedElementMap = _.groupBy(changedElements, e => e.elemID.getFullName())
    // Clone the elements because getDetailedChanges can change its input
    const clonedElements = changedElements.map(e => e.clone())
    const relevantWorkspaceElements = (await workspace.elements)
      .filter(e => changedElementMap[e.elemID.getFullName()] !== undefined)

    const changes = wu(await getDetailedChanges(relevantWorkspaceElements, clonedElements))
      .map(change => ({ change, serviceChange: change }))
      .map(toChangesWithPath(name => changedElementMap[name] || []))
      .flatten()
    const errored = errors.length > 0
    return {
      success: !errored,
      changes,
      errors: errored ? errors : [],
    }
  }
  return { success: true, errors: [] }
}

export type fillConfigFunc = (configType: ObjectType) => Promise<InstanceElement>

export type FetchResult = {
  changes: Iterable<FetchChange>
  mergeErrors: MergeErrorWithElements[]
  success: boolean
}
export type fetchFunc = (
  workspace: Workspace,
  services: string[],
  progressEmitter?: EventEmitter<FetchProgressEvents>,
) => Promise<FetchResult>

export const fetch: fetchFunc = async (
  workspace,
  services = currentEnvConfig(workspace.config).services,
  progressEmitter?
) => {
  const overrideState = async (elements: Element[]): Promise<void> => {
    await workspace.state.remove(await workspace.state.list())
    await workspace.state.set(elements)
    log.debug(`finish to override state with ${elements.length} elements`)
  }
  log.debug('fetch starting..')
  const filteredStateElements = filterElementsByServices(await workspace.state.getAll(),
    services)

  const adapters = await getAdapters(
    services,
    workspace.adapterCredentials,
    workspace.adapterConfig,
    createElemIdGetter(filteredStateElements)
  )

  if (progressEmitter) {
    progressEmitter.emit('adaptersDidInitialize')
  }
  try {
    const { changes, elements, mergeErrors } = await fetchChanges(
      adapters,
      filterElementsByServices(await workspace.elements, services),
      filteredStateElements,
      progressEmitter,
    )
    log.debug(`${elements.length} elements were fetched [mergedErrors=${mergeErrors.length}]`)
    await overrideState(elements)
    return {
      changes,
      mergeErrors,
      success: true,
    }
  } catch (error) {
    if (error instanceof FatalFetchMergeError) {
      return {
        changes: [],
        mergeErrors: error.causes,
        success: false,
      }
    }
    throw error
  }
}

export const describeElement = async (
  workspace: Workspace,
  searchWords: string[],
): Promise<SearchResult> =>
  findElement(searchWords, await workspace.elements)

const getTypeFromState = async (ws: Workspace, typeId: string): Promise<Element> => {
  const type = await ws.state.get(ElemID.fromFullName(typeId))
  if (!type) {
    throw new Error(`Couldn't find the type you are looking for: ${typeId}. Have you run salto fetch yet?`)
  }
  return type as Element
}

const getTypeForDataMigration = async (workspace: Workspace, typeId: string): Promise<Element> => {
  const type = await getTypeFromState(workspace, typeId)
  const typeAdapter = type.elemID.adapter
  if (!currentEnvConfig(workspace.config).services?.includes(typeAdapter)) {
    throw new Error(`The type is from a service (${typeAdapter}) that is not set up for this workspace`)
  }
  return type
}

export const exportToCsv = async (
  typeId: string,
  outPath: string,
  workspace: Workspace,
): Promise<DataModificationResult> => {
  const type = await getTypeForDataMigration(workspace, typeId)
  const adapters = await getAdapters(
    [type.elemID.adapter], workspace.adapterCredentials, workspace.adapterConfig,
  )
  return getInstancesOfType(type as ObjectType, adapters, outPath)
}

export const importFromCsvFile = async (
  typeId: string,
  inputPath: string,
  workspace: Workspace,
): Promise<DataModificationResult> => {
  const type = await getTypeForDataMigration(workspace, typeId)
  const adapters = await getAdapters(
    [type.elemID.adapter], workspace.adapterCredentials, workspace.adapterConfig,
  )
  return importInstancesOfType(type as ObjectType, inputPath, adapters)
}

export const deleteFromCsvFile = async (
  typeId: string,
  inputPath: string,
  workspace: Workspace,
): Promise<DataModificationResult> => {
  const type = await getTypeForDataMigration(workspace, typeId)
  const adapters = await getAdapters(
    [type.elemID.adapter], workspace.adapterCredentials, workspace.adapterConfig,
  )
  return deleteInstancesOfType(type as ObjectType, inputPath, adapters)
}

export const init = async (defaultEnvName: string, workspaceName?: string): Promise<Workspace> => (
  Workspace.init('.', defaultEnvName, workspaceName)
)

export const addAdapter = async (
  workspaceDir: string,
  adapterName: string
): Promise<ObjectType> => {
  const adapterConfig = getAdaptersConfigType([adapterName])[adapterName]
  if (!adapterConfig) {
    throw new Error('No adapter available for this service')
  }
  await addServiceToConfig(await loadConfig(workspaceDir), adapterName)
  return adapterConfig
}

export type LoginStatus = { configType: ObjectType; isLoggedIn: boolean }
export const getLoginStatuses = async (
  workspace: Workspace,
  adapterNames = currentEnvConfig(workspace.config).services,
): Promise<Record<string, LoginStatus>> => {
  const logins = _.mapValues(getAdaptersConfigType(adapterNames),
    async (config, adapter) =>
      ({
        configType: config,
        isLoggedIn: !!await workspace.adapterCredentials.get(adapter),
      }))

  return promises.object.resolveValues(logins)
}
