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
import {
  Adapter, InstanceElement, ObjectType, ElemID, AccountId, getChangeData, isField,
  Change, ChangeDataType, isFieldChange, AdapterFailureInstallResult,
  isAdapterSuccessInstallResult, AdapterSuccessInstallResult, AdapterAuthentication,
  SaltoError, Element, DetailedChange, isCredentialError, DeployExtraProperties,
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
import getChangeValidators from './core/plan/change_validators'
import { renameChecks, renameElement, updateStateElements } from './core/rename'
import { ChangeWithDetails } from './core/plan/plan_item'

export { cleanWorkspace } from './core/clean'

const { awu } = collections.asynciterable
const log = logger(module)

const { mapValuesAsync } = promises.object

const getAdapterFromLoginConfig = (loginConfig: Readonly<InstanceElement>): Adapter =>
  adapterCreators[loginConfig.elemID.adapter]

type VerifyCredentialsResult = {
    success: true
    accountId: AccountId
} | {
  success: false
  error: Error
}

export const verifyCredentials = async (
  loginConfig: Readonly<InstanceElement>,
): Promise<VerifyCredentialsResult> => {
  const adapterCreator = getAdapterFromLoginConfig(loginConfig)
  if (adapterCreator) {
    try {
      const accountId = await adapterCreator.validateCredentials(loginConfig)
      return { success: true, accountId }
    } catch (error) {
      if (isCredentialError(error)) {
        return {
          success: false,
          error,
        }
      }
      throw error
    }
  }
  throw new Error(`unknown adapter: ${loginConfig.elemID.adapter}`)
}

export const updateCredentials = async (
  workspace: Workspace,
  newConfig: Readonly<InstanceElement>,
  account?: string
): Promise<void> => {
  await workspace.updateAccountCredentials(account ?? newConfig.elemID.adapter, newConfig)
  log.debug(`persisted new configs for adapter: ${newConfig.elemID.adapter}`)
}

const shouldElementBeIncluded = (accounts: ReadonlyArray<string>) =>
  (id: ElemID): boolean => (
    accounts.includes(id.adapter)
    // Variables belong to all of the accounts
    || id.adapter === ElemID.VARIABLES_NAMESPACE
  )

const getAccountToServiceNameMap = (workspace: Workspace,
  accounts: string[]): Record<string, string> =>
  Object.fromEntries(accounts.map(account =>
    [account, workspace.getServiceFromAccountName(account)]))

export const preview = async (
  workspace: Workspace,
  accounts = workspace.accounts(),
  checkOnly = false,
): Promise<Plan> => {
  const stateElements = workspace.state()
  const adapters = await getAdapters(
    accounts,
    await workspace.accountCredentials(accounts),
    workspace.accountConfig.bind(workspace),
    await workspace.elements(),
    getAccountToServiceNameMap(workspace, accounts),
  )
  return getPlan({
    before: stateElements,
    after: await workspace.elements(),
    changeValidators: getChangeValidators(adapters, checkOnly),
    dependencyChangers: defaultDependencyChangers.concat(getAdapterDependencyChangers(adapters)),
    customGroupIdFunctions: getAdapterChangeGroupIdFunctions(adapters),
    topLevelFilters: [shouldElementBeIncluded(accounts)],
    compareOptions: { compareReferencesByValue: true },
  })
}

export interface DeployResult {
  success: boolean
  errors: DeployError[]
  changes?: Iterable<FetchChange>
  appliedChanges?: Change[]
  extraProperties?: DeployExtraProperties
}

export const deploy = async (
  workspace: Workspace,
  actionPlan: Plan,
  reportProgress: (item: PlanItem, status: ItemStatus, details?: string) => void,
  accounts = workspace.accounts(),
  checkOnly = false,
): Promise<DeployResult> => {
  const changedElements = elementSource.createInMemoryElementSource()
  const adapters = await getAdapters(
    accounts,
    await workspace.accountCredentials(accounts),
    workspace.accountConfig.bind(workspace),
    await workspace.elements(),
    getAccountToServiceNameMap(workspace, accounts)
  )

  const getUpdatedElement = async (change: Change): Promise<ChangeDataType> => {
    const changeElem = getChangeData(change)
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
  const { errors, appliedChanges, extraProperties } = await deployActions(
    actionPlan, adapters, reportProgress, postDeployAction, checkOnly,
  )

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
    appliedChanges,
    errors: errored ? errors : [],
    extraProperties,
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
  accountNameToConfigMessage?: Record<string, string>
}
export type FetchFunc = (
  workspace: Workspace,
  progressEmitter?: EventEmitter<FetchProgressEvents>,
  accounts?: string[],
  ignoreStateElemIdMapping?: boolean,
  withChangeDetection?: boolean
) => Promise<FetchResult>

export type FetchFromWorkspaceFuncParams = {
  workspace: Workspace
  otherWorkspace: Workspace
  progressEmitter?: EventEmitter<FetchProgressEvents>
  accounts?: string[]
  services?: string[]
  fromState?: boolean
  env: string
}
export type FetchFromWorkspaceFunc = (args: FetchFromWorkspaceFuncParams) => Promise<FetchResult>

const updateStateWithFetchResults = async (
  workspace: Workspace,
  mergedElements: Element[],
  unmergedElements: Element[],
  fetchedAccounts: string[]
): Promise<void> => {
  const fetchElementsFilter = shouldElementBeIncluded(fetchedAccounts)
  const stateElementsNotCoveredByFetch = await awu(await workspace.state().getAll())
    .filter(element => !fetchElementsFilter(element.elemID)).toArray()
  await workspace.state()
    .override(awu(mergedElements)
      .concat(stateElementsNotCoveredByFetch), fetchedAccounts)
  await workspace.state().updatePathIndex(unmergedElements,
    (await workspace.state().existingAccounts()).filter(key => !fetchedAccounts.includes(key)))
  log.debug(`finish to override state with ${mergedElements.length} elements`)
}

export const fetch: FetchFunc = async (
  workspace,
  progressEmitter?,
  accounts?,
  ignoreStateElemIdMapping?,
  withChangeDetection?,
) => {
  log.debug('fetch starting..')
  const fetchAccounts = accounts ?? workspace.accounts()
  const accountToServiceNameMap = getAccountToServiceNameMap(workspace, workspace.accounts())
  const {
    currentConfigs,
    adaptersCreatorConfigs,
  } = await getFetchAdapterAndServicesSetup(
    workspace,
    fetchAccounts,
    accountToServiceNameMap,
    ignoreStateElemIdMapping,
  )
  const accountToAdapter = initAdapters(adaptersCreatorConfigs, accountToServiceNameMap)

  if (progressEmitter) {
    progressEmitter.emit('adaptersDidInitialize')
  }
  try {
    const {
      changes, elements, mergeErrors, errors, updatedConfig,
      configChanges, accountNameToConfigMessage, unmergedElements,
    } = await fetchChanges(
      accountToAdapter,
      await workspace.elements(),
      workspace.state(),
      accountToServiceNameMap,
      currentConfigs,
      progressEmitter,
      withChangeDetection,
    )
    log.debug(`${elements.length} elements were fetched [mergedErrors=${mergeErrors.length}]`)
    await updateStateWithFetchResults(workspace, elements, unmergedElements, fetchAccounts)
    return {
      changes,
      fetchErrors: errors,
      mergeErrors,
      success: true,
      configChanges,
      updatedConfig,
      accountNameToConfigMessage,
    }
  } catch (error) {
    if (isCredentialError(error)) {
      return {
        changes: [],
        fetchErrors: [{ message: error.message, severity: 'Error' }],
        mergeErrors: [],
        success: false,
        updatedConfig: {},
      }
    }
    throw error
  }
}

export const fetchFromWorkspace: FetchFromWorkspaceFunc = async ({
  workspace,
  otherWorkspace,
  progressEmitter,
  accounts,
  services,
  fromState = false,
  env,
}: FetchFromWorkspaceFuncParams) => {
  log.debug('fetch starting from workspace..')
  const fetchAccounts = services ?? accounts ?? workspace.accounts()

  const { currentConfigs } = await getFetchAdapterAndServicesSetup(
    workspace,
    fetchAccounts,
    getAccountToServiceNameMap(workspace, fetchAccounts),
  )

  const {
    changes, elements, mergeErrors, errors,
    configChanges, accountNameToConfigMessage, unmergedElements,
  } = await fetchChangesFromWorkspace(
    otherWorkspace,
    fetchAccounts,
    await workspace.elements(),
    workspace.state(),
    currentConfigs,
    env,
    fromState,
    progressEmitter,
  )

  log.debug(`${elements.length} elements were fetched from a remote workspace [mergedErrors=${mergeErrors.length}]`)
  await updateStateWithFetchResults(workspace, elements, unmergedElements, fetchAccounts)
  return {
    changes,
    fetchErrors: errors,
    mergeErrors,
    success: true,
    updatedConfig: {},
    configChanges,
    accountNameToConfigMessage,
    progressEmitter,
  }
}

export type LocalChange = Omit<FetchChange, 'pendingChanges'>

export function restore(
  workspace: Workspace,
  accountFilters: string[] | undefined,
  elementSelectors: ElementSelector[] | undefined,
  resultType: 'changes'
): Promise<ChangeWithDetails[]>
export function restore(
  workspace: Workspace,
  accountFilters?: string[],
  elementSelectors?: ElementSelector[],
  resultType?: 'detailedChanges'
): Promise<LocalChange[]>
export async function restore(
  workspace: Workspace,
  accountFilters?: string[],
  elementSelectors: ElementSelector[] = [],
  resultType: 'changes' | 'detailedChanges' = 'detailedChanges'
): Promise<LocalChange[] | ChangeWithDetails[]> {
  log.debug('restore starting..')
  const fetchAccounts = accountFilters ?? workspace.accounts()
  if (resultType === 'changes') {
    return createRestoreChanges(
      await workspace.elements(),
      workspace.state(),
      await workspace.state().getPathIndex(),
      await workspace.getReferenceSourcesIndex(),
      elementSelectors,
      fetchAccounts,
      'changes'
    )
  }
  const detailedChanges = await createRestoreChanges(
    await workspace.elements(),
    workspace.state(),
    await workspace.state().getPathIndex(),
    await workspace.getReferenceSourcesIndex(),
    elementSelectors,
    fetchAccounts,
    'detailedChanges'
  )
  return detailedChanges.map(change => ({ change, serviceChanges: [change] }))
}

export function diff(
  workspace: Workspace,
  fromEnv: string,
  toEnv: string,
  includeHidden: boolean | undefined,
  useState: boolean | undefined,
  accountFilters: string[] | undefined,
  elementSelectors: ElementSelector[] | undefined,
  resultType: 'changes'
): Promise<ChangeWithDetails[]>
export function diff(
  workspace: Workspace,
  fromEnv: string,
  toEnv: string,
  includeHidden?: boolean,
  useState?: boolean,
  accountFilters?: string[],
  elementSelectors?: ElementSelector[],
  resultType?: 'detailedChanges'
): Promise<LocalChange[]>
export async function diff(
  workspace: Workspace,
  fromEnv: string,
  toEnv: string,
  includeHidden = false,
  useState = false,
  accountFilters?: string[],
  elementSelectors: ElementSelector[] = [],
  resultType: 'changes' | 'detailedChanges' = 'detailedChanges'
): Promise<LocalChange[] | ChangeWithDetails[]> {
  const diffAccounts = accountFilters ?? workspace.accounts()
  const fromElements = useState
    ? workspace.state(fromEnv)
    : await workspace.elements(includeHidden, fromEnv)
  const toElements = useState
    ? workspace.state(toEnv)
    : await workspace.elements(includeHidden, toEnv)

  if (resultType === 'changes') {
    return createDiffChanges(
      toElements,
      fromElements,
      await workspace.getReferenceSourcesIndex(),
      elementSelectors,
      [shouldElementBeIncluded(diffAccounts)],
      'changes'
    )
  }

  const diffChanges = await createDiffChanges(
    toElements,
    fromElements,
    await workspace.getReferenceSourcesIndex(),
    elementSelectors,
    [shouldElementBeIncluded(diffAccounts)],
    'detailedChanges'
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
  accountName?: string,
): Promise<AdapterAuthentication> => {
  const adapter = getAdapterCreator(adapterName)
  await workspace.addAccount(adapterName, accountName)
  const adapterAccountName = accountName ?? adapterName
  if (_.isUndefined((await workspace.accountConfig(adapterAccountName)))) {
    const defaultConfig = await getDefaultAdapterConfig(adapterName, adapterAccountName)
    if (!_.isUndefined(defaultConfig)) {
      await workspace.updateAccountConfig(adapterName, defaultConfig, adapterAccountName)
    }
  }
  return adapter.authenticationMethods
}

export type LoginStatus = { configTypeOptions: AdapterAuthentication; isLoggedIn: boolean }
export const getLoginStatuses = async (
  workspace: Workspace,
  accounts = workspace.accounts(),
): Promise<Record<string, LoginStatus>> => {
  const creds = await workspace.accountCredentials(accounts)
  const accountToServiceMap = Object.fromEntries(accounts.map(account => [
    account, workspace.getServiceFromAccountName(account),
  ]))
  const relevantServices = _.uniq(Object.values(accountToServiceMap))
  const logins = await mapValuesAsync(
    getAdaptersCredentialsTypes(relevantServices),
    async (configTypeOptions, adapter) =>
      ({
        configTypeOptions,
        isLoggedIn: !!creds[adapter],
      })
  )
  return Object.fromEntries(accounts.map(
    account => [account, logins[accountToServiceMap[account]]]
  ))
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

export const getAdapterConfigOptionsType = (adapterName: string): ObjectType | undefined =>
  adapterCreators[adapterName].configCreator?.optionsType
