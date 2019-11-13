import _ from 'lodash'
import wu from 'wu'
import {
  Element, ElemID, Adapter, TypeMap, Values, ServiceIds, BuiltinTypes, ObjectType, ADAPTER,
  toServiceIdsString, Field, OBJECT_SERVICE_ID, InstanceElement, isInstanceElement, isObjectType,
  ElemIdGetter,
  findElements,
} from 'adapter-api'
import { logger } from '@salto/logging'
import { getPlan, DetailedChange } from './plan'
import { mergeElements, MergeError } from './merger'

const log = logger(module)

export type FetchChange = {
  // The actual change to apply to the workspace
  change: DetailedChange
  // The change that happened in the service
  serviceChange: DetailedChange
  // The change between the working copy and the state
  pendingChange?: DetailedChange
}


export const getDetailedChanges = (
  before: ReadonlyArray<Element>,
  after: ReadonlyArray<Element>,
): Iterable<DetailedChange> => (
  wu(getPlan(before, after, false).itemsByEvalOrder())
    .map(item => item.detailedChanges())
    .flatten()
)

const getChangeMap = (
  before: ReadonlyArray<Element>,
  after: ReadonlyArray<Element>,
): Record<string, DetailedChange> => (
  _.fromPairs(
    wu(getDetailedChanges(before, after))
      .map(change => [change.id.getFullName(), change])
      .toArray(),
  )
)

type ChangeTransformFunction = (sourceChange: FetchChange) => FetchChange[]
const toChangesWithPath = (serviceElements: ReadonlyArray<Element>): ChangeTransformFunction => (
  change => {
    const originalElements = [...findElements(serviceElements, change.change.id)]
    if (originalElements.length === 0) {
      // Element does not exist upstream, this is either field/value change or a remove change
      // either way there is no path hint to add here
      return [change]
    }
    // Replace merged element with original elements that have a path hint
    return originalElements.map(elem => _.merge({}, change, { change: { data: { after: elem } } }))
  }
)

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

type FetchChangesResult = {
  changes: Iterable<FetchChange>
  elements: Element[]
  mergeErrors: MergeError[]
}

export const fetchChanges = async (
  adapters: Record<string, Adapter>,
  workspaceElements: ReadonlyArray<Element>,
  stateElements: ReadonlyArray<Element>,
): Promise<FetchChangesResult> => {
  const serviceElements = _.flatten(await Promise.all(
    Object.values(adapters).map(adapter => adapter.fetch())
  ))
  log.debug(`fetched ${serviceElements.length} elements from adapters`)

  const { errors: mergeErrors, merged: mergedServiceElements } = mergeElements(serviceElements)
  log.debug(`merged elements to ${mergedServiceElements.length} elements [errors=${
    mergeErrors.length}]`)

  const serviceChanges = getDetailedChanges(stateElements, mergedServiceElements)
  log.debug('finished to calculate service-state changes')
  const pendingChanges = getChangeMap(stateElements, workspaceElements)
  log.debug('finished to calculate pending changes')
  const workspaceToServiceChanges = getChangeMap(workspaceElements, mergedServiceElements)
  log.debug('finished to calculate service-workspace changes')

  const changes = wu(serviceChanges)
    .map(toFetchChanges(pendingChanges, workspaceToServiceChanges))
    .flatten()
    .map(toChangesWithPath(serviceElements))
    .flatten()
  log.debug('finished to calculate fetch changes')
  return { changes, elements: mergedServiceElements, mergeErrors }
}

const id = (elemID: ElemID): string => elemID.getFullName()

const OBJECT_NAME = 'object_name'
const FIELD_NAME = 'field_name'
const INSTANCE_NAME = 'instance_name'

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
  return (adapterName: string, serviceIds: ServiceIds, name: string): ElemID => {
    const stateElemId = serviceIdToStateElemId[toServiceIdsString(serviceIds)]
    return stateElemId || new ElemID(adapterName, name)
  }
}
