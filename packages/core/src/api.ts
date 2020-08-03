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
  Element,
  InstanceElement,
  ObjectType,
  ElemID,
  AccountId,
  getChangeElement,
  isField,
  Change,
  ChangeDataType,
  isFieldChange,
  AdapterInstallResult,
} from '@salto-io/adapter-api'
import { EventEmitter } from 'pietile-eventemitter'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { promises, collections } from '@salto-io/lowerdash'
import { Workspace } from '@salto-io/workspace'
import { EOL } from 'os'
import { deployActions, DeployError, ItemStatus } from './core/deploy'
import {
  adapterCreators, getAdaptersCredentialsTypes, getAdapters, getAdapterChangeValidators,
  getAdapterDependencyChangers, getDefaultAdapterConfig, initAdapters, getAdaptersCreatorConfigs,
} from './core/adapters'
import { getPlan, Plan, PlanItem } from './core/plan'
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
import { defaultDependencyChangers } from './core/plan/plan'
import { createRestoreChanges } from './core/restore'
import { getAdapterChangeGroupIdFunctions } from './core/adapters/custom_group_key'
import { createDiffChanges } from './core/diff'

const log = logger(module)

export const verifyCredentials = async (
  loginConfig: Readonly<InstanceElement>
): Promise<AccountId> => {
  const adapterCreator = adapterCreators[loginConfig.elemID.adapter]
  if (adapterCreator) {
    return adapterCreator.validateCredentials(loginConfig)
  }
  throw new Error(`unknown adapter: ${loginConfig.elemID.adapter}`)
}

export const updateCredentials = async (
  workspace: Workspace,
  newConfig: Readonly<InstanceElement>
): Promise<void> => {
  await verifyCredentials(newConfig)
  await workspace.updateServiceCredentials(newConfig.elemID.adapter, newConfig)
  log.debug(`persisted new configs for adapter: ${newConfig.elemID.adapter}`)
}

const filterElementsByServices = (
  elements: Element[] | readonly Element[],
  services: ReadonlyArray<string>
): Element[] => elements.filter(e => services.includes(e.elemID.adapter)
  // Variables belong to all of the services
  || e.elemID.adapter === ElemID.VARIABLES_NAMESPACE)

export const preview = async (
  workspace: Workspace,
  services = workspace.services(),
): Promise<Plan> => {
  const stateElements = await workspace.state().getAll()
  return getPlan({
    before: filterElementsByServices(stateElements, services),
    after: filterElementsByServices(await workspace.elements(), services),
    changeValidators: getAdapterChangeValidators(),
    dependencyChangers: defaultDependencyChangers.concat(getAdapterDependencyChangers()),
    customGroupIdFunctions: getAdapterChangeGroupIdFunctions(),
  })
}

export interface DeployResult {
  success: boolean
  errors: DeployError[]
  changes?: Iterable<FetchChange>
}

export const deploy = async (
  workspace: Workspace,
  actionPlan: Plan,
  reportProgress: (item: PlanItem, status: ItemStatus, details?: string) => void,
  services = workspace.services(),
): Promise<DeployResult> => {
  const changedElements = new Map<string, Element>()
  const adapters = await getAdapters(
    services,
    await workspace.servicesCredentials(services),
    await workspace.servicesConfig(services),
  )

  const getUpdatedElement = async (change: Change): Promise<ChangeDataType> => {
    const changeElem = getChangeElement(change)
    if (!isField(changeElem)) {
      return changeElem
    }
    const topLevelElem = await workspace.state().get(changeElem.parent.elemID) as ObjectType
    return new ObjectType({
      ...topLevelElem,
      fields: change.action === 'remove'
        ? _.omit(topLevelElem.fields, changeElem.name)
        : _.merge({}, topLevelElem.fields, { [changeElem.name]: changeElem }),
    })
  }

  const postDeployAction = async (appliedChanges: ReadonlyArray<Change>): Promise<void> => {
    await promises.array.series(appliedChanges.map(change => async () => {
      const updatedElement = await getUpdatedElement(change)
      const stateUpdate = (change.action === 'remove' && !isFieldChange(change))
        ? workspace.state().remove(updatedElement.elemID)
        : workspace.state().set(updatedElement)
      await stateUpdate
      changedElements.set(updatedElement.elemID.getFullName(), updatedElement)
    }))
  }
  const errors = await deployActions(actionPlan, adapters, reportProgress, postDeployAction)

  // Clone the elements because getDetailedChanges can change its input
  const clonedElements = wu(changedElements.values()).map(e => e.clone())
    .toArray()

  const workspaceElements = await workspace.elements()
  const relevantWorkspaceElements = workspaceElements
    .filter(e => changedElements.has(e.elemID.getFullName()))

  // Add workspace elements as an additional context for resolve so that we can resolve
  // variable expressions. Adding only variables is not enough for the case of a variable
  // with the value of a reference.
  const changes = wu(await getDetailedChanges(
    relevantWorkspaceElements,
    clonedElements,
    workspaceElements
  )).map(change => ({ change, serviceChange: change }))
    .map(toChangesWithPath(name => collections.array.makeArray(changedElements.get(name))))
    .flatten()
  const errored = errors.length > 0
  return {
    success: !errored,
    changes,
    errors: errored ? errors : [],
  }
}

export type FillConfigFunc = (configType: ObjectType) => Promise<InstanceElement>

export type FetchResult = {
  changes: Iterable<FetchChange>
  mergeErrors: MergeErrorWithElements[]
  success: boolean
  configChanges?: Plan
  adapterNameToConfigMessage?: Record<string, string>
}
export type FetchFunc = (
  workspace: Workspace,
  progressEmitter?: EventEmitter<FetchProgressEvents>,
  services?: string[],
) => Promise<FetchResult>

export const fetch: FetchFunc = async (
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
      changes, elements, mergeErrors, configChanges, adapterNameToConfigMessage, unmergedElements,
    } = await fetchChanges(
      adapters,
      filterElementsByServices(await workspace.elements(), fetchServices),
      filteredStateElements,
      currentConfigs,
      progressEmitter,
    )
    log.debug(`${elements.length} elements were fetched [mergedErrors=${mergeErrors.length}]`)
    const state = await workspace.state()
    await state.override(elements)
    await state.overridePathIndex(unmergedElements)
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

export type LocalChange = Omit<FetchChange, 'pendingChange'>

export const restore = async (
  workspace: Workspace,
  servicesFilters?: string[],
  idFilters: RegExp[] = [],
): Promise<LocalChange[]> => {
  log.debug('restore starting..')
  const fetchServices = servicesFilters ?? workspace.services()
  const stateElements = filterElementsByServices(
    await workspace.state().getAll(),
    fetchServices
  )
  const workspaceElements = filterElementsByServices(
    await workspace.elements(),
    fetchServices
  )
  const pathIndex = await workspace.state().getPathIndex()
  const changes = await createRestoreChanges(
    workspaceElements,
    stateElements,
    pathIndex,
    idFilters,
  )
  return changes.map(change => ({ change, serviceChange: change }))
}

export const diff = async (
  workspace: Workspace,
  toEnv: string,
  includeHidden = false,
  useState = false,
  servicesFilters?: string[],
  idFilters: RegExp[] = [],
): Promise<LocalChange[]> => {
  const diffServices = servicesFilters ?? workspace.services()
  const toElements = useState
    ? await workspace.state().getAll()
    : await workspace.elements(includeHidden)
  const fromElements = useState
    ? await workspace.state(toEnv).getAll()
    : await workspace.elements(includeHidden, toEnv)
  const fromServiceElements = filterElementsByServices(fromElements, diffServices)
  const toServiceElements = filterElementsByServices(toElements, diffServices)
  const diffChanges = await createDiffChanges(toServiceElements, fromServiceElements, idFilters)
  return diffChanges.map(change => ({ change, serviceChange: change }))
}

class AdapterInstallError extends Error {
  constructor(name: string, installResults: AdapterInstallResult) {
    const header = `Failed to add the ${name} adapter.`
    super([header, ...installResults.errors].join(EOL))
  }
}

export const addAdapter = async (
  workspace: Workspace,
  adapterName: string,
): Promise<ObjectType> => {
  const adapter = adapterCreators[adapterName]
  if (!adapter) {
    throw new Error('No adapter available for this service')
  }

  if (adapter.install !== undefined) {
    const installResult = await adapter.install()
    if (!installResult.success) {
      throw new AdapterInstallError(adapterName, installResult)
    }
  }

  await workspace.addService(adapterName)

  if (_.isUndefined((await workspace.servicesConfig([adapterName]))[adapterName])) {
    const defaultConfig = getDefaultAdapterConfig(adapterName)
    if (!_.isUndefined(defaultConfig)) {
      await workspace.updateServiceConfig(adapterName, defaultConfig)
    }
  }
  return adapter.credentialsType
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
