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
import wu from 'wu'
import _ from 'lodash'
import { EventEmitter } from 'pietile-eventemitter'
import { Element, ElemID, AdapterOperations, ReferenceMap, Values, ServiceIds, BuiltinTypes, ObjectType, toServiceIdsString, Field, OBJECT_SERVICE_ID, InstanceElement, isInstanceElement, isObjectType, ADAPTER, FIELD_NAME, INSTANCE_NAME, OBJECT_NAME, ElemIdGetter, DetailedChange, ReadOnlyElementsSource } from '@salto-io/adapter-api'
import { applyInstancesDefaults, resolvePath, flattenElementStr } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { merger, elementSource } from '@salto-io/workspace'
import { collections, promises, types } from '@salto-io/lowerdash'
import { StepEvents } from './deploy'
import { getPlan, Plan } from './plan'
import { AdapterEvents, createAdapterProgressReporter } from './adapters/progress'
import { IDFilter } from './plan/plan'

const { awu } = collections.asynciterable
const { mergeElements } = merger
const log = logger(module)

export type FetchChange = {
  // The actual change to apply to the workspace
  change: DetailedChange
  // The change that happened in the service
  serviceChange: DetailedChange
  // The change between the working copy and the state
  pendingChange?: DetailedChange
}

export const toAddFetchChange = (elem: Element): FetchChange => {
  const change: DetailedChange = {
    id: elem.elemID,
    action: 'add',
    data: { after: elem },
  }
  return { change, serviceChange: change }
}


export class StepEmitter extends EventEmitter<StepEvents> {}

export type FetchProgressEvents = {
  adaptersDidInitialize: () => void
  changesWillBeFetched: (stepProgress: StepEmitter, adapterNames: string[]) => void
  diffWillBeCalculated: (stepProgress: StepEmitter) => void
  workspaceWillBeUpdated: (stepProgress: StepEmitter, changes: number, approved: number) => void
  stateWillBeUpdated: (stepProgress: StepEmitter, changes: number) => void
  adapterFetch: (adapterName: string, phase: string) => void
} & AdapterEvents

export type MergeErrorWithElements = {
  error: merger.MergeError
  elements: Element[]
}

export const getDetailedChanges = async (
  before: elementSource.ElementsSource,
  after: elementSource.ElementsSource,
  topLevelFilters: IDFilter[] = []
): Promise<Iterable<DetailedChange>> =>
  wu((await getPlan({
    before,
    after,
    dependencyChangers: [],
    topLevelFilters,
  })).itemsByEvalOrder())
    .map(item => item.detailedChanges())
    .flatten()

const getChangeMap = async (
  before: elementSource.ElementsSource,
  after: elementSource.ElementsSource,
  idFilters: IDFilter[]
): Promise<Record<string, DetailedChange>> =>
  _.fromPairs(
    wu(await getDetailedChanges(before, after, idFilters))
      .map(change => [change.id.getFullName(), change])
      .toArray(),
  )

const findNestedElementPath = (
  changeElemID: ElemID,
  originalParentElements: Element[]
): readonly string[] | undefined => (
  originalParentElements.find(e => !_.isUndefined(resolvePath(e, changeElemID)))?.path
)

type ChangeTransformFunction = (sourceChange: FetchChange) => Promise<FetchChange[]>
export const toChangesWithPath = (
  serviceElementByFullName: (id: ElemID) => Promise<Element[]> | Element[]
): ChangeTransformFunction => (
  async change => {
    const changeID: ElemID = change.change.id
    if (!changeID.isTopLevel() && change.change.action === 'add') {
      const path = findNestedElementPath(
        changeID,
        await serviceElementByFullName(changeID.createTopLevelParentID().parent)
      )
      log.debug(`addition change for nested ${changeID.idType} with id ${changeID.getFullName()}, path found ${path?.join('/')}`)
      return path
        ? [_.merge({}, change, { change: { path } })]
        : [change]
    }
    const originalElements = await serviceElementByFullName(changeID)
    if (originalElements.length === 0) {
      log.debug(`no original elements found for change element id ${changeID.getFullName()}`)
      return [change]
    }
    // Replace merged element with original elements that have a path hint
    return originalElements.map(elem => _.merge({}, change, { change: { data: { after: elem } } }))
  })

type FetchChangeConvertor = (change: DetailedChange) => FetchChange[]
const toFetchChanges = (
  pendingChanges: Record<string, DetailedChange>,
  workspaceToServiceChanges: Record<string, DetailedChange>
): FetchChangeConvertor => {
  const getMatchingChange = (
    id: ElemID,
    from: Record<string, DetailedChange>,
  ): DetailedChange | undefined => (
    id.isConfig()
      ? undefined
      : from[id.getFullName()] || getMatchingChange(id.createParentID(), from)
  )

  return serviceChange => {
    const pendingChange = getMatchingChange(serviceChange.id, pendingChanges)
    const change = getMatchingChange(serviceChange.id, workspaceToServiceChanges)
    return change === undefined
      ? []
      : [{ change, pendingChange, serviceChange }]
  }
}

export type FetchChangesResult = {
  changes: Iterable<FetchChange>
  elements: Element[]
  unmergedElements: Element[]
  mergeErrors: MergeErrorWithElements[]
  configChanges: Plan
  adapterNameToConfigMessage: Record<string, string>
}

export class FatalFetchMergeError extends Error {
  constructor(public causes: MergeErrorWithElements[]) {
    super(`Error occurred during fetch, cause:\n${
      causes.map(c => `Error: ${c.error.message}, Elements: ${c.elements.map(e => e.elemID.getFullName()).join(', ')}\n`)
    }`)
  }
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
  if (!_.isEmpty(errorsWithStateElements)) {
    throw new FatalFetchMergeError(
      errorsWithStateElements
    )
  }
  return {
    keptElements,
    errorsWithDroppedElements,
  }
}, 'process merge errors for %o errors', errors.length)

type UpdatedConfig = {
  config: InstanceElement
  message: string
}

type AdapterOperationsWithPostFetch = types.PickyRequired<AdapterOperations, 'postFetch'>

const isAdapterOperationsWithPostFetch = (
  v: AdapterOperations
): v is AdapterOperationsWithPostFetch => (
  v.postFetch !== undefined
)

const runPostFetch = async (
  adapters: Record<string, AdapterOperationsWithPostFetch>,
  serviceElements: Element[],
  stateElementsByAdapter: Record<string, ReadonlyArray<Element>>,
  partiallyFetchedAdapters: Set<string>,
): Promise<void> => {
  const serviceElementsByAdapter = _.groupBy(serviceElements, e => e.elemID.adapter)

  const getAdapterElements = (adapterName: string): ReadonlyArray<Element> => {
    if (!partiallyFetchedAdapters.has(adapterName)) {
      return serviceElementsByAdapter[adapterName] ?? stateElementsByAdapter[adapterName]
    }
    const fetchedIDs = new Set(
      serviceElementsByAdapter[adapterName].map(e => e.elemID.getFullName())
    )
    const missingElements = stateElementsByAdapter[adapterName].filter(
      e => !fetchedIDs.has(e.elemID.getFullName())
    )
    return [
      ...serviceElementsByAdapter[adapterName],
      ...missingElements,
    ]
  }

  const elementsByAdapter = Object.fromEntries(
    [...new Set([
      ...Object.keys(stateElementsByAdapter),
      ...Object.keys(serviceElementsByAdapter),
    ])].map(adapterName => [adapterName, getAdapterElements(adapterName)])
  )
  // only modifies elements in-place, done sequentially to avoid race conditions
  await promises.array.series(
    Object.entries(adapters).map(([adapterName, adapter]) => async () => (
      adapter.postFetch({
        currentAdapterElements: serviceElementsByAdapter[adapterName],
        elementsByAdapter,
      })
    ))
  )
}

const fetchAndProcessMergeErrors = async (
  adapters: Record<string, AdapterOperations>,
  filteredStateElements: elementSource.ElementsSource,
  otherStateElements: ReadonlyArray<Element>,
  getChangesEmitter: StepEmitter,
  progressEmitter?: EventEmitter<FetchProgressEvents>
):
  Promise<{
    serviceElements: Element[]
    processErrorsResult: ProcessMergeErrorsResult
    updatedConfigs: UpdatedConfig[]
    partiallyFetchedAdapters: Set<string>
  }> => {
  try {
    const fetchResults = await Promise.all(
      Object.entries(adapters)
        .map(async ([adapterName, adapter]) => {
          const fetchResult = await adapter.fetch({
            progressReporter: createAdapterProgressReporter(adapterName, 'fetch', progressEmitter),
          })
          // We need to flatten the elements string to avoid a memory leak. See docs
          // of the flattenElementStr method for more details.
          const { updatedConfig } = fetchResult
          return {
            elements: fetchResult.elements.map(flattenElementStr),
            updatedConfig: updatedConfig
              ? { config: flattenElementStr(updatedConfig.config), message: updatedConfig.message }
              : undefined,
            isPartial: fetchResult.isPartial ?? false,
            adapterName,
          }
        })
    )

    const serviceElements = _.flatten(fetchResults.map(res => res.elements))
    const updatedConfigs = fetchResults
      .map(res => res.updatedConfig)
      .filter(c => !_.isUndefined(c)) as UpdatedConfig[]

    const partiallyFetchedAdapters = new Set(
      fetchResults
        .filter(result => result.isPartial)
        .map(result => result.adapterName)
    )

    log.debug(`fetched ${serviceElements.length} elements from adapters`)

    const adaptersWithPostFetch = _.pickBy(adapters, isAdapterOperationsWithPostFetch)
    if (!_.isEmpty(adaptersWithPostFetch)) {
      try {
        const stateElementsByAdapter = _.groupBy(
          // TODO: Fix this in the next iteration
          [...await awu(await filteredStateElements.getAll()).toArray(), ...otherStateElements],
          e => e.elemID.adapter,
        )
        // update elements based on fetch results from other services
        await runPostFetch(
          adaptersWithPostFetch,
          serviceElements,
          stateElementsByAdapter,
          partiallyFetchedAdapters,
        )
        log.debug('ran post-fetch in the following adapters: %s', Object.keys(adaptersWithPostFetch))
      } catch (e) {
        // failures in this step should never fail the fetch
        log.error(`failed to run postFetch: ${e}, stack: ${e.stack}`)
      }
    }

    const { errors: mergeErrors, merged: elements } = await mergeElements(awu(serviceElements))
    // applyInstancesDefaults(elements.filter(isInstanceElement))
    // log.debug(`got ${serviceElements.length} from merge results and
    // elements and to ${elements.length} elements [errors=${
    //   mergeErrors.length}]`)

    // We need to think about printing the size of it :/
    // log.debug(`got ${serviceElements.length} from merge
    // results and elements and to ${elements.length}
    // elements [errors=${
    //   mergeErrors.length}]`)
    const mergeErrorsArr = await awu(mergeErrors.values()).flat().toArray()
    const processErrorsResult = await processMergeErrors(
      applyInstancesDefaults(elements.values()),
      mergeErrorsArr,
      filteredStateElements,
    )

    const droppedElements = new Set(
      processErrorsResult.errorsWithDroppedElements.flatMap(
        err => err.elements.map(e => e.elemID.createTopLevelParentID().parent.getFullName())
      )
    )
    const validServiceElements = serviceElements
      .filter(e => !droppedElements.has(e.elemID.getFullName()))

    log.debug(`after merge there are ${processErrorsResult.keptElements.length} elements [errors=${
      mergeErrorsArr.length}]`)
    return {
      serviceElements: validServiceElements,
      processErrorsResult,
      updatedConfigs,
      partiallyFetchedAdapters,
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
// o/w all service elements should be consider as "add" changes.
const calcFetchChanges = async (
  serviceElements: ReadonlyArray<Element>,
  mergedServiceElements: elementSource.ElementsSource,
  stateElements: elementSource.ElementsSource,
  workspaceElements: elementSource.ElementsSource,
  partiallyFetchedAdapters: Set<string>,
): Promise<Iterable<FetchChange>> => {
  const paritalFetchFilter: IDFilter = id => (
    !partiallyFetchedAdapters.has(id.adapter) || mergedServiceElements.has(id)
  )

  const serviceChanges = [...await log.time(() =>
    getDetailedChanges(
      stateElements,
      mergedServiceElements,
      [paritalFetchFilter]
    ),
  'finished to calculate service-state changes')]
  const pendingChanges = await log.time(() => getChangeMap(
    stateElements,
    workspaceElements,
    [paritalFetchFilter]
  ), 'finished to calculate pending changes')

  const workspaceToServiceChanges = await log.time(() => getChangeMap(
    workspaceElements,
    mergedServiceElements,
    [paritalFetchFilter]
  ), 'finished to calculate service-workspace changes')
  const serviceElementsMap = _.groupBy(
    serviceElements,
    e => e.elemID.getFullName()
  )

  return awu(serviceChanges)
    .flatMap(toFetchChanges(pendingChanges, workspaceToServiceChanges))
    .flatMap(toChangesWithPath(
      async name => serviceElementsMap[name.getFullName()] ?? []
    )).toArray()
}

export const fetchChanges = async (
  adapters: Record<string, AdapterOperations>,
  workspaceElements: elementSource.ElementsSource,
  stateElements: elementSource.ElementsSource,
  otherStateElements: ReadonlyArray<Element>,
  currentConfigs: InstanceElement[],
  progressEmitter?: EventEmitter<FetchProgressEvents>
): Promise<FetchChangesResult> => {
  const adapterNames = _.keys(adapters)
  const getChangesEmitter = new StepEmitter()
  if (progressEmitter) {
    progressEmitter.emit('changesWillBeFetched', getChangesEmitter, adapterNames)
  }
  const {
    serviceElements, processErrorsResult, updatedConfigs, partiallyFetchedAdapters,
  } = await fetchAndProcessMergeErrors(
    adapters,
    stateElements,
    otherStateElements,
    getChangesEmitter,
    progressEmitter
  )

  const adaptersFirstFetchPartial = await getAdaptersFirstFetchPartial(
    stateElements,
    partiallyFetchedAdapters
  )
  adaptersFirstFetchPartial.forEach(
    adapter => log.warn('Received partial results from %s before full fetch', adapter)
  )

  const calculateDiffEmitter = new StepEmitter()
  if (progressEmitter) {
    getChangesEmitter.emit('completed')
    progressEmitter.emit('diffWillBeCalculated', calculateDiffEmitter)
  }

  const isFirstFetch = await awu(await workspaceElements.getAll())
    .concat(await stateElements.getAll())
    .filter(e => !e.elemID.isConfig())
    .isEmpty()
  const changes = isFirstFetch
    ? serviceElements.map(toAddFetchChange)
    : await calcFetchChanges(
      serviceElements,
      elementSource.createInMemoryElementSource(processErrorsResult.keptElements),
      // When we init a new env, state will be empty. We fallback to the workspace
      // elements since they should be considered a part of the env and the diff
      // should be calculated with them in mind.
      await awu(await stateElements.getAll()).isEmpty() ? workspaceElements : stateElements,
      workspaceElements,
      partiallyFetchedAdapters
    )

  log.debug('finished to calculate fetch changes')
  if (progressEmitter) {
    calculateDiffEmitter.emit('completed')
  }
  const configs = updatedConfigs.map(c => c.config)
  const updatedConfigNames = new Set(configs.map(c => c.elemID.getFullName()))
  const configChanges = await getPlan({
    before: elementSource.createInMemoryElementSource(
      currentConfigs.filter(config => updatedConfigNames.has(config.elemID.getFullName()))
    ),
    after: elementSource.createInMemoryElementSource(configs),
  })
  const adapterNameToConfigMessage = _
    .fromPairs(updatedConfigs.map(c => [c.config.elemID.adapter, c.message]))

  const elements = partiallyFetchedAdapters.size !== 0
    ? _(await awu(await stateElements.getAll()).toArray())
      .filter(e => partiallyFetchedAdapters.has(e.elemID.adapter))
      .unshift(...processErrorsResult.keptElements)
      .uniqBy(e => e.elemID.getFullName())
      .value()
    : processErrorsResult.keptElements
  return {
    changes,
    elements,
    unmergedElements: serviceElements,
    mergeErrors: processErrorsResult.errorsWithDroppedElements,
    configChanges,
    adapterNameToConfigMessage,
  }
}

const id = (elemID: ElemID): string => elemID.getFullName()

const getServiceIdsFromAnnotations = (annotationRefTypes: ReferenceMap, annotations: Values,
  elemID: ElemID): ServiceIds =>
  _(Object.entries(annotationRefTypes))
    .filter(([_annotationName, annotationRefType]) =>
      (annotationRefType.elemID.isEqual(BuiltinTypes.SERVICE_ID.elemID)))
    .map(([annotationName, _annotationType]) =>
      [annotationName, annotations[annotationName] || id(elemID)])
    .fromPairs()
    .value()

const getObjectServiceId = (objectType: ObjectType): string => {
  const serviceIds = getServiceIdsFromAnnotations(objectType.annotationRefTypes,
    objectType.annotations, objectType.elemID)
  if (_.isEmpty(serviceIds)) {
    serviceIds[OBJECT_NAME] = id(objectType.elemID)
  }
  serviceIds[ADAPTER] = objectType.elemID.adapter
  return toServiceIdsString(serviceIds)
}

const getFieldServiceId = async (
  objectServiceId: string,
  field: Field,
  elementsSource: ReadOnlyElementsSource,
): Promise<string> => {
  const serviceIds = getServiceIdsFromAnnotations(
    (await field.getType(elementsSource)).annotationRefTypes,
    field.annotations,
    field.elemID
  )
  if (_.isEmpty(serviceIds)) {
    serviceIds[FIELD_NAME] = id(field.elemID)
  }
  serviceIds[ADAPTER] = field.elemID.adapter
  serviceIds[OBJECT_SERVICE_ID] = objectServiceId
  return toServiceIdsString(serviceIds)
}

const getInstanceServiceId = async (
  instanceElement: InstanceElement,
  elementsSource: ReadOnlyElementsSource,
): Promise<string> => {
  const instType = await instanceElement.getType(elementsSource)
  const serviceIds = _(Object.entries(instType.fields))
    .filter(([_fieldName, field]) =>
      (field.refType.elemID.isEqual(BuiltinTypes.SERVICE_ID.elemID)))
    .map(([fieldName, _field]) =>
      [fieldName, instanceElement.value[fieldName] || id(instanceElement.elemID)])
    .fromPairs()
    .value()
  if (_.isEmpty(serviceIds)) {
    serviceIds[INSTANCE_NAME] = id(instanceElement.elemID)
  }
  serviceIds[ADAPTER] = instanceElement.elemID.adapter
  serviceIds[OBJECT_SERVICE_ID] = getObjectServiceId(instType)
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
        const objectServiceId = getObjectServiceId(elem)
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
  src: ReadOnlyElementsSource
): Promise<ElemIdGetter> => {
  const serviceIdToStateElemId = await generateServiceIdToStateElemId(
    elements,
    src
  )

  return (adapterName: string, serviceIds: ServiceIds, name: string): ElemID =>
    serviceIdToStateElemId[toServiceIdsString(serviceIds)] || new ElemID(adapterName, name)
}
