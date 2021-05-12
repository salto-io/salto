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
import {
  Element, ElemID, AdapterOperations, TypeMap, Values, ServiceIds, BuiltinTypes, ObjectType,
  toServiceIdsString, Field, OBJECT_SERVICE_ID, InstanceElement, isInstanceElement, isObjectType,
  ADAPTER, FIELD_NAME, INSTANCE_NAME, OBJECT_NAME, ElemIdGetter, DetailedChange, SaltoError,
  ProgressReporter,
} from '@salto-io/adapter-api'
import {
  applyInstancesDefaults, resolvePath, flattenElementStr,
} from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections, promises, types } from '@salto-io/lowerdash'
import { merger } from '@salto-io/workspace'
import { StepEvents } from './deploy'
import { getPlan, Plan, AdditionalResolveContext } from './plan'
import {
  AdapterEvents,
  createAdapterProgressReporter,
} from './adapters/progress'

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
  before: ReadonlyArray<Element>,
  after: ReadonlyArray<Element>,
  additionalResolveContext?: AdditionalResolveContext,
): Promise<Iterable<DetailedChange>> =>
  wu((await getPlan({
    before,
    after,
    additionalResolveContext,
    dependencyChangers: [],
  })).itemsByEvalOrder())
    .map(item => item.detailedChanges())
    .flatten()

const getChangeMap = async (
  before: ReadonlyArray<Element>,
  after: ReadonlyArray<Element>,
  additionalResolveContext?: AdditionalResolveContext,
): Promise<Record<string, DetailedChange>> =>
  _.fromPairs(
    wu(await getDetailedChanges(
      before,
      after,
      additionalResolveContext,
    )).map(change => [change.id.getFullName(), change])
      .toArray(),
  )

const findNestedElementPath = (
  changeElemID: ElemID,
  originalParentElements: Element[]
): readonly string[] | undefined => (
  originalParentElements.find(e => !_.isUndefined(resolvePath(e, changeElemID)))?.path
)

type ChangeTransformFunction = (sourceChange: FetchChange) => FetchChange[]
export const toChangesWithPath = (
  serviceElementByFullName: (fullName: string) => Element[]
): ChangeTransformFunction => (
  change => {
    const changeID: ElemID = change.change.id
    if (!changeID.isTopLevel() && change.change.action === 'add') {
      const path = findNestedElementPath(
        changeID,
        serviceElementByFullName(changeID.createTopLevelParentID().parent.getFullName())
      )
      log.debug(`addition change for nested ${changeID.idType} with id ${changeID.getFullName()}, path found ${path?.join('/')}`)

      return path
        ? [_.merge({}, change, { change: { path } })]
        : [change]
    }
    const originalElements = serviceElementByFullName(changeID.getFullName())
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
  errors: SaltoError[]
  unmergedElements: Element[]
  mergeErrors: MergeErrorWithElements[]
  configChanges: Plan
  adapterNameToConfigMessage: Record<string, string>
}

type ProcessMergeErrorsResult = {
  keptElements: Element[]
  errorsWithDroppedElements: MergeErrorWithElements[]
}

const processMergeErrors = (
  elements: Element[],
  errors: merger.MergeError[],
): ProcessMergeErrorsResult => log.time(() => {
  const mergeErrsByElemID = _(errors)
    .map(me => ([
      me.elemID.createTopLevelParentID().parent.getFullName(),
      { error: me, elements: [] }]))
    .fromPairs()
    .value() as Record<string, MergeErrorWithElements>

  const errorsWithDroppedElements: MergeErrorWithElements[] = []
  const keptElements = elements.filter(e => {
    const foundMergeErr = mergeErrsByElemID[e.elemID.getFullName()]
    if (foundMergeErr) {
      foundMergeErr.elements.push(e)
      errorsWithDroppedElements.push(foundMergeErr)
    }

    // if element is an instance element add it to the type element merge error if exists
    const foundMergeErrForInstanceType = isInstanceElement(e)
      ? mergeErrsByElemID[e.type.elemID.getFullName()]
      : undefined
    if (foundMergeErrForInstanceType) {
      foundMergeErrForInstanceType.elements.push(e)
    }

    return !foundMergeErr && !foundMergeErrForInstanceType
  })
  return {
    keptElements,
    errorsWithDroppedElements,
  }
}, 'process merge errors for %o elements with %o error',
elements.length, errors.length)

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

const runPostFetch = async ({
  adapters,
  serviceElements,
  stateElementsByAdapter,
  partiallyFetchedAdapters,
  progressReporters,
}: {
  adapters: Record<string, AdapterOperationsWithPostFetch>
  serviceElements: Element[]
  stateElementsByAdapter: Record<string, ReadonlyArray<Element>>
  partiallyFetchedAdapters: Set<string>
  progressReporters: Record<string, ProgressReporter>
}): Promise<void> => {
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
        progressReporter: progressReporters[adapterName],
      })
    ))
  )
}

const fetchAndProcessMergeErrors = async (
  adapters: Record<string, AdapterOperations>,
  filteredStateElements: ReadonlyArray<Element>,
  otherStateElements: ReadonlyArray<Element>,
  getChangesEmitter: StepEmitter,
  progressEmitter?: EventEmitter<FetchProgressEvents>
):
  Promise<{
    serviceElements: Element[]
    errors: SaltoError[]
    processErrorsResult: ProcessMergeErrorsResult
    updatedConfigs: UpdatedConfig[]
    partiallyFetchedAdapters: Set<string>
  }> => {
  try {
    const progressReporters = _.mapValues(
      adapters,
      (_adapter, adapterName) => createAdapterProgressReporter(adapterName, 'fetch', progressEmitter)
    )
    const fetchResults = await Promise.all(
      Object.entries(adapters)
        .map(async ([adapterName, adapter]) => {
          const fetchResult = await adapter.fetch({
            progressReporter: progressReporters[adapterName],
          })
          // We need to flatten the elements string to avoid a memory leak. See docs
          // of the flattenElementStr method for more details.
          const { updatedConfig, errors } = fetchResult
          return {
            elements: fetchResult.elements.map(flattenElementStr),
            errors: errors ?? [],
            updatedConfig: updatedConfig
              ? { config: flattenElementStr(updatedConfig.config), message: updatedConfig.message }
              : undefined,
            isPartial: fetchResult.isPartial ?? false,
            adapterName,
          }
        })
    )

    const serviceElements = _.flatten(fetchResults.map(res => res.elements))
    const fetchErrors = fetchResults.flatMap(res => res.errors)
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
          [...filteredStateElements, ...otherStateElements],
          e => e.elemID.adapter,
        )
        // update elements based on fetch results from other services
        await runPostFetch({
          adapters: adaptersWithPostFetch,
          serviceElements,
          stateElementsByAdapter,
          partiallyFetchedAdapters,
          progressReporters,
        })
        log.debug('ran post-fetch in the following adapters: %s', Object.keys(adaptersWithPostFetch))
      } catch (e) {
        // failures in this step should never fail the fetch
        log.error(`failed to run postFetch: ${e}, stack: ${e.stack}`)
      }
    }

    const { errors: mergeErrors, merged: elements } = mergeElements(serviceElements)
    applyInstancesDefaults(elements.filter(isInstanceElement))
    log.debug(`got ${serviceElements.length} from merge results and elements and to ${elements.length} elements [errors=${
      mergeErrors.length}]`)

    const processErrorsResult = processMergeErrors(
      elements,
      mergeErrors,
    )

    const droppedElements = new Set(
      processErrorsResult.errorsWithDroppedElements.flatMap(
        err => err.elements.map(e => e.elemID.createTopLevelParentID().parent.getFullName())
      )
    )
    const validServiceElements = serviceElements
      .filter(e => !droppedElements.has(e.elemID.getFullName()))

    log.debug(`after merge there are ${processErrorsResult.keptElements.length} elements [errors=${
      mergeErrors.length}]`)
    return {
      serviceElements: validServiceElements,
      errors: fetchErrors,
      processErrorsResult,
      updatedConfigs,
      partiallyFetchedAdapters,
    }
  } catch (error) {
    getChangesEmitter.emit('failed')
    throw error
  }
}

export const getAdaptersFirstFetchPartial = (
  elements: readonly Element[],
  partiallyFetchedAdapters: Set<string>,
): Set<string> => {
  if (_.isEmpty(partiallyFetchedAdapters)) {
    return new Set()
  }
  const adaptersWithElements = new Set(wu(elements).map(e => e.elemID.adapter))
  return collections.set.difference(partiallyFetchedAdapters, adaptersWithElements)
}

// Calculate the fetch changes - calculation should be done only if workspace has data,
// o/w all service elements should be consider as "add" changes.
const calcFetchChanges = async (
  serviceElements: ReadonlyArray<Element>,
  mergedServiceElements: ReadonlyArray<Element>,
  stateElements: ReadonlyArray<Element>,
  workspaceElements: ReadonlyArray<Element>,
  partiallyFetchedAdapters: Set<string>,
): Promise<Iterable<FetchChange>> => {
  const serviceElementsIds = new Set(wu(serviceElements)
    .filter(e => partiallyFetchedAdapters.has(e.elemID.adapter))
    .map(e => e.elemID.getFullName()))

  const shouldConsiderElementInPlan = (e: Element): boolean =>
    (!partiallyFetchedAdapters.has(e.elemID.adapter)
      || serviceElementsIds.has(e.elemID.getFullName()))

  const filteredWorkspaceElements = workspaceElements.filter(shouldConsiderElementInPlan)
  const filteredStateElements = stateElements.filter(shouldConsiderElementInPlan)

  const shouldAddAdditionalContext = !_.isEmpty(partiallyFetchedAdapters)

  const serviceChanges = await log.time(() =>
    getDetailedChanges(
      filteredStateElements,
      mergedServiceElements,
      shouldAddAdditionalContext ? { before: stateElements, after: stateElements } : undefined
    ),
  'finished to calculate service-state changes')
  const pendingChanges = await log.time(() => getChangeMap(
    filteredStateElements,
    filteredWorkspaceElements,
    shouldAddAdditionalContext ? { before: stateElements, after: workspaceElements } : undefined
  ), 'finished to calculate pending changes')

  const workspaceToServiceChanges = await log.time(() => getChangeMap(
    filteredWorkspaceElements,
    mergedServiceElements,
    shouldAddAdditionalContext ? { before: workspaceElements, after: stateElements } : undefined
  ), 'finished to calculate service-workspace changes')

  const serviceElementsMap: Record<string, Element[]> = _.groupBy(
    serviceElements,
    se => se.elemID.getFullName()
  )

  return wu(serviceChanges)
    .map(toFetchChanges(pendingChanges, workspaceToServiceChanges))
    .flatten()
    .map(toChangesWithPath(fullName => serviceElementsMap[fullName] || []))
    .flatten()
}

export const fetchChanges = async (
  adapters: Record<string, AdapterOperations>,
  workspaceElements: ReadonlyArray<Element>,
  filteredStateElements: ReadonlyArray<Element>,
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
    serviceElements, errors, processErrorsResult, updatedConfigs, partiallyFetchedAdapters,
  } = await fetchAndProcessMergeErrors(
    adapters,
    filteredStateElements,
    otherStateElements,
    getChangesEmitter,
    progressEmitter
  )

  getAdaptersFirstFetchPartial(filteredStateElements, partiallyFetchedAdapters).forEach(
    adapter => log.warn('Received partial results from %s before full fetch', adapter)
  )

  const calculateDiffEmitter = new StepEmitter()
  if (progressEmitter) {
    getChangesEmitter.emit('completed')
    progressEmitter.emit('diffWillBeCalculated', calculateDiffEmitter)
  }

  const isFirstFetch = _.isEmpty(workspaceElements.concat(filteredStateElements)
    .filter(e => !e.elemID.isConfig()))

  const changes = isFirstFetch
    ? serviceElements.map(toAddFetchChange)
    : await calcFetchChanges(
      serviceElements,
      processErrorsResult.keptElements,
      // When we init a new env, state will be empty. We fallback to the workspace
      // elements since they should be considered a part of the env and the diff
      // should be calculated with them in mind.
      _.isEmpty(filteredStateElements) ? workspaceElements : filteredStateElements,
      workspaceElements,
      partiallyFetchedAdapters,
    )

  log.debug('finished to calculate fetch changes')
  if (progressEmitter) {
    calculateDiffEmitter.emit('completed')
  }
  const configs = updatedConfigs.map(c => c.config)
  const updatedConfigNames = new Set(configs.map(c => c.elemID.getFullName()))
  const configChanges = await getPlan({
    before: currentConfigs.filter(config => updatedConfigNames.has(config.elemID.getFullName())),
    after: configs,
  })
  const adapterNameToConfigMessage = _
    .fromPairs(updatedConfigs.map(c => [c.config.elemID.adapter, c.message]))

  const elements = partiallyFetchedAdapters.size !== 0
    ? _(filteredStateElements)
      .filter(e => partiallyFetchedAdapters.has(e.elemID.adapter))
      .unshift(...processErrorsResult.keptElements)
      .uniqBy(e => e.elemID.getFullName())
      .value()
    : processErrorsResult.keptElements
  return {
    changes,
    elements,
    errors,
    unmergedElements: serviceElements,
    mergeErrors: processErrorsResult.errorsWithDroppedElements,
    configChanges,
    adapterNameToConfigMessage,
  }
}

const id = (elemID: ElemID): string => elemID.getFullName()

const getServiceIdsFromAnnotations = (annotationTypes: TypeMap, annotations: Values,
  elemID: ElemID): ServiceIds =>
  _(Object.entries(annotationTypes))
    .filter(([_annotationName, annotationType]) =>
      _.isEqual(annotationType, BuiltinTypes.SERVICE_ID))
    .map(([annotationName, _annotationType]) =>
      [annotationName, annotations[annotationName] || id(elemID)])
    .fromPairs()
    .value()

const getObjectServiceId = (objectType: ObjectType): string => {
  const serviceIds = getServiceIdsFromAnnotations(objectType.annotationTypes,
    objectType.annotations, objectType.elemID)
  if (_.isEmpty(serviceIds)) {
    serviceIds[OBJECT_NAME] = id(objectType.elemID)
  }
  serviceIds[ADAPTER] = objectType.elemID.adapter
  return toServiceIdsString(serviceIds)
}

const getFieldServiceId = (objectServiceId: string, field: Field): string => {
  const serviceIds = getServiceIdsFromAnnotations(field.type.annotationTypes, field.annotations,
    field.elemID)
  if (_.isEmpty(serviceIds)) {
    serviceIds[FIELD_NAME] = id(field.elemID)
  }
  serviceIds[ADAPTER] = field.elemID.adapter
  serviceIds[OBJECT_SERVICE_ID] = objectServiceId
  return toServiceIdsString(serviceIds)
}

const getInstanceServiceId = (instanceElement: InstanceElement): string => {
  const serviceIds = _(Object.entries(instanceElement.type.fields))
    .filter(([_fieldName, field]) => _.isEqual(field.type, BuiltinTypes.SERVICE_ID))
    .map(([fieldName, _field]) =>
      [fieldName, instanceElement.value[fieldName] || id(instanceElement.elemID)])
    .fromPairs()
    .value()
  if (_.isEmpty(serviceIds)) {
    serviceIds[INSTANCE_NAME] = id(instanceElement.elemID)
  }
  serviceIds[ADAPTER] = instanceElement.elemID.adapter
  serviceIds[OBJECT_SERVICE_ID] = getObjectServiceId(instanceElement.type)
  return toServiceIdsString(serviceIds)
}

export const generateServiceIdToStateElemId = (stateElements: Element[]): Record<string, ElemID> =>
  _(stateElements)
    .filter(elem => isInstanceElement(elem) || isObjectType(elem))
    .map(elem => {
      if (isObjectType(elem)) {
        const objectServiceId = getObjectServiceId(elem)
        const fieldPairs = Object.values(elem.fields)
          .map(field => [getFieldServiceId(objectServiceId, field), field.elemID])
        return [...fieldPairs, [objectServiceId, elem.elemID]]
      }
      return [[getInstanceServiceId(elem as InstanceElement), elem.elemID]]
    })
    .flatten()
    .fromPairs()
    .value()

export const createElemIdGetter = (stateElements: Element[]): ElemIdGetter => {
  const serviceIdToStateElemId = generateServiceIdToStateElemId(stateElements)
  return (adapterName: string, serviceIds: ServiceIds, name: string): ElemID =>
    serviceIdToStateElemId[toServiceIdsString(serviceIds)] || new ElemID(adapterName, name)
}
