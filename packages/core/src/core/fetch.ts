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
import wu from 'wu'
import _ from 'lodash'
import { EventEmitter } from 'pietile-eventemitter'
import {
  Element, ElemID, AdapterOperations, Values, ServiceIds, ObjectType,
  toServiceIdsString, Field, OBJECT_SERVICE_ID, InstanceElement, isInstanceElement, isObjectType,
  FIELD_NAME, INSTANCE_NAME, OBJECT_NAME, ElemIdGetter, DetailedChange, SaltoError,
  isSaltoElementError, ProgressReporter, ReadOnlyElementsSource, TypeMap, isServiceId,
  CORE_ANNOTATIONS, AdapterOperationsContext, FetchResult, isAdditionChange, isStaticFile,
  isAdditionOrModificationChange, Value, StaticFile, isElement,
} from '@salto-io/adapter-api'
import { applyInstancesDefaults, resolvePath, flattenElementStr, buildElementsSourceFromElements, safeJsonStringify, walkOnElement, WalkOnFunc, WALK_NEXT_STEP, setPath, walkOnValue } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { merger, elementSource, expressions, Workspace, pathIndex, updateElementsWithAlternativeAccount, createAdapterReplacedID, remoteMap } from '@salto-io/workspace'
import { collections, promises, types, values } from '@salto-io/lowerdash'
import { StepEvents } from './deploy'
import { getPlan, Plan } from './plan'
import { AdapterEvents, createAdapterProgressReporter } from './adapters/progress'
import { IDFilter } from './plan/plan'
import { getAdaptersCreatorConfigs } from './adapters'

const { awu, groupByAsync } = collections.asynciterable
const { mapValuesAsync } = promises.object
const { withLimitedConcurrency } = promises.array
const { mergeElements } = merger
const log = logger(module)
const { isDefined } = values

const MAX_SPLIT_CONCURRENCY = 2000
type ChangeAuthorInformation = {
  changedBy?: string
  changedAt?: string
 }
export type FetchChangeMetadata = ChangeAuthorInformation

export type FetchChange = {
  // The actual change to apply to the workspace
  change: DetailedChange
  // The change that happened in the service
  serviceChanges: DetailedChange[]
  // The change between the working copy and the state
  pendingChanges?: DetailedChange[]
  // Metadata information about the change.
  metadata?: FetchChangeMetadata
}

const getAuthorInformationFromElement = (
  element: Element | undefined
): ChangeAuthorInformation => {
  if (!element) {
    return {}
  }
  return _.pickBy({ changedAt: element.annotations?.[CORE_ANNOTATIONS.CHANGED_AT],
    changedBy: element.annotations?.[CORE_ANNOTATIONS.CHANGED_BY] }, isDefined)
}

const getFetchChangeMetadata = (changedElement: Element | undefined): FetchChangeMetadata =>
  getAuthorInformationFromElement(changedElement)

export const toAddFetchChange = (elem: Element): FetchChange => {
  const change: DetailedChange = {
    id: elem.elemID,
    action: 'add',
    data: { after: elem },
  }
  return { change, serviceChanges: [change], metadata: getFetchChangeMetadata(elem) }
}


export class StepEmitter<T = void> extends EventEmitter<StepEvents<T>> {}

export type FetchProgressEvents = {
  adaptersDidInitialize: () => void
  changesWillBeFetched: (stepProgress: StepEmitter, adapterNames: string[]) => void
  diffWillBeCalculated: (stepProgress: StepEmitter) => void
  workspaceWillBeUpdated: (
    stepProgress: StepEmitter<number>,
    changes: number,
    approved: number
  ) => void
  stateWillBeUpdated: (stepProgress: StepEmitter, changes: number) => void
  adapterFetch: (adapterName: string, phase: string) => void
} & AdapterEvents

export type MergeErrorWithElements = {
  error: merger.MergeError
  elements: Element[]
}

export const getDetailedChanges = async (
  before: ReadOnlyElementsSource,
  after: ReadOnlyElementsSource,
  topLevelFilters: IDFilter[]
): Promise<Iterable<DetailedChange>> =>
  wu((await getPlan({
    before,
    after,
    dependencyChangers: [],
    topLevelFilters,
  })).itemsByEvalOrder())
    .map(item => item.detailedChanges())
    .flatten()

type WorkspaceDetailedChangeOrigin = 'service' | 'workspace'
type WorkspaceDetailedChange = {
  change: DetailedChange
  origin: WorkspaceDetailedChangeOrigin
}
const getDetailedChangeTree = async (
  before: ReadOnlyElementsSource,
  after: ReadOnlyElementsSource,
  topLevelFilters: IDFilter[],
  origin: WorkspaceDetailedChangeOrigin,
): Promise<collections.treeMap.TreeMap<WorkspaceDetailedChange>> => (
  new collections.treeMap.TreeMap(
    wu(await getDetailedChanges(before, after, topLevelFilters))
      .map(change => [change.id.getFullName(), [{ change, origin }]])
  )
)

const findNestedElementPath = (
  changeElemID: ElemID,
  originalParentElements: Element[]
): readonly string[] | undefined => (
  originalParentElements.find(e => !_.isUndefined(resolvePath(e, changeElemID)))?.path
)

type ChangeTransformFunction = (sourceChange: FetchChange) => Promise<FetchChange[]>
const toChangesWithPath = (
  accountElementByFullName: (id: ElemID) => Promise<Element[]> | Element[]
): ChangeTransformFunction => (
  async change => {
    const changeID: ElemID = change.change.id
    if (!changeID.isTopLevel() && change.change.action === 'add') {
      const path = findNestedElementPath(
        changeID,
        await accountElementByFullName(changeID.createTopLevelParentID().parent)
      )
      log.trace(`addition change for nested ${changeID.idType} with id ${changeID.getFullName()}, path found ${path?.join('/')}`)
      return path
        ? [_.merge({}, change, { change: { path } })]
        : [change]
    }
    const originalElements = await accountElementByFullName(changeID)
    if (originalElements.length === 0) {
      log.trace(`no original elements found for change element id ${changeID.getFullName()}`)
      return [change]
    }
    // Replace merged element with original elements that have a path hint
    return originalElements.map(elem => _.merge({}, change, { change: { data: { after: elem } } }))
  })

const addFetchChangeMetadata = (
  updatedElementSource: ReadOnlyElementsSource
): ChangeTransformFunction => async change => ([{
  ...change,
  metadata: getFetchChangeMetadata(
    await updatedElementSource.get(change.change.id.createBaseID().parent)
  ),
}])

const getChangesNestedUnderID = (
  id: ElemID, changesTree: collections.treeMap.TreeMap<WorkspaceDetailedChange>
): WorkspaceDetailedChange[] => (
  wu(changesTree.valuesWithPrefix(id.getFullName()))
    .flatten(true)
    // Instance IDs are nested under the type ID in the tree, so we have to filter this
    .filter(item => id.isEqual(item.change.id) || id.isParentOf(item.change.id))
    .toArray()
)

const toFetchChanges = (
  serviceAndPendingChanges: collections.treeMap.TreeMap<WorkspaceDetailedChange>,
  workspaceToServiceChanges: collections.treeMap.TreeMap<WorkspaceDetailedChange>,
): Iterable<FetchChange> => {
  const handledChangeIDs = new Set<string>()
  return wu(serviceAndPendingChanges.keys())
    .map((id): FetchChange[] | undefined => {
      if (handledChangeIDs.has(id)) {
        // If we get here it means this change was a "relatedChange" in a previous iteration
        // which means we already handled this change and we should not handle it again
        return undefined
      }

      const elemId = ElemID.fromFullName(id)
      const wsChanges = getChangesNestedUnderID(elemId, workspaceToServiceChanges)
        .map(({ change }) => change)
      if (wsChanges.length === 0) {
        // If we get here it means there is a difference between the account and the state
        // but there is no difference between the account and the workspace. this can happen
        // when the nacl files are updated externally (from git usually) with the change that
        // happened in the account. so the nacl is already aligned with the account and we don't
        // have to do anything here
        log.debug('account change on %s already updated in workspace', id)
        return undefined
      }

      // Find all changes that relate to the current ID and mark them as handled
      const relatedChanges = getChangesNestedUnderID(elemId, serviceAndPendingChanges)
      relatedChanges.forEach(change => handledChangeIDs.add(change.change.id.getFullName()))

      const [serviceChanges, pendingChanges] = _.partition(
        relatedChanges,
        change => change.origin === 'service'
      ).map(changeList => changeList.map(change => change.change))

      if (serviceChanges.length === 0) {
        // If nothing changed in the account, we don't want to do anything
        return undefined
      }

      if (pendingChanges.length > 0) {
        log.debug(
          'Found conflict on %s between %d service changes and %d pending changes. service change ids: %o, pending change ids: %o',
          id, serviceChanges.length, pendingChanges.length,
          serviceChanges.map(change => `${change.action} ${change.id.getFullName()}`),
          pendingChanges.map(change => `${change.action} ${change.id.getFullName()}`),
        )
      }

      const createFetchChange = (change: DetailedChange): FetchChange => {
        if (!change.id.isEqual(elemId) && isAdditionChange(change)) {
          // We have a workspace change that is nested inside a conflict between
          // the workspace and the service. it seems like this can only happen if both sides
          // are adding the same element but with different values.
          // We choose to always accept anything the service added as if it is not a conflict
          // we do this because there is a chance that these are all just hidden values and then
          // the conflict isn't real and we can just apply the changes without forcing the user to
          // do anything
          return { change, serviceChanges, pendingChanges: [] }
        }
        // In all other cases, we want to return the change with the relevant conflicts
        return { change, serviceChanges, pendingChanges }
      }
      return wsChanges.map(createFetchChange)
    })
    .filter(values.isDefined)
    .flatten(true)
}

export type FetchChangesResult = {
  changes: Iterable<FetchChange>
  elements: Element[]
  errors: SaltoError[]
  unmergedElements: Element[]
  mergeErrors: MergeErrorWithElements[]
  updatedConfig: Record<string, InstanceElement[]>
  configChanges?: Plan
  accountNameToConfigMessage?: Record<string, string>
}

type ProcessMergeErrorsResult = {
  keptElements: Element[]
  errorsWithDroppedElements: MergeErrorWithElements[]
}

const processMergeErrors = async (
  elements: AsyncIterable<Element>,
  errors: merger.MergeError[],
  stateElements: elementSource.ElementsSource
): Promise<ProcessMergeErrorsResult> => log.time(async () => {
  const mergeErrsByElemID = _(errors)
    .map(me => ([
      me.elemID.createTopLevelParentID().parent.getFullName(),
      { error: me, elements: [] }]))
    .fromPairs()
    .value() as Record<string, MergeErrorWithElements>
  const errorsWithDroppedElements: MergeErrorWithElements[] = []
  const errorsWithStateElements: MergeErrorWithElements[] = []
  const keptElements = await awu(elements).filter(async e => {
    const foundMergeErr = mergeErrsByElemID[e.elemID.getFullName()]
    if (foundMergeErr) {
      foundMergeErr.elements.push(e)
      if (await stateElements.has(e.elemID)) {
        errorsWithStateElements.push(foundMergeErr)
      }
      errorsWithDroppedElements.push(foundMergeErr)
    }

    // if element is an instance element add it to the type element merge error if exists
    const foundMergeErrForInstanceType = isInstanceElement(e)
      ? mergeErrsByElemID[e.refType.elemID.getFullName()]
      : undefined
    if (foundMergeErrForInstanceType) {
      foundMergeErrForInstanceType.elements.push(e)
    }

    return !foundMergeErr && !foundMergeErrForInstanceType
  }).toArray()
  return {
    keptElements,
    errorsWithDroppedElements,
  }
}, 'process merge errors for %o errors', errors.length)

type UpdatedConfig = {
  config: InstanceElement[]
  message: string
}

type AdapterOperationsWithPostFetch = types.PickyRequired<AdapterOperations, 'postFetch'>

const isAdapterOperationsWithPostFetch = (
  v: AdapterOperations
): v is AdapterOperationsWithPostFetch => (
  v.postFetch !== undefined
)

const runPostFetch = async ({
  adapters,
  accountElements,
  stateElementsByAccount,
  partiallyFetchedAccounts,
  accountToServiceNameMap,
  progressReporters,
}: {
  adapters: Record<string, AdapterOperationsWithPostFetch>
  accountElements: Element[]
  stateElementsByAccount: Record<string, ReadonlyArray<Element>>
  partiallyFetchedAccounts: Set<string>
  accountToServiceNameMap: Record<string, string>
  progressReporters: Record<string, ProgressReporter>
}): Promise<void> => {
  const serviceElementsByAccount = _.groupBy(accountElements, e => e.elemID.adapter)
  const getAdapterElements = (accountName: string): ReadonlyArray<Element> => {
    if (!partiallyFetchedAccounts.has(accountName)) {
      return serviceElementsByAccount[accountName] ?? stateElementsByAccount[accountName]
    }
    const fetchedIDs = new Set(
      serviceElementsByAccount[accountName].map(e => e.elemID.getFullName())
    )
    const missingElements = stateElementsByAccount[accountName].filter(
      e => !fetchedIDs.has(e.elemID.getFullName())
    )
    return [
      ...serviceElementsByAccount[accountName],
      ...missingElements,
    ]
  }
  const elementsByAccount = Object.fromEntries(
    [...new Set([
      ...Object.keys(stateElementsByAccount),
      ...Object.keys(serviceElementsByAccount),
    ])].map(accountName => [accountName, getAdapterElements(accountName)])
  )
  // only modifies elements in-place, done sequentially to avoid race conditions
  await promises.array.series(
    Object.entries(adapters).map(([adapterName, adapter]) => async () => (
      adapter.postFetch({
        currentAdapterElements: serviceElementsByAccount[adapterName],
        elementsByAccount,
        accountToServiceNameMap,
        progressReporter: progressReporters[adapterName],
      })
    ))
  )
}

const fetchAndProcessMergeErrors = async (
  accountsToAdapters: Record<string, AdapterOperations>,
  stateElements: elementSource.ElementsSource,
  accountToServiceNameMap: Record<string, string>,
  getChangesEmitter: StepEmitter,
  progressEmitter?: EventEmitter<FetchProgressEvents>,
  withChangesDetection?: boolean
):
  Promise<{
    accountElements: Element[]
    errors: SaltoError[]
    processErrorsResult: ProcessMergeErrorsResult
    updatedConfigs: UpdatedConfig[]
    partiallyFetchedAccounts: Set<string>
  }> => {
  const updateConfigAccountName = async (
    configs: InstanceElement[],
    accountName: string,
    service: string,
  ): Promise<InstanceElement[]> => {
    // resolve is used as a clone that keeps references between clones intact
    const configClones = (await expressions.resolve(
      configs,
      buildElementsSourceFromElements([]),
    )).filter(isInstanceElement)
    await updateElementsWithAlternativeAccount(
      configClones,
      accountName,
      service
    )
    return configClones
  }
  const updateErrorAccountNames = async (
    errors: SaltoError[],
    accountName: string,
  ): Promise<void> => {
    errors.forEach(error => {
      if (isSaltoElementError(error)) {
        error.elemID = createAdapterReplacedID(error.elemID, accountName)
      }
    })
  }
  const handleAccountNameUpdate = async (
    fetchResult: FetchResult,
    accountName: string,
    service: string,
  ): Promise<void> => {
    // Resolve is used for an efficient deep clone
    fetchResult.elements = await expressions.resolve(
      fetchResult.elements,
      stateElements,
    )
    await updateElementsWithAlternativeAccount(fetchResult.elements, accountName, service)
    if (fetchResult.updatedConfig) {
      fetchResult.updatedConfig.config = await updateConfigAccountName(
        fetchResult.updatedConfig.config,
        accountName,
        service
      )
    }
    if (fetchResult.errors) {
      await updateErrorAccountNames(fetchResult.errors, accountName)
    }
  }
  try {
    const progressReporters = _.mapValues(
      accountsToAdapters,
      (_adapter, accountName) => createAdapterProgressReporter(accountName, 'fetch', progressEmitter)
    )
    const fetchResults = await Promise.all(
      Object.entries(accountsToAdapters)
        .map(async ([accountName, adapter]) => {
          const fetchResult = await adapter.fetch({
            progressReporter: progressReporters[accountName],
            withChangesDetection,
          })
          const { updatedConfig, errors } = fetchResult
          if (
            fetchResult.elements.length > 0 && accountName !== accountToServiceNameMap[accountName]
          ) {
            await handleAccountNameUpdate(
              fetchResult, accountName, accountToServiceNameMap[accountName],
            )
          }
          // We need to flatten the elements string to avoid a memory leak. See docs
          // of the flattenElementStr method for more details.
          return {
            elements: fetchResult.elements.map(flattenElementStr),
            errors: errors ?? [],
            updatedConfig: updatedConfig
              ? {
                config: updatedConfig.config.map(flattenElementStr),
                message: updatedConfig.message,
              }
              : undefined,
            isPartial: fetchResult.isPartial ?? false,
            accountName,
          }
        })
    )
    const accountElements = _.flatten(fetchResults.map(res => res.elements))
    const fetchErrors = fetchResults.flatMap(res => res.errors)
    const updatedConfigs = fetchResults
      .map(res => res.updatedConfig)
      .filter(values.isDefined) as UpdatedConfig[]

    const partiallyFetchedAccounts = new Set(
      fetchResults
        .filter(result => result.isPartial)
        .map(result => result.accountName)
    )

    log.debug(`fetched ${accountElements.length} elements from adapters`)
    const stateElementsByAccount = await groupByAsync(
      await stateElements.getAll(),
      elem => elem.elemID.adapter
    )
    const adaptersWithPostFetch = _.pickBy(accountsToAdapters, isAdapterOperationsWithPostFetch)
    if (!_.isEmpty(adaptersWithPostFetch)) {
      try {
        // update elements based on fetch results from other services
        await runPostFetch({
          adapters: adaptersWithPostFetch,
          accountElements,
          stateElementsByAccount,
          partiallyFetchedAccounts,
          accountToServiceNameMap,
          progressReporters,
        })
        log.debug('ran post-fetch in the following adapters: %s', Object.keys(adaptersWithPostFetch))
      } catch (e) {
        // failures in this step should never fail the fetch
        log.error(`failed to run postFetch: ${e}, stack: ${e.stack}`)
      }
    }

    const { errors: mergeErrors, merged: elements } = await mergeElements(awu(accountElements))
    const mergeErrorsArr = await awu(mergeErrors.values()).flat().toArray()
    const processErrorsResult = await processMergeErrors(
      applyInstancesDefaults(elements.values()),
      mergeErrorsArr,
      stateElements,
    )

    const droppedElements = new Set(
      processErrorsResult.errorsWithDroppedElements.flatMap(
        err => err.elements.map(e => e.elemID.createTopLevelParentID().parent.getFullName())
      )
    )
    const validAccountElements = accountElements
      .filter(e => !droppedElements.has(e.elemID.getFullName()))
    log.debug(`after merge there are ${processErrorsResult.keptElements.length} elements [errors=${
      mergeErrorsArr.length}]`)

    return {
      accountElements: validAccountElements,
      errors: fetchErrors,
      processErrorsResult,
      updatedConfigs,
      partiallyFetchedAccounts,
    }
  } catch (error) {
    getChangesEmitter.emit('failed')
    throw error
  }
}

export const getAdaptersFirstFetchPartial = async (
  elements: ReadOnlyElementsSource,
  partiallyFetchedAdapters: Set<string>,
): Promise<Set<string>> => {
  if (_.isEmpty(partiallyFetchedAdapters)) {
    return new Set()
  }
  const adaptersWithElements = new Set(
    await awu(await elements.list()).map(elemID => elemID.adapter).toArray()
  )
  return collections.set.difference(partiallyFetchedAdapters, adaptersWithElements)
}

// Calculate the fetch changes - calculation should be done only if workspace has data,
// o/w all account elements should be consider as "add" changes.
export const calcFetchChanges = async (
  accountElements: ReadonlyArray<Element>,
  mergedAccountElements: elementSource.ElementsSource,
  stateElements: elementSource.ElementsSource,
  workspaceElements: elementSource.ElementsSource,
  partiallyFetchedAccounts: Set<string>,
  allFetchedAccounts: Set<string>
): Promise<Iterable<FetchChange>> => {
  const partialFetchFilter: IDFilter = id => (
    !partiallyFetchedAccounts.has(id.adapter)
    || mergedAccountElements.has(id)
  )
  const accountFetchFilter: IDFilter = id =>
    allFetchedAccounts.has(id.adapter)
  const partialFetchElementSource: ReadOnlyElementsSource = {
    get: async (id: ElemID): Promise<Element | undefined> => {
      const mergedElem = await mergedAccountElements.get(id)
      if (mergedElem === undefined && partiallyFetchedAccounts.has(id.adapter)) {
        return stateElements.get(id)
      }
      return mergedElem
    },
    getAll: () => mergedAccountElements.getAll(),
    has: id => mergedAccountElements.has(id),
    list: () => mergedAccountElements.list(),
  }

  const serviceChanges = await log.time(
    () => getDetailedChangeTree(
      stateElements,
      partialFetchElementSource,
      [accountFetchFilter, partialFetchFilter],
      'service',
    ),
    'calculate service-state changes',
  )

  // We only care about conflicts with changes from the service, so for the next two comparisons
  // we only need to check elements for which we have service changes
  const serviceChangesTopLevelIDs = new Set(
    wu(serviceChanges.values())
      .map(changes => changes[0].change.id.createTopLevelParentID().parent.getFullName())
  )
  const serviceChangeIdsFilter: IDFilter = id => serviceChangesTopLevelIDs.has(id.getFullName())

  const pendingChanges = await log.time(
    () => getDetailedChangeTree(
      stateElements,
      workspaceElements,
      [accountFetchFilter, partialFetchFilter, serviceChangeIdsFilter],
      'workspace',
    ),
    'calculate pending changes',
  )
  const workspaceToServiceChanges = await log.time(
    () => getDetailedChangeTree(
      workspaceElements,
      partialFetchElementSource,
      [accountFetchFilter, partialFetchFilter, serviceChangeIdsFilter],
      'service',
    ),
    'calculate service-workspace changes',
  )

  // Merge pending changes and service changes into one tree so we can find conflicts between them
  serviceChanges.merge(pendingChanges)
  const fetchChanges = toFetchChanges(serviceChanges, workspaceToServiceChanges)
  const serviceElementsMap = _.groupBy(
    accountElements,
    e => e.elemID.getFullName()
  )

  return awu(fetchChanges)
    .flatMap(toChangesWithPath(async name => serviceElementsMap[name.getFullName()] ?? []))
    .flatMap(addFetchChangeMetadata(partialFetchElementSource))
    .toArray()
}

type CreateFetchChangesParams = {
  adapterNames: string[]
  workspaceElements: elementSource.ElementsSource
  stateElements: elementSource.ElementsSource
  unmergedElements: Element[]
  processErrorsResult: ProcessMergeErrorsResult
  currentConfigs: InstanceElement[]
  getChangesEmitter: StepEmitter
  partiallyFetchedAccounts?: Set<string>
  updatedConfigs?: UpdatedConfig[]
  errors?: SaltoError[]
  progressEmitter?: EventEmitter<FetchProgressEvents>
}
const createFetchChanges = async ({
  adapterNames, workspaceElements, stateElements, unmergedElements,
  processErrorsResult, currentConfigs, getChangesEmitter, partiallyFetchedAccounts = new Set(),
  updatedConfigs = [], errors = [], progressEmitter,
}: CreateFetchChangesParams
): Promise<FetchChangesResult> => {
  const calculateDiffEmitter = new StepEmitter()
  if (progressEmitter) {
    getChangesEmitter.emit('completed')
    progressEmitter.emit('diffWillBeCalculated', calculateDiffEmitter)
  }
  const isFirstFetch = await awu(await workspaceElements.list())
    .concat(await stateElements.list())
    .filter(e => !e.isConfig())
    .isEmpty()
  const changes = isFirstFetch
    ? unmergedElements.map(toAddFetchChange)
    : await calcFetchChanges(
      unmergedElements,
      elementSource.createInMemoryElementSource(processErrorsResult.keptElements),
      // When we init a new env, state will be empty. We fallback to the workspace
      // elements since they should be considered a part of the env and the diff
      // should be calculated with them in mind.
      await awu(await stateElements.list()).isEmpty() ? workspaceElements : stateElements,
      workspaceElements,
      partiallyFetchedAccounts,
      new Set(adapterNames)
    )
  log.debug('finished to calculate fetch changes')
  if (progressEmitter) {
    calculateDiffEmitter.emit('completed')
  }

  const configsMerge = await mergeElements(awu(updatedConfigs.flatMap(c => c.config)))

  const errorMessages = await awu(configsMerge.errors.entries())
    .flatMap(err => err.value)
    .map(err => err.message)
    .toArray()
  if (errorMessages.length !== 0) {
    throw new Error(`Received configuration merge errors: ${errorMessages.join(', ')}`)
  }

  const configs = await awu(configsMerge.merged.values()).toArray()
  const updatedConfigNames = new Set(configs.map(c => c.elemID.getFullName()))
  const configChanges = await getPlan({
    before: elementSource.createInMemoryElementSource(
      currentConfigs.filter(config => updatedConfigNames.has(config.elemID.getFullName()))
    ),
    after: elementSource.createInMemoryElementSource(configs),
  })

  const accountNameToConfig = _.keyBy(updatedConfigs, config => config.config[0].elemID.adapter)
  const accountNameToConfigMessage = _.mapValues(accountNameToConfig, config => config.message)

  const elements = partiallyFetchedAccounts.size !== 0
    ? _(await awu(await stateElements.getAll()).toArray())
      .filter(e => partiallyFetchedAccounts.has(e.elemID.adapter))
      .unshift(...processErrorsResult.keptElements)
      .uniqBy(e => e.elemID.getFullName())
      .value()
    : processErrorsResult.keptElements
  return {
    changes,
    elements,
    errors,
    unmergedElements,
    mergeErrors: processErrorsResult.errorsWithDroppedElements,
    configChanges,
    updatedConfig: _.mapValues(accountNameToConfig, config => config.config),
    accountNameToConfigMessage,
  }
}
export const fetchChanges = async (
  accountsToAdapters: Record<string, AdapterOperations>,
  workspaceElements: elementSource.ElementsSource,
  stateElements: elementSource.ElementsSource,
  // As part of SALTO-1661, parameters here should be replaced with named parameters
  accountToServiceNameMap: Record<string, string>,
  currentConfigs: InstanceElement[],
  progressEmitter?: EventEmitter<FetchProgressEvents>,
  withChangesDetection?: boolean
): Promise<FetchChangesResult> => {
  const accountNames = _.keys(accountsToAdapters)
  const getChangesEmitter = new StepEmitter()
  if (progressEmitter) {
    progressEmitter.emit('changesWillBeFetched', getChangesEmitter, accountNames)
  }
  const {
    accountElements, errors, processErrorsResult, updatedConfigs, partiallyFetchedAccounts,
  } = await fetchAndProcessMergeErrors(
    accountsToAdapters,
    stateElements,
    accountToServiceNameMap,
    getChangesEmitter,
    progressEmitter,
    withChangesDetection
  )

  const adaptersFirstFetchPartial = await getAdaptersFirstFetchPartial(
    stateElements,
    partiallyFetchedAccounts
  )
  adaptersFirstFetchPartial.forEach(
    adapter => log.warn('Received partial results from %s before full fetch', adapter)
  )
  return createFetchChanges({
    unmergedElements: accountElements,
    adapterNames: Object.keys(accountsToAdapters),
    workspaceElements,
    stateElements,
    currentConfigs,
    getChangesEmitter,
    progressEmitter,
    processErrorsResult,
    errors,
    updatedConfigs,
    partiallyFetchedAccounts,
  })
}

const createEmptyFetchChangeDueToError = (errMsg: string): FetchChangesResult => {
  log.warn(`creating empty fetch result due to ${errMsg}`)
  return {
    changes: [],
    elements: [],
    mergeErrors: [],
    unmergedElements: [],
    updatedConfig: {},
    errors: [{
      message: errMsg,
      severity: 'Error',
    }],
  }
}

type StaticFileAndElemID = { elemID: ElemID; staticFile: StaticFile }

const getPathsToStaticFiles = (
  value: Element | Value,
  elemId: ElemID,
): StaticFileAndElemID[] => {
  const staticFilesAndElemIDs: StaticFileAndElemID[] = []
  const findStaticFilesFn: WalkOnFunc = ({ path, value: val }) => {
    if (isStaticFile(val)) {
      staticFilesAndElemIDs.push({ elemID: path, staticFile: val })
      return WALK_NEXT_STEP.SKIP
    }
    return WALK_NEXT_STEP.RECURSE
  }
  if (isElement(value)) {
    walkOnElement({ element: value, func: findStaticFilesFn })
  } else {
    walkOnValue({ elemId, value, func: findStaticFilesFn })
  }
  return staticFilesAndElemIDs
}

const fixStaticFilesForFromStateChanges = async (
  fetchChangesResult: FetchChangesResult,
  otherWorkspace: Workspace,
  env: string,
): Promise<FetchChangesResult> => {
  const invalidChangeIDs: Set<string> = new Set()
  const filteredChanges = wu(fetchChangesResult.changes)
    .map(fetchChange => fetchChange.change)
    .filter(isAdditionOrModificationChange)
  await awu(filteredChanges)
    .forEach(async change => {
      const staticFiles = getPathsToStaticFiles(
        change.data.after,
        change.id,
      )
      const changePath = change.id.createTopLevelParentID().path
      await awu(staticFiles).forEach(async ({ elemID: staticFileValElemID, staticFile }) => {
        const actualStaticFile = await otherWorkspace.getStaticFile({
          filepath: staticFile.filepath,
          encoding: staticFile.encoding,
          env,
        })
        if (!actualStaticFile?.isEqual(staticFile)) {
          invalidChangeIDs.add(change.id.getFullName())
          log.warn(
            'Static files mismatch in fetch from state for change in elemID %s. (stateHash=%s naclHash=%s)',
            change.id.getFullName(),
            staticFile.hash,
            actualStaticFile?.hash,
          )
          return
        }
        if (isElement(change.data.after)) {
          setPath(change.data.after, staticFileValElemID, actualStaticFile)
          return
        }
        if (isStaticFile(change.data.after)) {
          change.data.after = actualStaticFile
          return
        }
        const staticFilePath = staticFileValElemID.createTopLevelParentID().path
        const relativePath = staticFilePath.slice(changePath.length - 1)
        _.set(change.data.after, relativePath, actualStaticFile)
      })
    })
  return {
    ...fetchChangesResult,
    changes: wu(fetchChangesResult.changes)
      .filter(change => !invalidChangeIDs.has(change.change.id.getFullName())),
    errors: fetchChangesResult.errors.concat(
      Array.from(invalidChangeIDs).map(invalidChangeElemID => ({
        message: `Dropping changes in element: ${invalidChangeElemID} due to static files hashes mismatch`,
        severity: 'Error',
      }))
    ),
  }
}

export const fetchChangesFromWorkspace = async (
  otherWorkspace: Workspace,
  fetchAccounts: string[],
  workspaceElements: elementSource.ElementsSource,
  stateElements: elementSource.ElementsSource,
  currentConfigs: InstanceElement[],
  env: string,
  fromState: boolean,
  progressEmitter?: EventEmitter<FetchProgressEvents>,
): Promise<FetchChangesResult> => {
  const splitElementByFile = async (element: Element): Promise<Element[]> => {
    const elementNaclFiles = await otherWorkspace.getElementNaclFiles(element.elemID)
    const naclFragments = (await Promise.all(
      elementNaclFiles.map(
        async filename => (await otherWorkspace.getParsedNaclFile(filename))?.elements()
      )
    )).filter(values.isDefined).flat()
    const naclPathIndex = new remoteMap.InMemoryRemoteMap<pathIndex.Path[]>()
    await pathIndex.overridePathIndex(naclPathIndex, naclFragments)
    return pathIndex.splitElementByPath(element, naclPathIndex)
  }

  const getDifferentConfigs = async (): Promise<InstanceElement[]> => (
    awu(currentConfigs).filter(async config => {
      const otherConfig = await otherWorkspace.accountConfig(config.elemID.adapter)
      return !otherConfig || !otherConfig.isEqual(config)
    }).toArray()
  )

  if (env && !otherWorkspace.envs().includes(env)) {
    return createEmptyFetchChangeDueToError(`${env} env does not exist in the source workspace.`)
  }

  const otherAccounts = otherWorkspace.accounts(env)
  const missingAccounts = fetchAccounts.filter(account => !otherAccounts.includes(account))

  if (missingAccounts.length > 0) {
    return createEmptyFetchChangeDueToError(
      `Source env does not contain the following accounts: ${missingAccounts.join(',')}`
    )
  }

  const differentConfig = await log.time(async () =>
    getDifferentConfigs(), 'Getting workspace configs')
  if (!_.isEmpty(differentConfig)) {
    const configsByAdapter = _.groupBy(
      [...differentConfig, ...currentConfigs],
      config => config.elemID.adapter,
    )
    Object.entries(configsByAdapter).forEach(([adapter, configs]) => {
      log.warn(`Found different configs for ${adapter} - 
      ${configs.map(config => safeJsonStringify(config.value, undefined, 2)).join('\n')}`)
    })
  }
  if (!fromState
    && await log.time(async () => (await otherWorkspace.errors()).hasErrors('Error'), 'Checking workspace errors')) {
    return createEmptyFetchChangeDueToError('Can not fetch from a workspace with errors.')
  }

  const getChangesEmitter = new StepEmitter()
  if (progressEmitter) {
    progressEmitter.emit('changesWillBeFetched', getChangesEmitter, fetchAccounts)
  }
  const otherElementsSource = fromState
    ? otherWorkspace.state(env)
    : (await otherWorkspace.elements(true, env))
  const fullElements = await log.time(async () =>
    awu(await (otherElementsSource).getAll())
      .filter(elem => fetchAccounts.includes(elem.elemID.adapter))
      .toArray(), 'Getting other workspace elements')
  const otherPathIndex = await log.time(async () =>
    otherWorkspace.state(env).getPathIndex(), 'Getting other workspace pathIndex')
  const inMemoryOtherPathIndex = await log.time(async () =>
    new remoteMap.InMemoryRemoteMap<pathIndex.Path[]>(
      await awu(otherPathIndex.entries()).toArray(),
    ), 'Saving pathIndex to memory')
  const splitByPathIndex = await log.time(async () =>
    (await withLimitedConcurrency(wu(fullElements).map(
      elem => () => pathIndex.splitElementByPath(elem, inMemoryOtherPathIndex)
    ), MAX_SPLIT_CONCURRENCY)).flat(), 'Splitting elements by PathIndex')
  const [unmergedWithPath, unmergedWithoutPath] = _.partition(
    splitByPathIndex,
    elem => values.isDefined(elem.path)
  )
  const splitByFile = await log.time(async () =>
    (await withLimitedConcurrency(
      wu(unmergedWithoutPath).map(elem => () => splitElementByFile(elem)),
      MAX_SPLIT_CONCURRENCY
    )).flat(), 'Splitting elements by files')
  const unmergedElements = [
    ...unmergedWithPath,
    ...splitByFile,
  ]
  const fetchChangesResult = await log.time(async () =>
    createFetchChanges({
      adapterNames: fetchAccounts,
      currentConfigs,
      getChangesEmitter,
      processErrorsResult: {
        keptElements: fullElements,
        errorsWithDroppedElements: [],
      },
      stateElements,
      workspaceElements,
      unmergedElements,
    }), 'Creating Fetch Changes')
  // We currently cannot access the content of static files from the state so when fetching
  // from the state we use the content from the NaCls, if there is a mis-match there we have
  // to drop the change
  // This will not be needed anymore once we have access to the state static file content
  return fromState
    ? log.time(async () =>
      fixStaticFilesForFromStateChanges(
        fetchChangesResult, otherWorkspace, env
      ), 'Fix state static files')
    : fetchChangesResult
}

const id = (elemID: ElemID): string => elemID.getFullName()

const getServiceIdsFromAnnotations = (annotationRefTypes: TypeMap, annotations: Values,
  elemID: ElemID): ServiceIds =>
  _(Object.entries(annotationRefTypes))
    .filter(([_annotationName, annotationRefType]) =>
      (isServiceId(annotationRefType)))
    .map(([annotationName, _annotationType]) =>
      [annotationName, annotations[annotationName] || id(elemID)])
    .fromPairs()
    .value()

const getObjectServiceId = async (objectType: ObjectType,
  elementsSource: ReadOnlyElementsSource): Promise<string> => {
  const serviceIds = getServiceIdsFromAnnotations(await objectType
    .getAnnotationTypes(elementsSource),
  objectType.annotations, objectType.elemID)
  if (_.isEmpty(serviceIds)) {
    serviceIds[OBJECT_NAME] = id(objectType.elemID)
  }
  return toServiceIdsString(serviceIds)
}


const getFieldServiceId = async (
  objectServiceId: string,
  field: Field,
  elementsSource: ReadOnlyElementsSource,
): Promise<string> => {
  const serviceIds = getServiceIdsFromAnnotations(
    (await (await field.getType(elementsSource)).getAnnotationTypes(elementsSource)),
    field.annotations,
    field.elemID
  )
  if (_.isEmpty(serviceIds)) {
    serviceIds[FIELD_NAME] = id(field.elemID)
  }
  serviceIds[OBJECT_SERVICE_ID] = objectServiceId
  return toServiceIdsString(serviceIds)
}

const getInstanceServiceId = async (
  instanceElement: InstanceElement,
  elementsSource: ReadOnlyElementsSource,
): Promise<string> => {
  const instType = await instanceElement.getType(elementsSource)
  const serviceIds = Object.fromEntries(await awu(Object.entries(instType.fields))
    .filter(async ([_fieldName, field]) =>
      (isServiceId(await field.getType(elementsSource))))
    .map(([fieldName, _field]) =>
      [fieldName, instanceElement.value[fieldName] || id(instanceElement.elemID)])
    .toArray())
  if (_.isEmpty(serviceIds)) {
    serviceIds[INSTANCE_NAME] = id(instanceElement.elemID)
  }
  serviceIds[OBJECT_SERVICE_ID] = await getObjectServiceId(instType, elementsSource)
  return toServiceIdsString(serviceIds)
}

export const generateServiceIdToStateElemId = async (
  elements: AsyncIterable<Element>,
  elementsSource: ReadOnlyElementsSource,
): Promise<Record<string, ElemID>> =>
  Object.fromEntries(await awu(elements)
    .filter(elem => isInstanceElement(elem) || isObjectType(elem))
    .flatMap(async elem => {
      if (isObjectType(elem)) {
        const objectServiceId = await getObjectServiceId(elem, elementsSource)
        const fieldPairs = await Promise.all(Object.values(elem.fields)
          .map(async field => [
            await getFieldServiceId(objectServiceId, field, elementsSource),
            field.elemID,
          ])) as [string, ElemID][]
        return [...fieldPairs, [objectServiceId, elem.elemID]]
      }
      return [[await getInstanceServiceId(elem as InstanceElement, elementsSource), elem.elemID]]
    })
    .toArray())

export const createElemIdGetter = async (
  elements: AsyncIterable<Element>,
  src: ReadOnlyElementsSource,
): Promise<ElemIdGetter> => {
  const serviceIdToStateElemId = await generateServiceIdToStateElemId(
    elements,
    src,
  )
  // Here we expect the serviceName to come from the service. So, it's not aware of the
  // account name of the relevant account. However, the map we search in was built to
  // accomodate this. The only thing we need is to make sure that we change the ElemID
  // we get from the map back to fit the service name.
  return (serviceName: string, serviceIds: ServiceIds, name: string): ElemID => {
    const elemID = serviceIdToStateElemId[toServiceIdsString(serviceIds)]
    return elemID !== undefined
      ? createAdapterReplacedID(elemID, serviceName)
      : new ElemID(serviceName, name)
  }
}

export const getFetchAdapterAndServicesSetup = async (
  workspace: Workspace,
  fetchServices: string[],
  accountToServiceNameMap: Record<string, string>,
  ignoreStateElemIdMapping?: boolean
): Promise<{
  adaptersCreatorConfigs: Record<string, AdapterOperationsContext>
  currentConfigs: InstanceElement[]
}> => {
  const elemIDGetters = ignoreStateElemIdMapping
    ? {}
    : await mapValuesAsync(accountToServiceNameMap, async (_service, account) =>
      createElemIdGetter(
        awu(await (await workspace.elements()).getAll()).filter(e => e.elemID.adapter === account),
        workspace.state()
      ))
  const adaptersCreatorConfigs = await getAdaptersCreatorConfigs(
    fetchServices,
    await workspace.accountCredentials(fetchServices),
    workspace.accountConfig.bind(workspace),
    await workspace.elements(),
    accountToServiceNameMap,
    elemIDGetters,
  )
  const currentConfigs = Object.values(adaptersCreatorConfigs)
    .map(creatorConfig => creatorConfig.config)
    .filter(config => !_.isUndefined(config)) as InstanceElement[]

  return { adaptersCreatorConfigs, currentConfigs }
}
