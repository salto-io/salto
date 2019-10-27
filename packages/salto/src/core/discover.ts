import _ from 'lodash'
import wu from 'wu'
import { Element, ElemID, Adapter } from 'adapter-api'

import { getPlan, DetailedChange, Plan } from './plan'
import { mergeElements } from './merger'
import { validateElements } from './validator'
import { CREDS_DIR } from '../workspace/workspace'

export type ChangeWithConflict = {
  change: DetailedChange
  serviceChange: DetailedChange
  localChange?: DetailedChange
}

type DiscoverChangesResult = {
  changes: Iterable<ChangeWithConflict>
  elements: Element[]
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

const addPathToConfig = (config: InstanceElement): InstanceElement => (
  new InstanceElement(config.elemID, config.type, config.value, [CREDS_DIR, config.elemID.adapter])
)

export const getUpstreamChanges = (
  stateElements: ReadonlyArray<Element>,
  upstreamElements: ReadonlyArray<Element>,
  mergedUpstreamElements: ReadonlyArray<Element>,
): wu.WuIterable<DetailedChange> => {
  const changesWithPath = (change: DetailedChange): DetailedChange[] => {
    const originalElements = upstreamElements.filter(
      elem => elem.elemID.getFullName() === change.id.getFullName()
    )
    if (originalElements.length === 0) {
      // Element does not exist upstream, this is either field/value change or a remove change
      // either way there is no path hint to add here
      return [change]
    }
    // Replace merged element with original elements that have a path hint
    return originalElements.map(elem => _.merge({}, change, { data: { after: elem } }))
  }

  const upstreamChangesPlan = getPlan(stateElements, mergedUpstreamElements, false)
  return wu(upstreamChangesPlan.itemsByEvalOrder())
    .map(item => item.detailedChanges())
    .flatten()
    .map(changesWithPath)
    .flatten()
}

type ChangeWithConflictConvertor = (serviceChange: DetailedChange) => ChangeWithConflict[]

const toChangeWithConflict = (
  workspaceElements: ReadonlyArray<Element>,
  stateElements: ReadonlyArray<Element>,
  upstreamElements: ReadonlyArray<Element>,
): ChangeWithConflictConvertor => {
  const toChangeMap = (plan: Plan): Record<string, DetailedChange> => (
    _.fromPairs(
      wu(plan.itemsByEvalOrder())
        .map(item => item.detailedChanges())
        .flatten()
        .map(change => [change.id.getFullName(), change])
        .toArray(),
    )
  )

  const getMatchingChange = (
    id: ElemID,
    from: Record<string, DetailedChange>,
  ): DetailedChange | undefined => (
    id.isConfig()
      ? undefined
      : from[id.getFullName()] || getMatchingChange(id.createParentID(), from)
  )

  const pendingChanges = toChangeMap(getPlan(stateElements, workspaceElements, false))
  const localToService = toChangeMap(getPlan(workspaceElements, upstreamElements, false))

  return serviceChange => {
    const localChange = getMatchingChange(serviceChange.id, pendingChanges)
    const change = getMatchingChange(serviceChange.id, localToService)
    return change === undefined
      ? []
      : [{ change, localChange, serviceChange }]
  }
}

export const discoverChanges = async (
  adapters: Record<string, Adapter>,
  workspaceElements: ReadonlyArray<Element>,
  stateElements: ReadonlyArray<Element>,
): Promise<DiscoverChangesResult> => {
  const rawUpstreamElements = _.flatten(await Promise.all(
    Object.values(adapters).map(adapter => adapter.discover())
  ))

  const upstreamElements = mergeAndValidate(rawUpstreamElements)
  const changes = getUpstreamChanges(stateElements, upstreamElements, upstreamElements)
    .map(toChangeWithConflict(workspaceElements, stateElements, upstreamElements))
    .flatten()

  return { changes, elements: upstreamElements }
}
