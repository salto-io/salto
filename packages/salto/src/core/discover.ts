import _ from 'lodash'
import wu from 'wu'
import { Element, ElemID, Adapter } from 'adapter-api'

import { getPlan, DetailedChange } from './plan'
import { mergeElements } from './merger'
import { validateElements } from './validator'

export type DiscoverChange = {
  // The actual change to apply to the workspace
  change: DetailedChange
  // The change that happened in the service
  serviceChange: DetailedChange
  // The change between the working copy and the state
  pendingChange?: DetailedChange
}

const mergeAndValidate = (elements: ReadonlyArray<Element>): Element[] => {
  const { merged: mergedElements, errors: mergeErrors } = mergeElements(elements)
  const validationErrors = validateElements(mergedElements)
  const errors = [...mergeErrors, ...validationErrors].map(e => e.message)
  if (errors.length > 0) {
    throw new Error(`Errors validating discovered elements:\n\t${errors.join('\n\t')}`)
  }
  return mergedElements
}

const getDetailedChanges = (
  before: ReadonlyArray<Element>,
  after: ReadonlyArray<Element>,
): wu.WuIterable<DetailedChange> => (
  wu(getPlan(before, after, false).itemsByEvalOrder())
    .map(item => item.detailedChanges())
    .flatten()
)

const getChangeMap = (
  before: ReadonlyArray<Element>,
  after: ReadonlyArray<Element>,
): Record<string, DetailedChange> => (
  _.fromPairs(
    getDetailedChanges(before, after)
      .map(change => [change.id.getFullName(), change])
      .toArray(),
  )
)

type ChangeTransformFunction = (sourceChange: DiscoverChange) => DiscoverChange[]
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

type DiscoverChangeConvertor = (change: DetailedChange) => DiscoverChange[]
const toDiscoverChanges = (
  pendingChanges: Record<string, DetailedChange>,
  workspaceToServiceChanges: Record<string, DetailedChange>
): DiscoverChangeConvertor => {
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

type DiscoverChangesResult = {
  changes: Iterable<DiscoverChange>
  elements: Element[]
}

export const discoverChanges = async (
  adapters: Record<string, Adapter>,
  workspaceElements: ReadonlyArray<Element>,
  stateElements: ReadonlyArray<Element>,
): Promise<DiscoverChangesResult> => {
  const serviceElements = _.flatten(await Promise.all(
    Object.values(adapters).map(adapter => adapter.discover())
  ))

  const mergedServiceElements = mergeAndValidate(serviceElements)

  const serviceChanges = getDetailedChanges(stateElements, mergedServiceElements)
  const pendingChanges = getChangeMap(stateElements, workspaceElements)
  const workspaceToServiceChanges = getChangeMap(workspaceElements, mergedServiceElements)

  const changes = serviceChanges
    .map(toDiscoverChanges(pendingChanges, workspaceToServiceChanges))
    .flatten()
    .map(toChangesWithPath(serviceElements))
    .flatten()

  return { changes, elements: mergedServiceElements }
}
