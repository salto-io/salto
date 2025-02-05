/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import wu from 'wu'
import _ from 'lodash'
import { EventEmitter } from 'pietile-eventemitter'
import {
  AdapterOperations,
  AdapterOperationsContext,
  AdditionChange,
  CORE_ANNOTATIONS,
  DetailedChange,
  DetailedChangeWithBaseChange,
  Element,
  ElemID,
  ElemIdGetter,
  FetchResult,
  Field,
  FIELD_NAME,
  getAuthorInformation,
  INSTANCE_NAME,
  InstanceElement,
  isAdditionChange,
  isAdditionOrModificationChange,
  isElement,
  isEqualElements,
  isInstanceElement,
  isModificationChange,
  isObjectType,
  isSaltoElementError,
  isServiceId,
  isStaticFile,
  ModificationChange,
  OBJECT_NAME,
  OBJECT_SERVICE_ID,
  ObjectType,
  ProgressReporter,
  ReadOnlyElementsSource,
  SaltoError,
  ServiceIds,
  StaticFile,
  toChange,
  toServiceIdsString,
  TypeMap,
  TypeReference,
  Value,
  Values,
  isRemovalChange,
  Adapter,
  Change,
  CompareOptions,
} from '@salto-io/adapter-api'
import {
  applyInstancesDefaults,
  buildElementsSourceFromElements,
  flattenElementStr,
  resolvePath,
  safeJsonStringify,
  setPath,
  toDetailedChangeFromBaseChange,
  WALK_NEXT_STEP,
  walkOnElement,
  WalkOnFunc,
  walkOnValue,
  elementAnnotationTypes,
  getDetailedChanges as getDetailedChangesFromChange,
  ERROR_MESSAGES,
} from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import {
  adaptersConfigSource as acs,
  createAdapterReplacedID,
  createPathIndexForElement,
  ElementSelector,
  elementSource,
  expressions,
  merger,
  pathIndex,
  ReferenceIndexEntry,
  remoteMap,
  isElementIdMatchSelectors,
  updateElementsWithAlternativeAccount,
  Workspace,
  flags,
} from '@salto-io/workspace'
import { collections, promises, types, values } from '@salto-io/lowerdash'
import { StepEvents } from './deploy'
import { getPlan } from './plan'
import { AdapterEvents, createAdapterProgressReporter } from './adapters/progress'
import { IDFilter } from './plan/plan'
import { getAdaptersCreatorConfigs } from './adapters'
import { mergeLists, mergeStaticFiles, mergeStrings } from './merge_content'
import { FetchChange, FetchChangeMetadata } from '../types'
import { calculateDiff } from './plan/diff'

const { awu, groupByAsync } = collections.asynciterable
const { mapValuesAsync } = promises.object
const { withLimitedConcurrency } = promises.array
const { mergeElements } = merger
const { isTypeOfOrUndefined } = types
const { getSaltoFlagBool, WORKSPACE_FLAGS } = flags
const log = logger(module)

const MAX_SPLIT_CONCURRENCY = 2000

// these core annotations are generated from other values of the element and are non-deployable.
// having conflicts on them have no real meaning so it's better to omit them.
// more context can be found in https://salto-io.atlassian.net/browse/SALTO-4888
const NO_CONFLICT_CORE_ANNOTATIONS = [
  CORE_ANNOTATIONS.ALIAS,
  CORE_ANNOTATIONS.PARENT,
  CORE_ANNOTATIONS.GENERATED_DEPENDENCIES,
]

const getFetchChangeMetadata = (changedElement: Element | undefined): FetchChangeMetadata =>
  getAuthorInformation(changedElement)

export const toAddFetchChange = (elem: Element): FetchChange => {
  const change = toDetailedChangeFromBaseChange(toChange({ after: elem }))
  return { change, serviceChanges: [change], metadata: getFetchChangeMetadata(elem) }
}

export class StepEmitter<T = void> extends EventEmitter<StepEvents<T>> {}

export type FetchProgressEvents = {
  adaptersDidInitialize: () => void
  changesWillBeFetched: (stepProgress: StepEmitter, adapterNames: string[]) => void
  diffWillBeCalculated: (stepProgress: StepEmitter) => void
  workspaceWillBeUpdated: (stepProgress: StepEmitter<number>, changes: number, approved: number) => void
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
  topLevelFilters: IDFilter[],
  compareOptions?: CompareOptions,
): Promise<DetailedChangeWithBaseChange[]> => {
  const changes = await calculateDiff({ before, after, topLevelFilters, compareOptions })
  return awu(changes)
    .map(change => getDetailedChangesFromChange(change))
    .flat()
    .toArray()
}

type WorkspaceDetailedChangeOrigin = 'service' | 'workspace'
type WorkspaceDetailedChange = {
  change: DetailedChangeWithBaseChange
  origin: WorkspaceDetailedChangeOrigin
}

type DetailedChangeTreeResult = {
  changesTree: collections.treeMap.TreeMap<WorkspaceDetailedChange>
  changes: DetailedChange[]
}

type PartiallyFetchedAccountData = {
  deletedElements?: Set<string>
}

const getDetailedChangeTree = async (
  before: ReadOnlyElementsSource,
  after: ReadOnlyElementsSource,
  topLevelFilters: IDFilter[],
  origin: WorkspaceDetailedChangeOrigin,
): Promise<DetailedChangeTreeResult> => {
  const changes = await getDetailedChanges(before, after, topLevelFilters)
  const changesTree = new collections.treeMap.TreeMap(
    changes.map(change => [change.id.getFullName(), [{ change, origin }]]),
  )
  return { changesTree, changes }
}

const findNestedElementPath = (
  changeElemID: ElemID,
  originalParentElements: Element[],
): readonly string[] | undefined => originalParentElements.find(e => !_.isUndefined(resolvePath(e, changeElemID)))?.path

type ChangeTransformFunction = (sourceChange: FetchChange) => Promise<FetchChange[]>
const toChangesWithPath =
  (accountElementByFullName: (id: ElemID) => Element[]): ChangeTransformFunction =>
  async change => {
    const changeID: ElemID = change.change.id
    if (isRemovalChange(change.change)) {
      return [change]
    }

    if (!changeID.isTopLevel()) {
      if (change.change.action === 'add') {
        const path = findNestedElementPath(changeID, accountElementByFullName(changeID.createTopLevelParentID().parent))
        log.trace(
          `addition change for nested ${changeID.idType} with id ${changeID.getFullName()}, path found ${path?.join('/')}`,
        )
        return path ? [_.merge({}, change, { change: { path } })] : [change]
      }
      // This is a modification change on a nested ID, path is not needed
      return [change]
    }

    const originalElements = accountElementByFullName(changeID)
    if (originalElements.length === 0) {
      log.debug('no original elements found for change element id %s', changeID.getFullName())
      return [change]
    }

    // Replace merged element with original elements that have a path hint
    return originalElements.map(elem => _.merge({}, change, { change: { data: { after: elem } } }))
  }

const addFetchChangeMetadata =
  (updatedElementSource: ReadOnlyElementsSource): ChangeTransformFunction =>
  async change => [
    {
      ...change,
      metadata: getFetchChangeMetadata(await updatedElementSource.get(change.change.id.createBaseID().parent)),
    },
  ]

type MergeableDiffChange = FetchChange & {
  serviceChanges: [ModificationChange<Value> | AdditionChange<Value>]
  pendingChanges: [ModificationChange<Value> | AdditionChange<Value>]
}
const isMergeableDiffChange = (change: FetchChange): change is MergeableDiffChange =>
  change.serviceChanges.length === 1 &&
  change.pendingChanges?.length === 1 &&
  change.change.id.isEqual(change.serviceChanges[0].id) &&
  change.change.id.isEqual(change.pendingChanges[0].id) &&
  isAdditionOrModificationChange(change.serviceChanges[0]) &&
  isAdditionOrModificationChange(change.pendingChanges[0])

const toMergedChange = (change: FetchChange, after: Value): FetchChange => ({
  ...change,
  change: {
    ...change.change,
    ...toChange({
      ...change.change.data,
      after,
    }),
  },
  pendingChanges: [],
})

const autoMergeChange: ChangeTransformFunction = async change => {
  if (!isMergeableDiffChange(change)) {
    return [change]
  }

  const changeId = change.change.id.getFullName()
  const current = change.pendingChanges[0].data.after
  const incoming = change.serviceChanges[0].data.after
  const base = isModificationChange(change.serviceChanges[0]) ? change.serviceChanges[0].data.before : undefined

  if (isStaticFile(current) && isStaticFile(incoming) && isTypeOfOrUndefined(base, isStaticFile)) {
    const merged = await mergeStaticFiles(changeId, { current, base, incoming })
    return [merged !== undefined ? toMergedChange(change, merged) : change]
  }
  if (_.isString(current) && _.isString(incoming) && isTypeOfOrUndefined(base, _.isString)) {
    const merged = mergeStrings(changeId, { current, base, incoming })
    return [merged !== undefined ? toMergedChange(change, merged) : change]
  }
  if (_.isArray(current) && _.isArray(incoming) && isTypeOfOrUndefined(base, _.isArray)) {
    const merged = mergeLists(changeId, { current, base, incoming })
    return [merged !== undefined ? toMergedChange(change, merged) : change]
  }
  return [change]
}

const omitNoConflictCoreAnnotationsPendingChanges: ChangeTransformFunction = async change => {
  if (_.isEmpty(change.pendingChanges) || change.change.id.isBaseID()) {
    return [change]
  }
  const {
    path: [name],
  } = change.change.id.createBaseID()
  if (NO_CONFLICT_CORE_ANNOTATIONS.includes(name)) {
    log.debug('omitting conflict on core annotation %s', change.change.id.getFullName())
    return [{ ...change, pendingChanges: [] }]
  }
  return [change]
}

/**
 * Creates a list modification change in a given id, when there's a list in that id in all sources.
 * This is required because that when the list in two of the sources have the same length, then one
 * of `wsChanges`/`serviceChanges`/`pendingChanges` will have changes on the list items, instead of the
 * whole list, that we need in order to auto-merge the list later.
 * This logic is skipped when the list's length is the same in all sources (so there will be changes on
 * each list item separately) or when `pendingChanges` is empty (and there's no conflict to auto-merge).
 */
const toListModificationChange = ({
  elemId,
  wsChanges,
  serviceChanges,
  pendingChanges,
}: {
  elemId: ElemID
  wsChanges: types.NonEmptyArray<DetailedChangeWithBaseChange>
  serviceChanges: types.NonEmptyArray<DetailedChangeWithBaseChange>
  pendingChanges: DetailedChangeWithBaseChange[]
}): FetchChange | undefined => {
  if (!types.isNonEmptyArray(pendingChanges)) {
    return undefined
  }

  const { baseChange } = wsChanges[0]
  const baseServiceChange = serviceChanges[0].baseChange
  const basePendingChange = pendingChanges[0].baseChange

  if (!isAdditionOrModificationChange(baseServiceChange) || !isAdditionOrModificationChange(basePendingChange)) {
    return undefined
  }

  const serviceElement = baseServiceChange.data.after
  const stateElement = isModificationChange(baseServiceChange) ? baseServiceChange.data.before : undefined
  const workspaceElement = basePendingChange.data.after

  const serviceValue = resolvePath(serviceElement, elemId)
  const stateValue = stateElement ? resolvePath(stateElement, elemId) : undefined
  const workspaceValue = resolvePath(workspaceElement, elemId)

  if (!_.isArray(workspaceValue) || !_.isArray(serviceValue) || !isTypeOfOrUndefined(stateValue, _.isArray)) {
    return undefined
  }

  return {
    change: {
      id: elemId,
      baseChange,
      ...toChange({ before: workspaceValue, after: serviceValue }),
    },
    serviceChanges: [
      {
        id: elemId,
        baseChange: baseServiceChange,
        ...toChange({ before: stateValue, after: serviceValue }),
      },
    ],
    pendingChanges: [
      {
        id: elemId,
        baseChange: basePendingChange,
        ...toChange({ before: stateValue, after: workspaceValue }),
      },
    ],
  }
}

const getChangesNestedUnderID = (
  id: ElemID,
  changesTree: collections.treeMap.TreeMap<WorkspaceDetailedChange>,
): WorkspaceDetailedChange[] =>
  wu(changesTree.valuesWithPrefix(id.getFullName()))
    .flatten(true)
    // Instance IDs are nested under the type ID in the tree, so we have to filter this
    .filter(item => id.isEqual(item.change.id) || id.isParentOf(item.change.id))
    .toArray()

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

      const relatedChanges = getChangesNestedUnderID(elemId, serviceAndPendingChanges)
      // Mark all changes that relate to the current ID as handled
      relatedChanges.forEach(change => handledChangeIDs.add(change.change.id.getFullName()))

      const [serviceChanges, pendingChanges] = _.partition(relatedChanges, change => change.origin === 'service').map(
        changeList => changeList.map(change => change.change),
      )
      // Service-to-workspace diffs for a given element are only computed when pending changes exist for that element.
      // When there are no pending changes, the state and workspace are already aligned, so we can reuse service changes
      // as workspace changes. We are guaranteed no conflicts, so we can return early here. This reuse relies on the
      // assumption that reference expressions in the state element source used to compute the diff are *not* resolved.
      if (pendingChanges.length === 0) {
        return serviceChanges.map(change => ({ change, serviceChanges, pendingChanges: [] }))
      }

      const wsChanges = getChangesNestedUnderID(elemId, workspaceToServiceChanges).map(({ change }) => change)
      if (!types.isNonEmptyArray(wsChanges)) {
        // If we get here it means there is a difference between the account and the state
        // but there is no difference between the account and the workspace. this can happen
        // when the nacl files are updated externally (from git usually) with the change that
        // happened in the account. so the nacl is already aligned with the account and we don't
        // have to do anything here
        log.debug('account change on %s already updated in workspace', id)
        return undefined
      }

      if (!types.isNonEmptyArray(serviceChanges)) {
        // If nothing changed in the account, we don't want to do anything
        return undefined
      }

      if (pendingChanges.length > 0) {
        log.debug(
          'Found conflict on %s between %d service changes and %d pending changes. service change ids: %o, pending change ids: %o',
          id,
          serviceChanges.length,
          pendingChanges.length,
          serviceChanges.map(change => `${change.action} ${change.id.getFullName()}`),
          pendingChanges.map(change => `${change.action} ${change.id.getFullName()}`),
        )
      }

      const listModificationChange = toListModificationChange({ elemId, wsChanges, serviceChanges, pendingChanges })
      if (listModificationChange !== undefined) {
        return [listModificationChange]
      }

      const createFetchChange = (change: DetailedChangeWithBaseChange): FetchChange => {
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
  changes: FetchChange[]
  serviceToStateChanges: DetailedChange[]
  elements: Element[]
  errors: SaltoError[]
  unmergedElements: Element[]
  mergeErrors: MergeErrorWithElements[]
  updatedConfig: Record<string, InstanceElement[]>
  configChanges: Change[]
  accountNameToConfigMessage?: Record<string, string>
  partiallyFetchedAccounts: Set<string>
}

type ProcessMergeErrorsResult = {
  keptElements: Element[]
  errorsWithDroppedElements: MergeErrorWithElements[]
}

const processMergeErrors = async (
  elements: AsyncIterable<Element>,
  errors: merger.MergeError[],
  stateElements: elementSource.ElementsSource,
): Promise<ProcessMergeErrorsResult> =>
  log.timeDebug(
    async () => {
      const mergeErrsByElemID = _(errors)
        .map(me => [me.elemID.createTopLevelParentID().parent.getFullName(), { error: me, elements: [] }])
        .fromPairs()
        .value() as Record<string, MergeErrorWithElements>
      const errorsWithDroppedElements: MergeErrorWithElements[] = []
      const errorsWithStateElements: MergeErrorWithElements[] = []
      const keptElements = await awu(elements)
        .filter(async e => {
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
        })
        .toArray()
      return {
        keptElements,
        errorsWithDroppedElements,
      }
    },
    'process merge errors for %o errors',
    errors.length,
  )

type UpdatedConfig = {
  config: InstanceElement[]
  message: string
}

type AdapterOperationsWithPostFetch = types.PickyRequired<AdapterOperations, 'postFetch'>

const isAdapterOperationsWithPostFetch = (v: AdapterOperations): v is AdapterOperationsWithPostFetch =>
  v.postFetch !== undefined

const runPostFetch = async ({
  adapters,
  accountElements,
  stateElementsByAccount,
  partiallyFetchedAccountData,
  accountToServiceNameMap,
  progressReporters,
}: {
  adapters: Record<string, AdapterOperationsWithPostFetch>
  accountElements: Element[]
  stateElementsByAccount: Record<string, ReadonlyArray<Element>>
  partiallyFetchedAccountData: Map<string, PartiallyFetchedAccountData>
  accountToServiceNameMap: Record<string, string>
  progressReporters: Record<string, ProgressReporter>
}): Promise<void> => {
  const serviceElementsByAccount = _.groupBy(accountElements, e => e.elemID.adapter)
  const getAdapterElements = (accountName: string): ReadonlyArray<Element> => {
    if (!partiallyFetchedAccountData.has(accountName)) {
      return serviceElementsByAccount[accountName] ?? stateElementsByAccount[accountName]
    }
    const fetchedIDs = new Set(serviceElementsByAccount[accountName].map(e => e.elemID.getFullName()))
    const missingElements = stateElementsByAccount[accountName]
      .filter(e => !fetchedIDs.has(e.elemID.getFullName()))
      .filter(e => !partiallyFetchedAccountData.get(accountName)?.deletedElements?.has(e.elemID.getFullName()))
    return [...serviceElementsByAccount[accountName], ...missingElements]
  }
  const elementsByAccount = Object.fromEntries(
    [...new Set([...Object.keys(stateElementsByAccount), ...Object.keys(serviceElementsByAccount)])].map(
      accountName => [accountName, getAdapterElements(accountName)],
    ),
  )
  // only modifies elements in-place, done sequentially to avoid race conditions
  await promises.array.series(
    Object.entries(adapters).map(
      ([adapterName, adapter]) =>
        async () =>
          adapter.postFetch({
            currentAdapterElements: serviceElementsByAccount[adapterName],
            elementsByAccount,
            accountToServiceNameMap,
            progressReporter: progressReporters[adapterName],
          }),
    ),
  )
}

// SALTO-5878 safety due to changed order of precedence when resolving referenced values / types - can remove if we don't see this log
const updateInconsistentTypes = (validAccountElements: Element[]): void =>
  log.timeDebug(() => {
    const objectTypesByElemID = _.keyBy(validAccountElements.filter(isObjectType), e => e.elemID.getFullName())
    const isInconsistentType = (e: InstanceElement | Field): boolean =>
      e.refType.type !== undefined &&
      objectTypesByElemID[e.refType.elemID.getFullName()] !== undefined &&
      !isEqualElements(e.refType.type, objectTypesByElemID[e.refType.elemID.getFullName()])
    const fields = Object.values(objectTypesByElemID)
      .flatMap(obj => Object.values(obj.fields))
      .filter(f => isObjectType(f.refType.type))
    const elementsWithInconsistentTypes: (InstanceElement | Field)[] = validAccountElements
      .filter(isInstanceElement)
      .filter(isInconsistentType)
    fields.forEach(f => {
      if (isInconsistentType(f)) {
        elementsWithInconsistentTypes.push(f)
      }
    })

    if (elementsWithInconsistentTypes.length > 0) {
      log.warn(
        'found inconsistent types in the following %d types (%d elements), the types will be resolved from the element source. %s',
        _.uniq(elementsWithInconsistentTypes.map(e => e.refType.elemID.getFullName())).length,
        elementsWithInconsistentTypes.length,
        elementsWithInconsistentTypes.map(e => e.elemID.getFullName()).join(','),
      )
      elementsWithInconsistentTypes.forEach(e => {
        e.refType = new TypeReference(e.refType.elemID)
      })
    }
  }, 'looking for inconsistent types (SALTO-5878)')

const fetchAndProcessMergeErrors = async (
  accountsToAdapters: Record<string, AdapterOperations>,
  stateElements: elementSource.ElementsSource,
  accountToServiceNameMap: Record<string, string>,
  getChangesEmitter: StepEmitter,
  progressEmitter?: EventEmitter<FetchProgressEvents>,
  withChangesDetection?: boolean,
): Promise<{
  accountElements: Element[]
  errors: SaltoError[]
  processErrorsResult: ProcessMergeErrorsResult
  updatedConfigs: UpdatedConfig[]
  partiallyFetchedAccountData: Map<string, PartiallyFetchedAccountData>
}> => {
  const updateConfigAccountName = async (
    configs: InstanceElement[],
    accountName: string,
    service: string,
  ): Promise<InstanceElement[]> => {
    // resolve is used as a clone that keeps references between clones intact
    const configClones = (await expressions.resolve(configs, buildElementsSourceFromElements([]))).filter(
      isInstanceElement,
    )
    await updateElementsWithAlternativeAccount(configClones, accountName, service)
    return configClones
  }
  const updateErrorAccountNames = async (errors: SaltoError[], accountName: string): Promise<void> => {
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
    fetchResult.elements = await expressions.resolve(fetchResult.elements, stateElements)
    await updateElementsWithAlternativeAccount(fetchResult.elements, accountName, service)
    if (fetchResult.updatedConfig) {
      fetchResult.updatedConfig.config = await updateConfigAccountName(
        fetchResult.updatedConfig.config,
        accountName,
        service,
      )
    }
    if (fetchResult.errors) {
      await updateErrorAccountNames(fetchResult.errors, accountName)
    }
  }
  try {
    const progressReporters = _.mapValues(accountsToAdapters, (_adapter, accountName) =>
      createAdapterProgressReporter(accountName, 'fetch', progressEmitter),
    )
    const fetchResults = await Promise.all(
      Object.entries(accountsToAdapters).map(async ([accountName, adapter]) => {
        if (withChangesDetection) {
          log.debug('Running fetch with changes detection for account %s', accountName)
        }
        const fetchResult = await adapter.fetch({
          progressReporter: progressReporters[accountName],
          withChangesDetection,
        })
        const { updatedConfig, errors, partialFetchData } = fetchResult
        if (updatedConfig !== undefined) {
          log.debug(
            `In account: ${accountName}, received config suggestions for the following reasons: ${updatedConfig.message}`,
          )
        }
        if (fetchResult.elements.length > 0 && accountName !== accountToServiceNameMap[accountName]) {
          await handleAccountNameUpdate(fetchResult, accountName, accountToServiceNameMap[accountName])
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
                accountName,
              }
            : undefined,
          partialFetchData,
          accountName,
        }
      }),
    )
    const accountElements = _.flatten(fetchResults.map(res => res.elements))
    const fetchErrors = fetchResults.flatMap(res => res.errors)
    const updatedConfigs = fetchResults
      .map(res => res.updatedConfig)
      .filter(values.isDefined)
      .map(({ config, message, accountName }) => ({
        config,
        message: _.isEmpty(message)
          ? ''
          : `Issues which triggered changes in ${[...acs.CONFIG_PATH, accountName].join('/')}:\n${message}`,
      })) as UpdatedConfig[]

    const partiallyFetchedAccountData = new Map(
      fetchResults
        .filter(result => result.partialFetchData?.isPartial ?? false)
        .map(result => [
          result.accountName,
          { deletedElements: new Set(result.partialFetchData?.deletedElements?.map(elem => elem.getFullName())) },
        ]),
    )
    log.debug(`fetched ${accountElements.length} elements from adapters`)
    const stateElementsByAccount = await groupByAsync(await stateElements.getAll(), elem => elem.elemID.adapter)
    const adaptersWithPostFetch = _.pickBy(accountsToAdapters, isAdapterOperationsWithPostFetch)
    if (!_.isEmpty(adaptersWithPostFetch)) {
      try {
        // update elements based on fetch results from other services
        await runPostFetch({
          adapters: adaptersWithPostFetch,
          accountElements,
          stateElementsByAccount,
          partiallyFetchedAccountData,
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
      processErrorsResult.errorsWithDroppedElements.flatMap(err =>
        err.elements.map(e => e.elemID.createTopLevelParentID().parent.getFullName()),
      ),
    )
    const validAccountElements = accountElements.filter(e => !droppedElements.has(e.elemID.getFullName()))
    log.debug(
      `after merge there are ${processErrorsResult.keptElements.length} elements [errors=${mergeErrorsArr.length}]`,
    )

    updateInconsistentTypes(validAccountElements)

    return {
      accountElements: validAccountElements,
      errors: fetchErrors,
      processErrorsResult,
      updatedConfigs,
      partiallyFetchedAccountData,
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
    await awu(await elements.list())
      .map(elemID => elemID.adapter)
      .toArray(),
  )
  return collections.set.difference(partiallyFetchedAdapters, adaptersWithElements)
}

type CalcFetchChangesResult = {
  changes: FetchChange[]
  serviceToStateChanges: DetailedChange[]
}

type DetailedChangeTreesResults = {
  serviceChanges: collections.treeMap.TreeMap<WorkspaceDetailedChange>
  pendingChanges: collections.treeMap.TreeMap<WorkspaceDetailedChange>
  workspaceToServiceChanges: collections.treeMap.TreeMap<WorkspaceDetailedChange>
  serviceToStateChanges: DetailedChange[]
}

// Calculate the fetch changes - calculation should be done only if workspace has data,
// o/w all account elements should be consider as "add" changes.
export const calcFetchChanges = async ({
  accountElements,
  mergedAccountElements,
  stateElements,
  workspaceElements,
  partiallyFetchedAccounts,
  allFetchedAccounts,
  calculatePendingChanges = true,
}: {
  accountElements: ReadonlyArray<Element>
  mergedAccountElements: ReadonlyArray<Element>
  stateElements: elementSource.ElementsSource
  workspaceElements: ReadOnlyElementsSource
  partiallyFetchedAccounts: Map<string, PartiallyFetchedAccountData>
  allFetchedAccounts: Set<string>
  calculatePendingChanges?: boolean
}): Promise<CalcFetchChangesResult> => {
  const mergedAccountElementsSource = elementSource.createInMemoryElementSource(mergedAccountElements)

  const partialFetchFilter: IDFilter = id =>
    !partiallyFetchedAccounts.has(id.adapter) ||
    partiallyFetchedAccounts.get(id.adapter)?.deletedElements?.has(id.getFullName()) ||
    mergedAccountElementsSource.has(id)
  const accountFetchFilter: IDFilter = id => allFetchedAccounts.has(id.adapter)
  const partialFetchElementSource: ReadOnlyElementsSource = {
    get: async (id: ElemID): Promise<Element | undefined> => {
      const mergedElem = await mergedAccountElementsSource.get(id)
      if (
        mergedElem === undefined &&
        partiallyFetchedAccounts.has(id.adapter) &&
        !partiallyFetchedAccounts.get(id.adapter)?.deletedElements?.has(id.getFullName())
      ) {
        // Use the same element source as the fetch runs with, see `getFetchAdapterAndServicesSetup`
        return workspaceElements.get(id)
      }
      return mergedElem
    },
    getAll: () => mergedAccountElementsSource.getAll(),
    has: id => mergedAccountElementsSource.has(id),
    list: () => mergedAccountElementsSource.list(),
  }

  // If the state is empty, no need to do all calculations, and just the workspaceToServiceChanges is enough
  const calculateChangesWithEmptyState = async (): Promise<DetailedChangeTreesResults> => {
    const { changesTree: workspaceToServiceChanges } = await log.timeDebug(
      () =>
        getDetailedChangeTree(
          workspaceElements,
          partialFetchElementSource,
          [accountFetchFilter, partialFetchFilter],
          'service',
        ),
      'calculate service-workspace changes',
    )

    return {
      serviceChanges: workspaceToServiceChanges,
      pendingChanges: new collections.treeMap.TreeMap(),
      workspaceToServiceChanges,
      serviceToStateChanges: mergedAccountElements.map(toAddFetchChange).map(change => change.change),
    }
  }

  const calculateChangesWithState = async (): Promise<DetailedChangeTreesResults> => {
    // Changes from the service that are not in the state
    const { changesTree: serviceChanges, changes: serviceToStateChanges } = await log.timeDebug(
      () =>
        getDetailedChangeTree(
          stateElements,
          partialFetchElementSource,
          [accountFetchFilter, partialFetchFilter],
          'service',
        ),
      'calculate service-state changes',
    )

    // We only care about conflicts with changes from the service, so for the next comparison
    // we only need to check elements for which we have service changes
    const serviceChangesTopLevelIDs = new Set(
      wu(serviceChanges.values()).map(changes => changes[0].change.id.createTopLevelParentID().parent.getFullName()),
    )
    const serviceChangeIdsFilter: IDFilter = id => serviceChangesTopLevelIDs.has(id.getFullName())

    // Changes from the nacls that are not in the state
    const { changesTree: pendingChanges } = await log.timeDebug(
      () =>
        getDetailedChangeTree(
          stateElements,
          workspaceElements,
          [accountFetchFilter, partialFetchFilter, serviceChangeIdsFilter],
          'workspace',
        ),
      'calculate pending changes',
    )

    // Workspace to service changes are only interesting for the elements that have pending changes -
    // otherwise the diff will be the same as the service-to-state diff, so we avoid recalculating it by only checking
    // elements that have pending changes.
    const pendingChangesTopLevelIDs = new Set(
      wu(pendingChanges.values()).map(changes => changes[0].change.id.createTopLevelParentID().parent.getFullName()),
    )
    const pendingChangeIdsFilter: IDFilter = id => pendingChangesTopLevelIDs.has(id.getFullName())

    // Changes from the service that are not in the nacls
    const { changesTree: workspaceToServiceChanges } = await log.timeDebug(
      () =>
        getDetailedChangeTree(
          workspaceElements,
          partialFetchElementSource,
          [accountFetchFilter, partialFetchFilter, pendingChangeIdsFilter],
          'service',
        ),
      'calculate service-workspace changes',
    )

    return {
      serviceChanges,
      pendingChanges,
      workspaceToServiceChanges,
      serviceToStateChanges,
    }
  }

  const { serviceChanges, pendingChanges, workspaceToServiceChanges, serviceToStateChanges } = calculatePendingChanges
    ? await calculateChangesWithState()
    : await calculateChangesWithEmptyState()

  // Merge pending changes and service changes into one tree so we can find conflicts between them
  serviceChanges.merge(pendingChanges)
  const fetchChanges = toFetchChanges(serviceChanges, workspaceToServiceChanges)
  const serviceElementsMap = _.groupBy(accountElements, e => e.elemID.getFullName())

  const changes = await awu(fetchChanges)
    .flatMap(omitNoConflictCoreAnnotationsPendingChanges)
    .flatMap(autoMergeChange)
    .flatMap(toChangesWithPath(name => serviceElementsMap[name.getFullName()] ?? []))
    .flatMap(addFetchChangeMetadata(partialFetchElementSource))
    .toArray()
  return { changes, serviceToStateChanges }
}

const createFirstFetchChanges = async (
  unmergedElements: Element[],
  mergedElements: Element[],
): Promise<CalcFetchChangesResult> => ({
  changes: unmergedElements.map(toAddFetchChange),
  serviceToStateChanges: mergedElements.map(toAddFetchChange).map(change => change.change),
})

type CreateFetchChangesParams = {
  adapterNames: string[]
  workspaceElements: elementSource.ElementsSource
  stateElements: elementSource.ElementsSource
  unmergedElements: Element[]
  processErrorsResult: ProcessMergeErrorsResult
  currentConfigs: InstanceElement[]
  getChangesEmitter: StepEmitter
  partiallyFetchedAccountData: Map<string, PartiallyFetchedAccountData>
  updatedConfigs?: UpdatedConfig[]
  errors?: SaltoError[]
  progressEmitter?: EventEmitter<FetchProgressEvents>
}
const createFetchChanges = async ({
  adapterNames,
  workspaceElements,
  stateElements,
  unmergedElements,
  processErrorsResult,
  currentConfigs,
  getChangesEmitter,
  partiallyFetchedAccountData,
  updatedConfigs = [],
  errors = [],
  progressEmitter,
}: CreateFetchChangesParams): Promise<FetchChangesResult> => {
  const calculateDiffEmitter = new StepEmitter()
  if (progressEmitter) {
    getChangesEmitter.emit('completed')
    progressEmitter.emit('diffWillBeCalculated', calculateDiffEmitter)
  }
  const isFirstFetch = await awu(await workspaceElements.list())
    .concat(await stateElements.list())
    .filter(e => !e.isConfigType())
    .isEmpty()

  // When we init a new env, the state will be empty, but the workspace can already have elements in common.
  // In that case we shouldn't calculate pending changes, otherwise there would be conflicts
  // between the fetched elements and the elements in common.
  const calculatePendingChanges = !(await stateElements.isEmpty())

  const { changes, serviceToStateChanges } = isFirstFetch
    ? await createFirstFetchChanges(unmergedElements, processErrorsResult.keptElements)
    : await calcFetchChanges({
        accountElements: unmergedElements,
        mergedAccountElements: processErrorsResult.keptElements,
        stateElements,
        workspaceElements,
        partiallyFetchedAccounts: partiallyFetchedAccountData,
        allFetchedAccounts: new Set(adapterNames),
        calculatePendingChanges,
      })
  log.debug('finished to calculate fetch changes')
  if (progressEmitter) {
    calculateDiffEmitter.emit('completed')
  }

  const configsMerge = await mergeElements(awu(updatedConfigs.flatMap(c => c.config)))

  const errorMessages = await awu(configsMerge.errors.entries())
    .flatMap(err => err.value)
    .map(err => err.detailedMessage)
    .toArray()
  if (errorMessages.length !== 0) {
    throw new Error(`Received configuration merge errors: ${errorMessages.join(', ')}`)
  }

  const configs = await awu(configsMerge.merged.values()).toArray()
  const updatedConfigNames = new Set(configs.map(c => c.elemID.getFullName()))
  if (getSaltoFlagBool(WORKSPACE_FLAGS.replaceGetPlanWithCalculateDiff)) {
    log.trace('Using calculateDiff instead of getPlan to compute config changes')
  }
  const configChanges = getSaltoFlagBool(WORKSPACE_FLAGS.replaceGetPlanWithCalculateDiff)
    ? await awu(
        await calculateDiff({
          before: elementSource.createInMemoryElementSource(
            currentConfigs.filter(config => updatedConfigNames.has(config.elemID.getFullName())),
          ),
          after: elementSource.createInMemoryElementSource(configs),
        }),
      ).toArray()
    : Array.from(
        (
          await getPlan({
            before: elementSource.createInMemoryElementSource(
              currentConfigs.filter(config => updatedConfigNames.has(config.elemID.getFullName())),
            ),
            after: elementSource.createInMemoryElementSource(configs),
          })
        ).itemsByEvalOrder(),
      ).flatMap(item => Array.from(item.changes()))

  const accountNameToConfig = _.keyBy(updatedConfigs, config => config.config[0].elemID.adapter)
  const accountNameToConfigMessage = _.mapValues(accountNameToConfig, config => config.message)

  const elements =
    partiallyFetchedAccountData.size !== 0
      ? _(await awu(await stateElements.getAll()).toArray())
          .filter(e => partiallyFetchedAccountData.has(e.elemID.adapter))
          .unshift(...processErrorsResult.keptElements)
          .filter(e => !partiallyFetchedAccountData.get(e.elemID.adapter)?.deletedElements?.has(e.elemID.getFullName()))
          .uniqBy(e => e.elemID.getFullName())
          .value()
      : processErrorsResult.keptElements
  return {
    changes,
    serviceToStateChanges,
    elements,
    errors,
    unmergedElements,
    mergeErrors: processErrorsResult.errorsWithDroppedElements,
    configChanges,
    updatedConfig: _.mapValues(accountNameToConfig, config => config.config),
    accountNameToConfigMessage,
    partiallyFetchedAccounts: new Set(partiallyFetchedAccountData.keys()),
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
  withChangesDetection?: boolean,
): Promise<FetchChangesResult> => {
  const accountNames = _.keys(accountsToAdapters)
  const getChangesEmitter = new StepEmitter()
  if (progressEmitter) {
    progressEmitter.emit('changesWillBeFetched', getChangesEmitter, accountNames)
  }
  const { accountElements, errors, processErrorsResult, updatedConfigs, partiallyFetchedAccountData } =
    await fetchAndProcessMergeErrors(
      accountsToAdapters,
      stateElements,
      accountToServiceNameMap,
      getChangesEmitter,
      progressEmitter,
      withChangesDetection,
    )

  const adaptersFirstFetchPartial = await getAdaptersFirstFetchPartial(
    stateElements,
    new Set(partiallyFetchedAccountData.keys()),
  )
  adaptersFirstFetchPartial.forEach(adapter => log.warn('Received partial results from %s before full fetch', adapter))
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
    partiallyFetchedAccountData,
  })
}

const createEmptyFetchChangeDueToError = (errMsg: string): FetchChangesResult => {
  log.warn(`creating empty fetch result due to ${errMsg}`)
  return {
    changes: [],
    serviceToStateChanges: [],
    elements: [],
    mergeErrors: [],
    unmergedElements: [],
    configChanges: [],
    updatedConfig: {},
    errors: [
      {
        message: ERROR_MESSAGES.OTHER_ISSUES,
        detailedMessage: errMsg,
        severity: 'Error',
      },
    ],
    partiallyFetchedAccounts: new Set(),
  }
}

type StaticFileAndElemID = { elemID: ElemID; staticFile: StaticFile }

const getPathsToStaticFiles = (value: Element | Value, elemId: ElemID): StaticFileAndElemID[] => {
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
  const filteredChanges = fetchChangesResult.changes
    .map(fetchChange => fetchChange.change)
    .filter(isAdditionOrModificationChange)
  await awu(filteredChanges).forEach(async change => {
    const staticFiles = getPathsToStaticFiles(change.data.after, change.id)
    const changePath = change.id.createTopLevelParentID().path
    await awu(staticFiles).forEach(async ({ elemID: staticFileValElemID, staticFile }) => {
      const actualStaticFile = await otherWorkspace.getStaticFile({
        filepath: staticFile.filepath,
        encoding: staticFile.encoding,
        env,
        isTemplate: staticFile.isTemplate,
      })
      if (!isStaticFile(actualStaticFile) || !actualStaticFile.isEqual(staticFile)) {
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
      const relativePath = staticFilePath.slice(changePath.length)
      _.set(change.data.after, relativePath, actualStaticFile)
    })
  })
  return {
    ...fetchChangesResult,
    changes: fetchChangesResult.changes.filter(change => !invalidChangeIDs.has(change.change.id.getFullName())),
    errors: fetchChangesResult.errors.concat(
      Array.from(invalidChangeIDs).map(invalidChangeElemID => ({
        message: ERROR_MESSAGES.OTHER_ISSUES,
        detailedMessage: `Dropping changes in element: ${invalidChangeElemID} due to static files hashes mismatch`,
        severity: 'Error',
      })),
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
  const getDifferentConfigs = async (): Promise<InstanceElement[]> =>
    awu(currentConfigs)
      .filter(async config => {
        const otherConfig = await otherWorkspace.accountConfig(config.elemID.adapter)
        return !otherConfig || !otherConfig.isEqual(config)
      })
      .toArray()

  if (env && !otherWorkspace.envs().includes(env)) {
    return createEmptyFetchChangeDueToError(`${env} env does not exist in the source workspace.`)
  }

  const otherAccounts = otherWorkspace.accounts(env)
  const missingAccounts = fetchAccounts.filter(account => !otherAccounts.includes(account))

  if (missingAccounts.length > 0) {
    return createEmptyFetchChangeDueToError(
      `Source env does not contain the following accounts: ${missingAccounts.join(',')}`,
    )
  }

  const differentConfig = await log.timeDebug(async () => getDifferentConfigs(), 'Getting workspace configs')
  if (!_.isEmpty(differentConfig)) {
    const configsByAdapter = _.groupBy([...differentConfig, ...currentConfigs], config => config.elemID.adapter)
    Object.entries(configsByAdapter).forEach(([adapter, configs]) => {
      log.warn(`Found different configs for ${adapter} - 
      ${configs.map(config => safeJsonStringify(config.value, undefined, 2)).join('\n')}`)
    })
  }
  if (
    !fromState &&
    (await log.timeDebug(async () => (await otherWorkspace.errors()).hasErrors('Error'), 'Checking workspace errors'))
  ) {
    return createEmptyFetchChangeDueToError('Can not fetch from a workspace with errors.')
  }

  const getChangesEmitter = new StepEmitter()
  if (progressEmitter) {
    progressEmitter.emit('changesWillBeFetched', getChangesEmitter, fetchAccounts)
  }
  const otherElementsSource = fromState ? otherWorkspace.state(env) : await otherWorkspace.elements(true, env)
  const fullElements = await log.timeDebug(
    async () =>
      awu(await otherElementsSource.getAll())
        .filter(elem => fetchAccounts.includes(elem.elemID.adapter))
        .toArray(),
    'Getting other workspace elements',
  )
  const otherPathIndex = await log.timeDebug(
    async () => otherWorkspace.state(env).getPathIndex(),
    'Getting other workspace pathIndex',
  )
  const inMemoryOtherPathIndex = await log.timeDebug(
    async () => new remoteMap.InMemoryRemoteMap<pathIndex.Path[]>(await awu(otherPathIndex.entries()).toArray()),
    'Saving pathIndex to memory',
  )
  const splitByPathIndex = await log.timeDebug(
    async () =>
      (
        await withLimitedConcurrency(
          wu(fullElements).map(elem => () => pathIndex.splitElementByPath(elem, inMemoryOtherPathIndex)),
          MAX_SPLIT_CONCURRENCY,
        )
      ).flat(),
    'Splitting elements by PathIndex',
  )
  const [unmergedWithPath, unmergedWithoutPath] = _.partition(splitByPathIndex, elem => values.isDefined(elem.path))
  const splitByFile = await log.timeDebug(
    async () =>
      (
        await withLimitedConcurrency(
          wu(unmergedWithoutPath).map(
            elem => async () =>
              pathIndex.splitElementByPath(elem, await createPathIndexForElement(otherWorkspace, elem.elemID)),
          ),
          MAX_SPLIT_CONCURRENCY,
        )
      ).flat(),
    'Splitting elements by files',
  )
  const unmergedElements = [...unmergedWithPath, ...splitByFile]
  const fetchChangesResult = await log.timeDebug(
    async () =>
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
        partiallyFetchedAccountData: new Map(),
      }),
    'Creating Fetch Changes',
  )
  // We currently cannot access the content of static files from the state so when fetching
  // from the state we use the content from the NaCls, if there is a mis-match there we have
  // to drop the change
  // This will not be needed anymore once we have access to the state static file content
  return fromState
    ? log.timeDebug(
        async () => fixStaticFilesForFromStateChanges(fetchChangesResult, otherWorkspace, env),
        'Fix state static files',
      )
    : fetchChangesResult
}

const id = (elemID: ElemID): string => elemID.getFullName()

const getServiceIdsFromAnnotations = (annotationRefTypes: TypeMap, annotations: Values, elemID: ElemID): ServiceIds =>
  _(Object.entries(annotationRefTypes))
    .filter(([_annotationName, annotationRefType]) => isServiceId(annotationRefType))
    .map(([annotationName, _annotationType]) => [annotationName, annotations[annotationName] || id(elemID)])
    .fromPairs()
    .value()

const getObjectServiceId = async (objectType: ObjectType, elementsSource: ReadOnlyElementsSource): Promise<string> => {
  const serviceIds = getServiceIdsFromAnnotations(
    await elementAnnotationTypes(objectType, elementsSource),
    objectType.annotations,
    objectType.elemID,
  )
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
    await elementAnnotationTypes(field, elementsSource),
    field.annotations,
    field.elemID,
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
  const serviceIds = Object.fromEntries(
    await awu(Object.entries(instType.fields))
      .filter(async ([_fieldName, field]) => isServiceId(await field.getType(elementsSource)))
      .map(([fieldName, _field]) => [fieldName, instanceElement.value[fieldName] || id(instanceElement.elemID)])
      .toArray(),
  )
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
  Object.fromEntries(
    await awu(elements)
      .filter(elem => isInstanceElement(elem) || isObjectType(elem))
      .flatMap(async elem => {
        if (isObjectType(elem)) {
          const objectServiceId = await getObjectServiceId(elem, elementsSource)
          const fieldPairs = await Promise.all(
            Object.values(elem.fields).map(async field => [
              await getFieldServiceId(objectServiceId, field, elementsSource),
              field.elemID,
            ]),
          )
          return [...fieldPairs, [objectServiceId, elem.elemID]]
        }
        return [[await getInstanceServiceId(elem as InstanceElement, elementsSource), elem.elemID]]
      })
      .toArray(),
  )

const createElemIdGetter = async (
  elements: AsyncIterable<Element>,
  elementsSource: ReadOnlyElementsSource,
): Promise<ElemIdGetter> => {
  const serviceIdToStateElemId = await generateServiceIdToStateElemId(elements, elementsSource)
  // Here we expect the serviceName to come from the service. So, it's not aware of the
  // account name of the relevant account. However, the map we search in was built to
  // accommodate this. The only thing we need is to make sure that we change the ElemID
  // we get from the map back to fit the service name.
  return (serviceName: string, serviceIds: ServiceIds, name: string): ElemID => {
    const elemID = serviceIdToStateElemId[toServiceIdsString(serviceIds)]
    return elemID !== undefined ? createAdapterReplacedID(elemID, serviceName) : new ElemID(serviceName, name)
  }
}

const getElementsToMaintain = async ({
  accountToServiceNameMap,
  account,
  elementsSource,
  ignoreStateElemIdMapping,
  ignoreStateElemIdMappingForSelectors,
  referenceSourcesIndex,
}: {
  accountToServiceNameMap: Record<string, string>
  account: string
  elementsSource: ReadOnlyElementsSource
  ignoreStateElemIdMapping: boolean
  ignoreStateElemIdMappingForSelectors: ElementSelector[]
  referenceSourcesIndex: remoteMap.ReadOnlyRemoteMap<ReferenceIndexEntry[]>
}): Promise<AsyncIterable<Element>> => {
  const maintainAllElements = !ignoreStateElemIdMapping || ignoreStateElemIdMappingForSelectors.length === 0

  if (maintainAllElements && Object.keys(accountToServiceNameMap).length === 1) {
    return elementsSource.getAll()
  }

  const accountElementIDs = awu(await elementsSource.list()).filter(elemId => elemId.adapter === account)
  const elementIDsToMaintain = maintainAllElements
    ? accountElementIDs
    : accountElementIDs.filter(
        async elemId =>
          !(await isElementIdMatchSelectors({
            elemId,
            selectors: ignoreStateElemIdMappingForSelectors,
            referenceSourcesIndex,
          })),
      )

  return elementIDsToMaintain.map(elemId => elementsSource.get(elemId))
}

export const createElemIdGetters = async ({
  workspace,
  accountToServiceNameMap,
  elementsSource,
  ignoreStateElemIdMapping,
  ignoreStateElemIdMappingForSelectors,
}: {
  workspace: Workspace
  accountToServiceNameMap: Record<string, string>
  elementsSource: ReadOnlyElementsSource
  ignoreStateElemIdMapping: boolean
  ignoreStateElemIdMappingForSelectors: ElementSelector[]
}): Promise<Record<string, ElemIdGetter>> => {
  if (ignoreStateElemIdMapping && ignoreStateElemIdMappingForSelectors.length === 0) {
    return {}
  }
  const referenceSourcesIndex = await workspace.getReferenceSourcesIndex()
  return mapValuesAsync(accountToServiceNameMap, async (_service, account) =>
    createElemIdGetter(
      await getElementsToMaintain({
        accountToServiceNameMap,
        account,
        elementsSource,
        ignoreStateElemIdMapping,
        ignoreStateElemIdMappingForSelectors,
        referenceSourcesIndex,
      }),
      workspace.state(),
    ),
  )
}

export const getFetchAdapterAndServicesSetup = async ({
  workspace,
  fetchAccounts,
  accountToServiceNameMap,
  elementsSource,
  ignoreStateElemIdMapping = false,
  ignoreStateElemIdMappingForSelectors = [],
  adapterCreators,
}: {
  workspace: Workspace
  fetchAccounts: string[]
  accountToServiceNameMap: Record<string, string>
  elementsSource: ReadOnlyElementsSource
  ignoreStateElemIdMapping?: boolean
  ignoreStateElemIdMappingForSelectors?: ElementSelector[]
  adapterCreators: Record<string, Adapter>
}): Promise<{
  adaptersCreatorConfigs: Record<string, AdapterOperationsContext>
  currentConfigs: InstanceElement[]
}> => {
  const elemIDGetters = await createElemIdGetters({
    workspace,
    accountToServiceNameMap,
    elementsSource,
    ignoreStateElemIdMapping,
    ignoreStateElemIdMappingForSelectors,
  })
  const resolveTypes = true
  const adaptersCreatorConfigs = await getAdaptersCreatorConfigs(
    fetchAccounts,
    await workspace.accountCredentials(fetchAccounts),
    workspace.accountConfig.bind(workspace),
    elementsSource,
    accountToServiceNameMap,
    elemIDGetters,
    resolveTypes,
    adapterCreators,
  )
  const currentConfigs = Object.values(adaptersCreatorConfigs)
    .map(creatorConfig => creatorConfig.config)
    .filter(config => !_.isUndefined(config)) as InstanceElement[]

  return { adaptersCreatorConfigs, currentConfigs }
}
