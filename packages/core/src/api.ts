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
import {
  Adapter, InstanceElement, ObjectType, ElemID, AccountId, getChangeElement, isField,
  Change, ChangeDataType, isFieldChange, AdapterFailureInstallResult,
  isAdapterSuccessInstallResult, AdapterSuccessInstallResult, AdapterAuthentication,
  SaltoError, Element, DetailedChange,
} from '@salto-io/adapter-api'
import { EventEmitter } from 'pietile-eventemitter'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { promises, collections } from '@salto-io/lowerdash'
import { Workspace, ElementSelector, elementSource } from '@salto-io/workspace'
import { EOL } from 'os'
import { deployActions, DeployError, ItemStatus } from './core/deploy'
import {
  adapterCreators, getAdaptersCredentialsTypes, getAdapters, getAdapterDependencyChangers,
  initAdapters, getDefaultAdapterConfig,
} from './core/adapters'
import { getPlan, Plan, PlanItem } from './core/plan'
import {
  FetchChange,
  fetchChanges,
  FetchProgressEvents,
  getDetailedChanges,
  MergeErrorWithElements,
  fetchChangesFromWorkspace,
  getFetchAdapterAndServicesSetup,
} from './core/fetch'
import { defaultDependencyChangers } from './core/plan/plan'
import { createRestoreChanges } from './core/restore'
import { getAdapterChangeGroupIdFunctions } from './core/adapters/custom_group_key'
import { createDiffChanges } from './core/diff'
import { getChangeValidators, getAdaptersConfig } from './core/plan/change_validators'
import { renameChecks, renameElement, updateStateElements } from './core/rename'

export { cleanWorkspace } from './core/clean'

const { awu } = collections.asynciterable
const log = logger(module)

const getAdapterFromLoginConfig = (serviceName: string): Adapter =>
  adapterCreators[serviceName]

export const verifyCredentials = async (
  loginConfig: Readonly<InstanceElement>,
  serviceName?: string,
): Promise<AccountId> => {
  const adapterCreator = getAdapterFromLoginConfig(serviceName ?? loginConfig.elemID.adapter)
  if (adapterCreator) {
    return adapterCreator.validateCredentials(loginConfig)
  }
  throw new Error(`unknown adapter: ${loginConfig.elemID.adapter}`)
}

export const updateCredentials = async (
  workspace: Workspace,
  newConfig: Readonly<InstanceElement>,
  account?: string
): Promise<void> => {
  await verifyCredentials(newConfig)
  await workspace.updateServiceCredentials(account ?? newConfig.elemID.adapter, newConfig)
  log.debug(`persisted new configs for adapter: ${newConfig.elemID.adapter}`)
}

const shouldElementBeIncluded = (services: ReadonlyArray<string>) =>
  (id: ElemID): boolean => (
    services.includes(id.adapter)
    // Variables belong to all of the services
    || id.adapter === ElemID.VARIABLES_NAMESPACE
  )

const getAccountToServiceNameMap = (workspace: Workspace,
  accounts: string[]): Record<string, string> =>
  Object.fromEntries(accounts.map(account => [account, workspace
    .getServiceFromAccountName(account)]))

export const preview = async (
  workspace: Workspace,
  accounts = workspace.services(),
): Promise<Plan> => {
  const stateElements = workspace.state()
  const adapters = await getAdapters(
    accounts,
    await workspace.servicesCredentials(accounts),
    workspace.serviceConfig.bind(workspace),
    await workspace.elements(),
    getAccountToServiceNameMap(workspace, accounts),
  )
  return getPlan({
    before: stateElements,
    after: await workspace.elements(),
    changeValidators: getChangeValidators(adapters),
    dependencyChangers: defaultDependencyChangers.concat(getAdapterDependencyChangers(adapters)),
    customGroupIdFunctions: getAdapterChangeGroupIdFunctions(adapters),
    topLevelFilters: [shouldElementBeIncluded(accounts)],
    adapterGetConfig: await getAdaptersConfig(adapters, workspace.serviceConfig.bind(workspace)),
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
  accounts = workspace.services(),
): Promise<DeployResult> => {
  const changedElements = elementSource.createInMemoryElementSource()
  const adapters = await getAdapters(
    accounts,
    await workspace.servicesCredentials(accounts),
    workspace.serviceConfig.bind(workspace),
    await workspace.elements(),
    getAccountToServiceNameMap(workspace, accounts)
  )

  const getUpdatedElement = async (change: Change): Promise<ChangeDataType> => {
    const changeElem = getChangeElement(change)
    if (!isField(changeElem)) {
      return changeElem
    }
    const topLevelElem = await workspace.state().get(changeElem.parent.elemID) as ObjectType
    return new ObjectType({
      ...topLevelElem,
      annotationRefsOrTypes: topLevelElem.annotationRefTypes,
      fields: change.action === 'remove'
        ? _.omit(topLevelElem.fields, changeElem.name)
        : _.merge({}, topLevelElem.fields, { [changeElem.name]: changeElem }),
    })
  }

  const postDeployAction = async (appliedChanges: ReadonlyArray<Change>): Promise<void> => {
    await promises.array.series(appliedChanges.map(change => async () => {
      const updatedElement = await getUpdatedElement(change)
      if (change.action === 'remove' && !isFieldChange(change)) {
        await workspace.state().remove(updatedElement.elemID)
      } else {
        await workspace.state().set(updatedElement)
        await changedElements.set(updatedElement)
      }
    }))
  }
  const errors = await deployActions(actionPlan, adapters, reportProgress, postDeployAction)

  // Add workspace elements as an additional context for resolve so that we can resolve
  // variable expressions. Adding only variables is not enough for the case of a variable
  // with the value of a reference.
  const changes = await awu(await getDetailedChanges(
    await workspace.elements(),
    changedElements,
    [id => changedElements.has(id)]
  )).map(change => ({ change, serviceChanges: [change] }))
    .toArray()
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
  fetchErrors: SaltoError[]
  success: boolean
  configChanges?: Plan
  updatedConfig : Record<string, InstanceElement[]>
  adapterNameToConfigMessage?: Record<string, string>
}
export type FetchFunc = (
  workspace: Workspace,
  progressEmitter?: EventEmitter<FetchProgressEvents>,
  services?: string[],
  ignoreStateElemIdMapping?: boolean,
) => Promise<FetchResult>

export type FetchFromWorkspaceFuncParams = {
  workspace: Workspace
  otherWorkspace: Workspace
  progressEmitter?: EventEmitter<FetchProgressEvents>
  services?: string[]
  env: string
}
export type FetchFromWorkspaceFunc = (args: FetchFromWorkspaceFuncParams) => Promise<FetchResult>

const updateStateWithFetchResults = async (
  workspace: Workspace,
  mergedElements: Element[],
  unmergedElements: Element[],
  fetchedServices: string[]
): Promise<void> => {
  const fetchElementsFilter = shouldElementBeIncluded(fetchedServices)
  const stateElementsNotCoveredByFetch = await awu(await workspace.state().getAll())
    .filter(element => !fetchElementsFilter(element.elemID)).toArray()
  await workspace.state()
    .override(awu(mergedElements)
      .concat(stateElementsNotCoveredByFetch), fetchedServices)
  await workspace.state().updatePathIndex(unmergedElements,
    (await workspace.state().existingServices()).filter(key => !fetchedServices.includes(key)))
  log.debug(`finish to override state with ${mergedElements.length} elements`)
}

export const fetch: FetchFunc = async (
  workspace,
  progressEmitter?,
  services?,
  ignoreStateElemIdMapping?,
) => {
  log.debug('fetch starting..')
  const fetchServices = services ?? workspace.services()
  const accountToServiceNameMap = getAccountToServiceNameMap(workspace, fetchServices)
  const {
    currentConfigs,
    adaptersCreatorConfigs,
  } = await getFetchAdapterAndServicesSetup(
    workspace,
    fetchServices,
    accountToServiceNameMap,
    ignoreStateElemIdMapping,
  )
  const adapters = initAdapters(adaptersCreatorConfigs, accountToServiceNameMap)

  if (progressEmitter) {
    progressEmitter.emit('adaptersDidInitialize')
  }
  const {
    changes, elements, mergeErrors, errors, updatedConfig,
    configChanges, adapterNameToConfigMessage, unmergedElements,
  } = await fetchChanges(
    adapters,
    await workspace.elements(),
    accountToServiceNameMap,
    workspace.state(),
    currentConfigs,
    progressEmitter,
  )
  log.debug(`${elements.length} elements were fetched [mergedErrors=${mergeErrors.length}]`)
  await updateStateWithFetchResults(workspace, elements, unmergedElements, fetchServices)
  return {
    changes,
    fetchErrors: errors,
    mergeErrors,
    success: true,
    configChanges,
    updatedConfig,
    adapterNameToConfigMessage,
  }
}

export const fetchFromWorkspace: FetchFromWorkspaceFunc = async ({
  workspace,
  otherWorkspace,
  progressEmitter,
  services,
  env,
}: FetchFromWorkspaceFuncParams) => {
  log.debug('fetch starting from workspace..')
  const fetchServices = services ?? workspace.services()

  const { currentConfigs } = await getFetchAdapterAndServicesSetup(
    workspace,
    fetchServices,
    getAccountToServiceNameMap(workspace, fetchServices),
  )

  const {
    changes, elements, mergeErrors, errors,
    configChanges, adapterNameToConfigMessage, unmergedElements,
  } = await fetchChangesFromWorkspace(
    otherWorkspace,
    fetchServices,
    await workspace.elements(),
    workspace.state(),
    currentConfigs,
    env,
    progressEmitter,
  )

  log.debug(`${elements.length} elements were fetched from a remote workspace [mergedErrors=${mergeErrors.length}]`)
  await updateStateWithFetchResults(workspace, elements, unmergedElements, fetchServices)
  return {
    changes,
    fetchErrors: errors,
    mergeErrors,
    success: true,
    updatedConfig: {},
    configChanges,
    adapterNameToConfigMessage,
    progressEmitter,
  }
}

export type LocalChange = Omit<FetchChange, 'pendingChanges'>

export const restore = async (
  workspace: Workspace,
  servicesFilters?: string[],
  elementSelectors: ElementSelector[] = [],
): Promise<LocalChange[]> => {
  log.debug('restore starting..')
  const fetchServices = servicesFilters ?? workspace.services()
  const changes = await createRestoreChanges(
    await workspace.elements(),
    workspace.state(),
    await workspace.state().getPathIndex(),
    await workspace.getReferenceSourcesIndex(),
    elementSelectors,
    fetchServices
  )
  return changes.map(change => ({ change, serviceChanges: [change] }))
}

export const diff = async (
  workspace: Workspace,
  fromEnv: string,
  toEnv: string,
  includeHidden = false,
  useState = false,
  servicesFilters?: string[],
  elementSelectors: ElementSelector[] = [],
): Promise<LocalChange[]> => {
  const diffServices = servicesFilters ?? workspace.services()
  const fromElements = useState
    ? workspace.state(fromEnv)
    : await workspace.elements(includeHidden, fromEnv)
  const toElements = useState
    ? workspace.state(toEnv)
    : await workspace.elements(includeHidden, toEnv)

  const diffChanges = await createDiffChanges(
    toElements,
    fromElements,
    await workspace.getReferenceSourcesIndex(),
    elementSelectors,
    [shouldElementBeIncluded(diffServices)]
  )

  return diffChanges.map(change => ({ change, serviceChanges: [change] }))
}

class AdapterInstallError extends Error {
  constructor(name: string, failureInstallResults: AdapterFailureInstallResult) {
    const header = `Failed to add the ${name} adapter.`
    super([header, ...failureInstallResults.errors].join(EOL))
  }
}

const getAdapterCreator = (adapterName: string): Adapter => {
  const adapter = adapterCreators[adapterName]
  if (adapter) {
    return adapter
  }
  throw new Error(`No adapter available for ${adapterName}`)
}

export const installAdapter = async (adapterName: string):
  Promise<AdapterSuccessInstallResult|undefined> => {
  const adapter = getAdapterCreator(adapterName)
  if (adapter.install === undefined) {
    return undefined
  }
  const installResult = await adapter.install()
  if (isAdapterSuccessInstallResult(installResult)) {
    return installResult
  }
  throw new AdapterInstallError(adapterName, installResult)
}

export const addAdapter = async (
  workspace: Workspace,
  adapterName: string,
  accountID?: string,
): Promise<AdapterAuthentication> => {
  const adapter = getAdapterCreator(adapterName)
  await workspace.addService(adapterName, accountID)

  if (_.isUndefined((await workspace.serviceConfig(adapterName)))) {
    const defaultConfig = await getDefaultAdapterConfig(adapterName)
    if (!_.isUndefined(defaultConfig)) {
      await workspace.updateServiceConfig(adapterName, defaultConfig)
    }
  }
  return adapter.authenticationMethods
}

export type LoginStatus = { configTypeOptions: AdapterAuthentication; isLoggedIn: boolean }
export const getLoginStatuses = async (
  workspace: Workspace,
  accountIDs = workspace.services(),
): Promise<Record<string, LoginStatus>> => {
  const creds = await workspace.servicesCredentials(accountIDs)
  const logins = _.mapValues(getAdaptersCredentialsTypes(accountIDs),
    async (configTypeOptions, adapter) =>
      ({
        configTypeOptions,
        isLoggedIn: !!creds[adapter],
      }))

  return promises.object.resolveValues(logins)
}

export const getSupportedServiceAdapterNames = (): string[] => Object.keys(adapterCreators)

export const rename = async (
  workspace: Workspace,
  sourceElemId: ElemID,
  targetElemId: ElemID
): Promise<DetailedChange[]> => {
  await renameChecks(workspace, sourceElemId, targetElemId)

  const renameElementChanges = await renameElement(
    await workspace.elements(),
    sourceElemId,
    targetElemId,
    await workspace.state().getPathIndex()
  )

  if (await workspace.state().get(sourceElemId) !== undefined) {
    const changes = await renameElement(
      workspace.state(),
      sourceElemId,
      targetElemId,
    )
    await updateStateElements(workspace.state(), changes)
  }

  return renameElementChanges
}
