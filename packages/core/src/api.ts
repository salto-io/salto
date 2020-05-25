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
  addHiddenValuesAndHiddenTypes,
  removeHiddenValuesAndHiddenTypes,
} from './workspace/hidden_values'

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
  return getPlan(
    filterElementsByServices(stateElements, services),
    addHiddenValuesAndHiddenTypes(
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
  const changedElements = new Map<string, Element>()
  const actionPlan = await preview(workspace, services)
  if (force || await shouldDeploy(actionPlan)) {
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

    const postDeploy = async (appliedChanges: ReadonlyArray<Change>): Promise<void> => {
      await promises.array.series(appliedChanges.map(change => async () => {
        const updatedElement = await getUpdatedElement(change)
        const stateUpdate = (change.action === 'remove' && !isFieldChange(change))
          ? workspace.state().remove(updatedElement.elemID)
          : workspace.state().set(updatedElement)
        await stateUpdate
        changedElements.set(updatedElement.elemID.getFullName(), updatedElement)
      }))
    }
    const errors = await deployActions(actionPlan, adapters, reportProgress, postDeploy)

    // Remove hidden Types and hidden values inside instances
    const elementsAfterHiddenRemoval = removeHiddenValuesAndHiddenTypes(changedElements.values())
      .map(e => e.clone())
    const workspaceElements = await workspace.elements()
    const relevantWorkspaceElements = workspaceElements
      .filter(e => changedElements.has(e.elemID.getFullName()))

    // Add workspace elements as an additional context for resolve so that we can resolve
    // variable expressions. Adding only variables is not enough for the case of a variable
    // with the value of a reference.
    const changes = wu(await getDetailedChanges(
      relevantWorkspaceElements,
      elementsAfterHiddenRemoval,
      workspaceElements
    )).map(change => ({ change, serviceChange: change }))
      .map(toChangesWithPath(name => {
        const elem = changedElements.get(name)
        return elem === undefined ? [] : [elem]
      }))
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

  if (_.isUndefined((await workspace.servicesConfig([adapterName]))[adapterName])) {
    const defaultConfig = getDefaultAdapterConfig(adapterName)
    if (!_.isUndefined(defaultConfig)) {
      await workspace.updateServiceConfig(adapterName, defaultConfig)
    }
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
