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
  ADAPTER, FIELD_NAME, INSTANCE_NAME, OBJECT_NAME, ElemIdGetter, DetailedChange,
} from '@salto-io/adapter-api'
import {
  applyInstancesDefaults, resolvePath, flattenElementStr,
} from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { merger } from '@salto-io/workspace'
import { StepEvents } from './deploy'
import { getPlan, Plan } from './plan'
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
  before: ReadonlyArray<Element>,
  after: ReadonlyArray<Element>,
  additionalResolveContext?: ReadonlyArray<Element>,
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
): Promise<Record<string, DetailedChange>> =>
  _.fromPairs(
    wu(await getDetailedChanges(before, after))
      .map(change => [change.id.getFullName(), change])
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

const processMergeErrors = (
  elements: Element[],
  errors: merger.MergeError[],
  stateElementIDs: string[]
): ProcessMergeErrorsResult => log.time(() => {
  const mergeErrsByElemID = _(errors)
    .map(me => ([
      me.elemID.createTopLevelParentID().parent.getFullName(),
      { error: me, elements: [] }]))
    .fromPairs()
    .value() as Record<string, MergeErrorWithElements>

  const errorsWithDroppedElements: MergeErrorWithElements[] = []
  const errorsWithStateElements: MergeErrorWithElements[] = []
  const keptElements = elements.filter(e => {
    const foundMergeErr = mergeErrsByElemID[e.elemID.getFullName()]
    if (foundMergeErr) {
      foundMergeErr.elements.push(e)
      if (stateElementIDs.includes(e.elemID.getFullName())) {
        errorsWithStateElements.push(foundMergeErr)
      }
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
  if (!_.isEmpty(errorsWithStateElements)) {
    throw new FatalFetchMergeError(
      errorsWithStateElements
    )
  }
  return {
    keptElements,
    errorsWithDroppedElements,
  }
}, 'process merge errors for %o elements with %o errors and %o state elements',
elements.length, errors.length, stateElementIDs.length)

type UpdatedConfig = {
  config: InstanceElement
  message: string
}

const fetchAndProcessMergeErrors = async (
  adapters: Record<string, AdapterOperations>,
  stateElements: ReadonlyArray<Element>,
  getChangesEmitter: StepEmitter,
  progressEmitter?: EventEmitter<FetchProgressEvents>
):
  Promise<{
    serviceElements: Element[]
    processErrorsResult: ProcessMergeErrorsResult
    updatedConfigs: UpdatedConfig[]
  }> => {
  try {
    const fetchResults = await Promise.all(
      Object.entries(adapters)
        .map(async ([adapterName, adapter]) => {
          const fetchResult = await adapter.fetch(
            createAdapterProgressReporter(adapterName, 'fetch', progressEmitter)
          )
          // We need to flatten the elements string to avoid a memory leak. See docs
          // of the flattenElementStr method for more details.
          const { updatedConfig } = fetchResult
          return {
            elements: fetchResult.elements.map(flattenElementStr),
            updatedConfig: updatedConfig
              ? { config: flattenElementStr(updatedConfig.config), message: updatedConfig.message }
              : undefined,
          }
        })
    )
    const serviceElements = _.flatten(fetchResults.map(res => res.elements))
    const updatedConfigs = fetchResults
      .map(res => res.updatedConfig)
      .filter(c => !_.isUndefined(c)) as UpdatedConfig[]
    log.debug(`fetched ${serviceElements.length} elements from adapters`)
    const { errors: mergeErrors, merged: elements } = mergeElements(serviceElements)
    applyInstancesDefaults(elements.filter(isInstanceElement))
    log.debug(`got ${serviceElements.length} from merge results and elements and to ${elements.length} elements [errors=${
      mergeErrors.length}]`)

    const processErrorsResult = processMergeErrors(
      elements,
      mergeErrors,
      stateElements.map(e => e.elemID.getFullName())
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
    return { serviceElements: validServiceElements, processErrorsResult, updatedConfigs }
  } catch (error) {
    getChangesEmitter.emit('failed')
    throw error
  }
}

// Calculate the fetch changes - calculation should be done only if workspace has data,
// o/w all service elements should be consider as "add" changes.
const calcFetchChanges = async (
  serviceElements: ReadonlyArray<Element>,
  mergedServiceElements: ReadonlyArray<Element>,
  stateElements: ReadonlyArray<Element>,
  workspaceElements: ReadonlyArray<Element>
): Promise<Iterable<FetchChange>> => {
  const serviceChanges = await log.time(() =>
    getDetailedChanges(stateElements, mergedServiceElements),
  'finished to calculate service-state changes')
  const pendingChanges = await log.time(() => getChangeMap(
    stateElements,
    workspaceElements
  ), 'finished to calculate pending changes')

  const workspaceToServiceChanges = await log.time(() => getChangeMap(
    workspaceElements,
    mergedServiceElements
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
  stateElements: ReadonlyArray<Element>,
  currentConfigs: InstanceElement[],
  progressEmitter?: EventEmitter<FetchProgressEvents>
): Promise<FetchChangesResult> => {
  const adapterNames = _.keys(adapters)
  const getChangesEmitter = new StepEmitter()
  if (progressEmitter) {
    progressEmitter.emit('changesWillBeFetched', getChangesEmitter, adapterNames)
  }
  const {
    serviceElements, processErrorsResult, updatedConfigs,
  } = await fetchAndProcessMergeErrors(
    adapters,
    stateElements,
    getChangesEmitter,
    progressEmitter
  )
  const calculateDiffEmitter = new StepEmitter()
  if (progressEmitter) {
    getChangesEmitter.emit('completed')
    progressEmitter.emit('diffWillBeCalculated', calculateDiffEmitter)
  }

  const isFirstFetch = _.isEmpty(workspaceElements.concat(stateElements)
    .filter(e => !e.elemID.isConfig()))
  const changes = isFirstFetch
    ? serviceElements.map(toAddFetchChange)
    : await calcFetchChanges(
      serviceElements,
      processErrorsResult.keptElements,
      // When we init a new env, state will be empty. We fallback to the workspace
      // elements since they should be considered a part of the env and the diff
      // should be calculated with them in mind.
      _.isEmpty(stateElements) ? workspaceElements : stateElements,
      workspaceElements
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
  return {
    changes,
    elements: processErrorsResult.keptElements,
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
