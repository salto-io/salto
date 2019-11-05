import _ from 'lodash'
import wu from 'wu'
import { Element, ElemID, Adapter } from 'adapter-api'
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
    const originalElements = serviceElements.filter(
      elem => elem.elemID.getFullName() === change.change.id.getFullName()
    )
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
