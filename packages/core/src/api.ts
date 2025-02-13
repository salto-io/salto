/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  AccountInfo,
  Adapter,
  AdapterAuthentication,
  AdapterFailureInstallResult,
  AdapterOperations,
  AdapterSuccessInstallResult,
  CancelServiceAsyncTaskInput,
  CancelServiceAsyncTaskResult,
  Change,
  ChangeDataType,
  ChangeError,
  DetailedChangeWithBaseChange,
  Element,
  ElemID,
  getChangeData,
  InstanceElement,
  isAdapterSuccessInstallResult,
  isAdditionChange,
  isAdditionOrModificationChange,
  isField,
  isFieldChange,
  isRemovalChange,
  isSaltoError,
  ObjectType,
  Progress,
  ReferenceMapping,
  SaltoError,
  TopLevelElement,
  Values,
} from '@salto-io/adapter-api'
import { EventEmitter } from 'pietile-eventemitter'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { collections, objects, promises, values } from '@salto-io/lowerdash'
import {
  ElementSelector,
  elementSource,
  isTopLevelSelector,
  pathIndex as pathIndexModule,
  selectElementIdsByTraversal,
  Workspace,
} from '@salto-io/workspace'
import { EOL } from 'os'
import {
  buildElementsSourceFromElements,
  detailedCompare,
  getDetailedChanges as getDetailedChangesFromChange,
  inspectValue,
  resolveTypeShallow,
} from '@salto-io/adapter-utils'
import { deployActions, ItemStatus } from './core/deploy'
import {
  getAdapterDependencyChangers,
  getAdapters,
  getAdaptersCredentialsTypes,
  getDefaultAdapterConfig,
  initAdapters,
} from './core/adapters'
import { getPlan, Plan, PlanItem } from './core/plan'
import {
  calcFetchChanges,
  fetchChanges,
  fetchChangesFromWorkspace,
  FetchProgressEvents,
  getDetailedChanges,
  getFetchAdapterAndServicesSetup,
} from './core/fetch'
import { defaultDependencyChangers, IDFilter } from './core/plan/plan'
import { createRestoreChanges, createRestorePathChanges } from './core/restore'
import { getAdapterChangeGroupIdFunctions } from './core/adapters/custom_group_key'
import { createDiffChanges } from './core/diff'
import getChangeValidators from './core/plan/change_validators'
import { renameChecks, renameElement } from './core/rename'
import { ChangeWithDetails } from './core/plan/plan_item'
import { DeployResult, FetchChange, FetchResult } from './types'

export { cleanWorkspace } from './core/clean'

const { awu } = collections.asynciterable
const log = logger(module)

const { mapValuesAsync } = promises.object

const MAX_FIX_RUNS = 10

const getAdapterFromLoginConfig = (
  loginConfig: Readonly<InstanceElement>,
  adapterCreators: Record<string, Adapter>,
): Adapter => adapterCreators[loginConfig.elemID.adapter]

type VerifyCredentialsResult =
  | ({ success: true } & AccountInfo)
  | {
      success: false
      error: Error
    }

export const verifyCredentials = async (
  loginConfig: Readonly<InstanceElement>,
  adapterCreators: Record<string, Adapter>,
): Promise<VerifyCredentialsResult> => {
  const adapterCreator = getAdapterFromLoginConfig(loginConfig, adapterCreators)
  if (adapterCreator) {
    try {
      const account = await adapterCreator.validateCredentials(loginConfig)
      return { success: true, ...account }
    } catch (error) {
      return {
        success: false,
        error,
      }
    }
  }
  throw new Error(`unknown adapter: ${loginConfig.elemID.adapter}`)
}

export const updateCredentials = async (
  workspace: Workspace,
  newConfig: Readonly<InstanceElement>,
  account?: string,
): Promise<void> => {
  await workspace.updateAccountCredentials(account ?? newConfig.elemID.adapter, newConfig)
  log.debug(`persisted new configs for adapter: ${newConfig.elemID.adapter}`)
}

const shouldElementBeIncluded =
  (accounts: ReadonlyArray<string>) =>
  (id: ElemID): boolean =>
    accounts.includes(id.adapter) ||
    // Variables belong to all of the accounts
    id.adapter === ElemID.VARIABLES_NAMESPACE

const getAccountToServiceNameMap = (workspace: Workspace, accounts: string[]): Record<string, string> =>
  Object.fromEntries(accounts.map(account => [account, workspace.getServiceFromAccountName(account)]))

type PreviewArgs = {
  workspace: Workspace
  accounts?: string[]
  checkOnly?: boolean
  skipValidations?: boolean
  topLevelFilters?: IDFilter[]
  adapterCreators: Record<string, Adapter>
}

export async function preview({
  workspace,
  accounts = workspace.accounts(),
  checkOnly = false,
  skipValidations = false,
  topLevelFilters,
  adapterCreators,
}: PreviewArgs): Promise<Plan> {
  const stateElements = workspace.state()
  const adapters = await getAdapters(
    accounts,
    await workspace.accountCredentials(accounts),
    workspace.accountConfig.bind(workspace),
    await workspace.elements(),
    getAccountToServiceNameMap(workspace, accounts),
    {},
    adapterCreators,
  )
  return getPlan({
    before: stateElements,
    after: await workspace.elements(),
    changeValidators: skipValidations ? {} : getChangeValidators(adapters, checkOnly, await workspace.errors()),
    dependencyChangers: defaultDependencyChangers.concat(getAdapterDependencyChangers(adapters)),
    customGroupIdFunctions: getAdapterChangeGroupIdFunctions(adapters),
    topLevelFilters: [shouldElementBeIncluded(accounts), ...(topLevelFilters ?? [])],
    compareOptions: { compareByValue: true },
  })
}

type ReportProgress = (item: PlanItem, status: ItemStatus, details?: string | Progress) => void
export type DeployParams = {
  workspace: Workspace
  actionPlan: Plan
  reportProgress: ReportProgress
  accounts?: string[]
  checkOnly?: boolean
  adapterCreators: Record<string, Adapter>
}
// remove when there is no need to be backward compatible
export type CompatibleDeployFunc = (
  workspace: Workspace | DeployParams,
  actionPlan?: Plan,
  reportProgress?: ReportProgress,
  accounts?: string[],
  checkOnly?: boolean,
) => Promise<DeployResult>

export async function deploy({
  workspace,
  actionPlan,
  reportProgress,
  accounts = workspace.accounts(),
  checkOnly = false,
  adapterCreators,
}: DeployParams): Promise<DeployResult> {
  const changedElements = elementSource.createInMemoryElementSource()
  const adaptersElementSource = buildElementsSourceFromElements([], [changedElements, await workspace.elements()])
  const adapters = await getAdapters(
    accounts,
    await workspace.accountCredentials(accounts),
    workspace.accountConfig.bind(workspace),
    adaptersElementSource,
    getAccountToServiceNameMap(workspace, accounts),
    {},
    adapterCreators,
  )

  const postDeployAction = async (appliedChanges: ReadonlyArray<Change>): Promise<void> =>
    log.timeDebug(async () => {
      // This function is inside 'postDeployAction' because it assumes the state is already updated
      const getUpdatedElement = async (change: Change): Promise<ChangeDataType> => {
        const changeElem = getChangeData(change)
        // Because this function is called after we updated the state, the top level is already update with the field
        return isField(changeElem) ? workspace.state().get(changeElem.parent.elemID) : changeElem
      }

      const detailedChanges = appliedChanges.flatMap(change => getDetailedChangesFromChange(change))
      await workspace.state().updateStateFromChanges({ changes: detailedChanges })

      const updatedElements = await awu(appliedChanges)
        .filter(change => isAdditionOrModificationChange(change) || isFieldChange(change))
        .map(getUpdatedElement)
        .toArray()
      await changedElements.setAll(updatedElements)
    }, 'postDeployAction')

  const { errors, appliedChanges, extraProperties } = await deployActions(
    actionPlan,
    adapters,
    reportProgress,
    postDeployAction,
    checkOnly,
  )

  // Add workspace elements as an additional context for resolve so that we can resolve
  // variable expressions. Adding only variables is not enough for the case of a variable
  // with the value of a reference.
  const changes = await awu(
    await getDetailedChanges(await workspace.elements(), changedElements, [id => changedElements.has(id)]),
  )
    .map(change => ({ change, serviceChanges: [change] }))
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

export type FetchFuncParams = {
  workspace: Workspace
  progressEmitter?: EventEmitter<FetchProgressEvents>
  accounts?: string[]
  ignoreStateElemIdMapping?: boolean
  withChangesDetection?: boolean
  ignoreStateElemIdMappingForSelectors?: ElementSelector[]
  adapterCreators: Record<string, Adapter>
}

export type FetchFunc = (inputWorkspace: FetchFuncParams) => Promise<FetchResult>

export type FetchFromWorkspaceFuncParams = {
  workspace: Workspace
  otherWorkspace: Workspace
  progressEmitter?: EventEmitter<FetchProgressEvents>
  accounts?: string[]
  services?: string[]
  fromState?: boolean
  env: string
  adapterCreators: Record<string, Adapter>
}
export type FetchFromWorkspaceFunc = (args: FetchFromWorkspaceFuncParams) => Promise<FetchResult>

export async function fetch({
  workspace,
  progressEmitter,
  accounts,
  ignoreStateElemIdMapping,
  withChangesDetection,
  ignoreStateElemIdMappingForSelectors,
  adapterCreators,
}: FetchFuncParams): Promise<FetchResult> {
  log.debug('fetch starting..')
  const fetchAccounts = accounts ?? workspace.accounts()
  const accountToServiceNameMap = getAccountToServiceNameMap(workspace, workspace.accounts())
  const { currentConfigs, adaptersCreatorConfigs } = await getFetchAdapterAndServicesSetup({
    workspace,
    fetchAccounts,
    accountToServiceNameMap,
    elementsSource: await workspace.elements(),
    ignoreStateElemIdMapping,
    ignoreStateElemIdMappingForSelectors,
    adapterCreators,
  })
  const accountToAdapter = initAdapters(adaptersCreatorConfigs, accountToServiceNameMap, adapterCreators)

  if (progressEmitter) {
    progressEmitter.emit('adaptersDidInitialize')
  }
  const {
    changes,
    serviceToStateChanges,
    elements,
    mergeErrors,
    errors,
    updatedConfig,
    configChanges,
    accountNameToConfigMessage,
    unmergedElements,
    partiallyFetchedAccounts,
  } = await fetchChanges(
    accountToAdapter,
    await workspace.elements(),
    workspace.state(),
    accountToServiceNameMap,
    currentConfigs,
    progressEmitter,
    withChangesDetection,
  )
  log.debug(`${elements.length} elements were fetched [mergedErrors=${mergeErrors.length}]`)
  await workspace.state().updateStateFromChanges({
    changes: serviceToStateChanges,
    unmergedElements,
    fetchAccounts,
  })

  return {
    changes,
    fetchErrors: errors,
    mergeErrors,
    success: true,
    configChanges,
    updatedConfig,
    accountNameToConfigMessage,
    partiallyFetchedAccounts,
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
  adapterCreators,
}: FetchFromWorkspaceFuncParams) => {
  log.debug('fetch starting from workspace..')
  const fetchAccounts = services ?? accounts ?? workspace.accounts()

  const { currentConfigs } = await getFetchAdapterAndServicesSetup({
    workspace,
    fetchAccounts,
    accountToServiceNameMap: getAccountToServiceNameMap(workspace, fetchAccounts),
    elementsSource: await workspace.elements(),
    adapterCreators,
  })

  const {
    changes,
    serviceToStateChanges,
    elements,
    mergeErrors,
    errors,
    configChanges,
    accountNameToConfigMessage,
    unmergedElements,
    partiallyFetchedAccounts,
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
  await workspace.state().updateStateFromChanges({
    changes: serviceToStateChanges,
    unmergedElements,
    fetchAccounts,
  })
  return {
    changes,
    fetchErrors: errors,
    mergeErrors,
    success: true,
    updatedConfig: {},
    configChanges,
    accountNameToConfigMessage,
    progressEmitter,
    partiallyFetchedAccounts,
  }
}

type CalculatePatchFromChangesArgs = {
  workspace: Workspace
  changes: Change<TopLevelElement>[]
  pathIndex: pathIndexModule.PathIndex
}

export const calculatePatchFromChanges = async ({
  workspace,
  changes,
  pathIndex,
}: CalculatePatchFromChangesArgs): Promise<FetchChange[]> => {
  const [additions, removalAndModifications] = _.partition(changes, isAdditionChange)
  const [removals, modifications] = _.partition(removalAndModifications, isRemovalChange)
  const beforeElements = [...removals, ...modifications].map(change => change.data.before)
  const afterElements = [...additions, ...modifications].map(change => change.data.after)
  const unmergedAfterElements = await awu(afterElements)
    .flatMap(element => pathIndexModule.splitElementByPath(element, pathIndex))
    .toArray()
  const accounts = [...beforeElements, ...afterElements].map(element => element.elemID.adapter)
  const partialFetchData = new Map(accounts.map(account => [account, { deletedElements: new Set<string>() }]))
  removals
    .map(change => getChangeData(change).elemID)
    .forEach(id => {
      partialFetchData.get(id.adapter)?.deletedElements.add(id.getFullName())
    })
  const result = await calcFetchChanges({
    accountElements: unmergedAfterElements,
    mergedAccountElements: afterElements,
    stateElements: elementSource.createInMemoryElementSource(beforeElements),
    workspaceElements: await workspace.elements(false),
    partiallyFetchedAccounts: partialFetchData,
    allFetchedAccounts: new Set(accounts),
  })
  return result.changes
}

export type LocalChange = Omit<FetchChange, 'pendingChanges'>

export function restore(
  workspace: Workspace,
  accountFilters: string[] | undefined,
  elementSelectors: ElementSelector[] | undefined,
  resultType: 'changes',
): Promise<ChangeWithDetails[]>
export function restore(
  workspace: Workspace,
  accountFilters?: string[],
  elementSelectors?: ElementSelector[],
  resultType?: 'detailedChanges',
): Promise<LocalChange[]>
export async function restore(
  workspace: Workspace,
  accountFilters?: string[],
  elementSelectors: ElementSelector[] = [],
  resultType: 'changes' | 'detailedChanges' = 'detailedChanges',
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
      'changes',
    )
  }
  const detailedChanges = await createRestoreChanges(
    await workspace.elements(),
    workspace.state(),
    await workspace.state().getPathIndex(),
    await workspace.getReferenceSourcesIndex(),
    elementSelectors,
    fetchAccounts,
    'detailedChanges',
  )
  return detailedChanges.map(change => ({ change, serviceChanges: [change] }))
}

export const restorePaths = async (workspace: Workspace, accounts?: string[]): Promise<LocalChange[]> =>
  (
    await createRestorePathChanges(
      await awu(await (await workspace.elements()).getAll()).toArray(),
      await workspace.state().getPathIndex(),
      accounts,
    )
  ).map(change => ({ change, serviceChanges: [change] }))

export function diff(
  workspace: Workspace,
  fromEnv: string,
  toEnv: string,
  includeHidden: boolean | undefined,
  useState: boolean | undefined,
  accountFilters: string[] | undefined,
  elementSelectors: ElementSelector[] | undefined,
  resultType: 'changes',
): Promise<ChangeWithDetails[]>
export function diff(
  workspace: Workspace,
  fromEnv: string,
  toEnv: string,
  includeHidden?: boolean,
  useState?: boolean,
  accountFilters?: string[],
  elementSelectors?: ElementSelector[],
  resultType?: 'detailedChanges',
): Promise<LocalChange[]>
export async function diff(
  workspace: Workspace,
  fromEnv: string,
  toEnv: string,
  includeHidden = false,
  useState = false,
  accountFilters?: string[],
  elementSelectors: ElementSelector[] = [],
  resultType: 'changes' | 'detailedChanges' = 'detailedChanges',
): Promise<LocalChange[] | ChangeWithDetails[]> {
  const accountIDFilter = accountFilters === undefined ? undefined : [shouldElementBeIncluded(accountFilters)]
  const fromElements = useState ? workspace.state(fromEnv) : await workspace.elements(includeHidden, fromEnv)
  const toElements = useState ? workspace.state(toEnv) : await workspace.elements(includeHidden, toEnv)

  if (resultType === 'changes') {
    return createDiffChanges({
      toElementsSrc: toElements,
      fromElementsSrc: fromElements,
      referenceSourcesIndex: await workspace.getReferenceSourcesIndex(),
      elementSelectors,
      topLevelFilters: accountIDFilter,
      resultType: 'changes',
    })
  }

  const diffChanges = await createDiffChanges({
    toElementsSrc: toElements,
    fromElementsSrc: fromElements,
    referenceSourcesIndex: await workspace.getReferenceSourcesIndex(),
    elementSelectors,
    topLevelFilters: accountIDFilter,
    resultType: 'detailedChanges',
  })
  return diffChanges.map(change => ({ change, serviceChanges: [change] }))
}

class AdapterInstallError extends Error {
  constructor(name: string, failureInstallResults: AdapterFailureInstallResult) {
    const header = `Failed to add the ${name} adapter.`
    super([header, ...failureInstallResults.errors].join(EOL))
  }
}

const getAdapterCreator = ({
  adapterName,
  adapterCreators,
}: {
  adapterName: string
  adapterCreators: Record<string, Adapter>
}): Adapter => {
  const adapter = adapterCreators[adapterName]
  if (adapter) {
    return adapter
  }
  throw new Error(`No adapter available for ${adapterName}`)
}

export const installAdapter = async (
  adapterName: string,
  adapterCreators: Record<string, Adapter>,
): Promise<AdapterSuccessInstallResult | undefined> => {
  const adapter = getAdapterCreator({ adapterName, adapterCreators })
  if (adapter.install === undefined) {
    return undefined
  }
  const installResult = await adapter.install()
  if (isAdapterSuccessInstallResult(installResult)) {
    return installResult
  }
  throw new AdapterInstallError(adapterName, installResult)
}

type AddAdapterArgs = {
  workspace: Workspace
  adapterName: string
  accountName?: string
  adapterCreators: Record<string, Adapter>
}

export async function addAdapter({
  workspace,
  adapterName,
  accountName,
  adapterCreators,
}: AddAdapterArgs): Promise<AdapterAuthentication> {
  const adapter = getAdapterCreator({ adapterName, adapterCreators })
  await workspace.addAccount(adapterName, accountName)
  const adapterAccountName = accountName ?? adapterName
  if (_.isUndefined(await workspace.accountConfig(adapterAccountName))) {
    const defaultConfig = await getDefaultAdapterConfig({
      adapterName,
      accountName: adapterAccountName,
      adapterCreators,
    })
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
  adapterCreators: Record<string, Adapter>,
): Promise<Record<string, LoginStatus>> => {
  const creds = await workspace.accountCredentials(accounts)
  const accountToServiceMap = Object.fromEntries(
    accounts.map(account => [account, workspace.getServiceFromAccountName(account)]),
  )
  const relevantServices = _.uniq(Object.values(accountToServiceMap))
  const logins = await mapValuesAsync(
    getAdaptersCredentialsTypes({ names: relevantServices, adapterCreators }),
    async (configTypeOptions, adapter) => ({
      configTypeOptions,
      isLoggedIn: !!creds[adapter],
    }),
  )
  return Object.fromEntries(accounts.map(account => [account, logins[accountToServiceMap[account]]]))
}

export const rename = async (
  workspace: Workspace,
  sourceElemId: ElemID,
  targetElemId: ElemID,
): Promise<DetailedChangeWithBaseChange[]> => {
  await renameChecks(workspace, sourceElemId, targetElemId)

  const renameElementChanges = await renameElement(
    await workspace.elements(),
    sourceElemId,
    targetElemId,
    await workspace.state().getPathIndex(),
  )

  if ((await workspace.state().get(sourceElemId)) !== undefined) {
    const changes = await renameElement(workspace.state(), sourceElemId, targetElemId)
    await workspace.state().updateStateFromChanges({ changes })
  }

  return renameElementChanges
}

export const getAdapterConfigOptionsType = (adapterName: string, optionsContext?: Values): ObjectType | undefined =>
  adapterCreators[adapterName]?.configCreator?.optionsType(optionsContext)

/**
 * @deprecated
 */
export const getAdditionalReferences = async (
  workspace: Workspace,
  changes: Change[],
  adapterCreators: Record<string, Adapter>,
): Promise<ReferenceMapping[]> => {
  const accountToService = getAccountToServiceNameMap(workspace, workspace.accounts())
  log.debug('accountToServiceMap: %s', inspectValue(accountToService))
  const changeGroups = _.groupBy(changes, change => getChangeData(change).elemID.adapter)
  const referenceGroups = await Promise.all(
    Object.entries(changeGroups).map(([account, changeGroup]) =>
      adapterCreators[accountToService[account]]?.getAdditionalReferences?.(changeGroup),
    ),
  )
  return referenceGroups.flat().filter(values.isDefined)
}

const getFixedElements = (elements: Element[], fixedElements: Element[]): Element[] => {
  const elementFixesByElemID = _.keyBy(fixedElements, element => element.elemID.getFullName())
  const origElementsByID = _.keyBy(elements, element => element.elemID.getFullName())
  const unitedElementsIds = _.uniq(Object.keys(elementFixesByElemID).concat(Object.keys(origElementsByID)))
  return unitedElementsIds.map(elementId => elementFixesByElemID[elementId] ?? origElementsByID[elementId])
}

const fixElementsContinuously = async (
  workspace: Workspace,
  elements: Element[],
  adapters: Record<string, AdapterOperations>,
  runsLeft: number,
): Promise<{ errors: ChangeError[]; fixedElements: Element[] }> => {
  log.debug(`Fixing elements. ${runsLeft} runs left.`)

  const elementGroups = _.groupBy(elements, element => element.elemID.adapter)

  const elementFixGroups = await Promise.all(
    Object.entries(elementGroups).map(async ([account, elementGroup]) => {
      try {
        return (await adapters[account]?.fixElements?.(elementGroup)) ?? { errors: [], fixedElements: [] }
      } catch (e) {
        log.error(`Failed to fix elements for ${account} adapter: ${e}`)
        return { errors: [], fixedElements: [] }
      }
    }),
  )

  const fixes = objects.concatObjects(elementFixGroups)

  const fixedElements = getFixedElements(elements, fixes.fixedElements)

  log.trace('FixElements returned the object %o', fixes)

  if (fixes.errors.length > 0 && runsLeft > 0) {
    const elementFixes = await fixElementsContinuously(workspace, fixedElements, adapters, runsLeft - 1)

    const ids = new Set(elementFixes.fixedElements.map(element => element.elemID.getFullName()))

    return {
      errors: fixes.errors.concat(elementFixes.errors),
      fixedElements: fixes.fixedElements
        .filter(element => !ids.has(element.elemID.getFullName()))
        .concat(elementFixes.fixedElements),
    }
  }

  if (fixes.errors.length > 0) {
    log.warn('Max element fix runs reached')
  }

  return fixes
}

export class SelectorsError extends Error {
  constructor(
    message: string,
    readonly invalidSelectors: string[],
  ) {
    super(message)
  }
}

export const fixElements = async (
  workspace: Workspace,
  selectors: ElementSelector[],
  adapterCreators: Record<string, Adapter>,
): Promise<{ errors: ChangeError[]; changes: DetailedChangeWithBaseChange[] }> => {
  const accounts = workspace.accounts()
  const adapters = await getAdapters(
    accounts,
    await workspace.accountCredentials(accounts),
    workspace.accountConfig.bind(workspace),
    await workspace.elements(),
    getAccountToServiceNameMap(workspace, accounts),
    {},
    adapterCreators,
  )

  const nonTopLevelSelectors = selectors.filter(selector => !isTopLevelSelector(selector))

  if (!_.isEmpty(nonTopLevelSelectors)) {
    throw new SelectorsError(
      'Fixing elements by selectors that are not top level is not supported',
      nonTopLevelSelectors.map(selector => selector.origin),
    )
  }

  const relevantIds = await selectElementIdsByTraversal({
    selectors,
    source: await workspace.elements(),
    referenceSourcesIndex: await workspace.getReferenceSourcesIndex(),
  })

  const elements = await awu(relevantIds)
    .map(id => workspace.getValue(id))
    .filter(values.isDefined)
    .toArray()

  const elementsSource = await workspace.elements()
  await awu(elements).forEach(element => resolveTypeShallow(element, elementsSource))

  log.debug(
    'about to fixElements: %o, found by selectors: %o',
    elements.map(element => element.elemID.getFullName()),
    selectors.map(selector => selector.origin),
  )

  if (_.isEmpty(elements)) {
    log.debug('fixElements found no elements to fix')
    return { errors: [], changes: [] }
  }

  const fixes = await fixElementsContinuously(workspace, elements, adapters, MAX_FIX_RUNS)
  const workspaceElements = await workspace.elements()
  const changes = await awu(fixes.fixedElements)
    .flatMap(async fixedElement => detailedCompare(await workspaceElements.get(fixedElement.elemID), fixedElement))
    .toArray()
  return { errors: fixes.errors, changes }
}

const initAccountAdapter = async ({
  account,
  workspace,
  adapterCreators,
}: {
  account: string
  workspace: Workspace
  adapterCreators: Record<string, Adapter>
}): Promise<AdapterOperations | SaltoError> => {
  if (!workspace.accounts().includes(account)) {
    return {
      severity: 'Error',
      message: 'Account Not Found',
      detailedMessage: `The account ${account} does not exist in the workspace`,
    }
  }
  const accounts = [account]
  try {
    const adaptersMap = await getAdapters(
      accounts,
      await workspace.accountCredentials(accounts),
      workspace.accountConfig.bind(workspace),
      await workspace.elements(),
      getAccountToServiceNameMap(workspace, accounts),
      undefined,
      adapterCreators,
    )
    const adapter = adaptersMap[account]
    if (adapter === undefined) {
      return {
        severity: 'Error',
        message: 'Adapter Not Found',
        detailedMessage: `No adapter found for account ${account}`,
      }
    }
    return adapter
  } catch (e) {
    return {
      severity: 'Error',
      message: 'Failed to Initialize Adapter',
      detailedMessage: `Failed to initialize adapter for account ${account}: ${e.message}`,
    }
  }
}

export const cancelServiceAsyncTask = async ({
  workspace,
  account,
  input,
  adapterCreators,
}: {
  workspace: Workspace
  account: string
  input: CancelServiceAsyncTaskInput
  adapterCreators: Record<string, Adapter>
}): Promise<CancelServiceAsyncTaskResult> => {
  const adapter = await initAccountAdapter({ account, workspace, adapterCreators })
  if (isSaltoError(adapter)) {
    return {
      errors: [adapter],
    }
  }
  if (adapter.cancelServiceAsyncTask === undefined) {
    return {
      errors: [
        {
          severity: 'Error',
          message: 'Operation Not Supported',
          detailedMessage: `cancelServiceAsyncTask is not supported for account ${account}`,
        },
      ],
    }
  }
  try {
    return await adapter.cancelServiceAsyncTask(input)
  } catch (e) {
    return {
      errors: [
        {
          severity: 'Error',
          message: 'Failed to Cancel Task',
          detailedMessage: `Failed to cancel task ${input.taskId}: ${e.message}`,
        },
      ],
    }
  }
}
