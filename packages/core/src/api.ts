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
  Element,
  InstanceElement,
  ObjectType,
} from '@salto-io/adapter-api'
import { EventEmitter } from 'pietile-eventemitter'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { promises } from '@salto-io/lowerdash'
import { deployActions, DeployError, ItemStatus } from './core/deploy'
import {
  adapterCreators, getAdaptersCredentialsTypes, getAdapters, getAdapterChangeValidators,
  getAdapterDependencyChangers, getDefaultAdapterConfig, initAdapters, getAdaptersCreatorConfigs,
} from './core/adapters'
import { getPlan, Plan, PlanItem } from './core/plan'
import {
  findElement,
  SearchResult,
} from './core/search'
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
import { defaultDependencyChangers } from './core/plan/plan'
import {
  addHiddenValues, removeHiddenValues,
} from './workspace/hidden_values'

const log = logger(module)

export const verifyCredentials = async (
  loginConfig: Readonly<InstanceElement>
): Promise<void> => {
  const adapterCreator = adapterCreators[loginConfig.elemID.adapter]
  if (adapterCreator) {
    await adapterCreator.validateConfig(loginConfig)
  } else {
    throw new Error(`unknown adapter: ${loginConfig.elemID.adapter}`)
  }
}

export const updateLoginConfig = async (
  workspace: Workspace,
  newConfig: Readonly<InstanceElement>
): Promise<void> => {
  verifyCredentials(newConfig)
  await workspace.updateServiceCredentials(newConfig.elemID.adapter, newConfig)
  log.debug(`persisted new configs for adapter: ${newConfig.elemID.adapter}`)
}

const filterElementsByServices = (
  elements: Element[] | readonly Element[],
  services: ReadonlyArray<string>
): Element[] => elements.filter(e => services.includes(e.elemID.adapter))

export const preview = async (
  workspace: Workspace,
  services = workspace.services(),
): Promise<Plan> => {
  const stateElements = await workspace.state().getAll()
  return getPlan(
    filterElementsByServices(stateElements, services),
    addHiddenValues(
      filterElementsByServices(await workspace.elements(), services),
      stateElements
    ),
    getAdapterChangeValidators(),
    defaultDependencyChangers.concat(getAdapterDependencyChangers()),
  )
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
  services = workspace.services(),
  force = false
): Promise<DeployResult> => {
  const changedElements: Element[] = []
  const actionPlan = await preview(workspace, services)
  if (force || await shouldDeploy(actionPlan)) {
    const adapters = await getAdapters(
      services,
      await workspace.servicesCredentials(services),
      await workspace.servicesConfig(services),
    )

    const postDeploy = async (action: ActionName, element: Element): Promise<void> =>
      ((action === 'remove')
        ? workspace.state().remove(element.elemID)
        : workspace.state().set(element)
          .then(() => { changedElements.push(removeHiddenValues(element)) }))
    const errors = await deployActions(actionPlan, adapters, reportProgress, postDeploy)

    const changedElementMap = _.groupBy(changedElements, e => e.elemID.getFullName())
    // Clone the elements because getDetailedChanges can change its input
    const clonedElements = changedElements.map(e => e.clone())
    const relevantWorkspaceElements = (await workspace.elements())
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
  configChanges?: Plan
  adapterNameToConfigMessage?: Record<string, string>
}
export type fetchFunc = (
  workspace: Workspace,
  progressEmitter?: EventEmitter<FetchProgressEvents>,
  services?: string[],
) => Promise<FetchResult>

export const fetch: fetchFunc = async (
  workspace,
  progressEmitter?,
  services?,
) => {
  log.debug('fetch starting..')
  const fetchServices = services ?? workspace.services()
  const filteredStateElements = filterElementsByServices(await workspace.state().getAll(),
    fetchServices)

  const adaptersCreatorConfigs = await getAdaptersCreatorConfigs(
    fetchServices,
    await workspace.servicesCredentials(services),
    await workspace.servicesConfig(services),
    createElemIdGetter(filteredStateElements)
  )
  const currentConfigs = Object.values(adaptersCreatorConfigs)
    .map(creatorConfig => creatorConfig.config)
    .filter(config => !_.isUndefined(config)) as InstanceElement[]
  const adapters = initAdapters(adaptersCreatorConfigs)

  if (progressEmitter) {
    progressEmitter.emit('adaptersDidInitialize')
  }
  try {
    const {
      changes, elements, mergeErrors, configChanges, adapterNameToConfigMessage,
    } = await fetchChanges(
      adapters,
      filterElementsByServices(await workspace.elements(), fetchServices),
      filteredStateElements,
      currentConfigs,
      progressEmitter,
    )
    log.debug(`${elements.length} elements were fetched [mergedErrors=${mergeErrors.length}]`)
    await workspace.state().override(elements)
    log.debug(`finish to override state with ${elements.length} elements`)
    return {
      changes,
      mergeErrors,
      success: true,
      configChanges,
      adapterNameToConfigMessage,
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
  findElement(searchWords, await workspace.elements())

export const addAdapter = async (
  workspace: Workspace,
  adapterName: string,
): Promise<ObjectType> => {
  const adapterCredentials = getAdaptersCredentialsTypes([adapterName])[adapterName]
  if (!adapterCredentials) {
    throw new Error('No adapter available for this service')
  }
  await workspace.addService(adapterName)
  const defaultConfig = getDefaultAdapterConfig(adapterName)
  if (!_.isUndefined(defaultConfig)) {
    await workspace.updateServiceConfig(adapterName, defaultConfig)
  }
  return adapterCredentials
}

export type LoginStatus = { configType: ObjectType; isLoggedIn: boolean }
export const getLoginStatuses = async (
  workspace: Workspace,
  adapterNames = workspace.services(),
): Promise<Record<string, LoginStatus>> => {
  const creds = await workspace.servicesCredentials(adapterNames)
  const logins = _.mapValues(getAdaptersCredentialsTypes(adapterNames),
    async (config, adapter) =>
      ({
        configType: config,
        isLoggedIn: !!creds[adapter],
      }))

  return promises.object.resolveValues(logins)
}
