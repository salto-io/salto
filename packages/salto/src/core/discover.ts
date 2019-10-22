import _ from 'lodash'
import wu from 'wu'

import { Element, ObjectType, InstanceElement } from 'adapter-api'
import { getPlan, DetailedChange } from './plan'
import initAdapters from './adapters/adapters'
import { mergeElements } from './merger'
import { validateElements } from './validator'

type DiscoverChangesResult = {
  changes: Iterable<DetailedChange>
  elements: Element[]
}

const configToChange = (config: InstanceElement): DetailedChange => ({
  id: config.elemID,
  action: 'add',
  data: { after: config },
})

export const getUpstreamChanges = (
  stateElements: ReadonlyArray<Element>,
  upstreamElements: ReadonlyArray<Element>,
): DiscoverChangesResult => {
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

  const { merged: mergedElements, errors: mergeErrors } = mergeElements(upstreamElements)
  const validationErrors = validateElements(mergedElements)
  const errors = [...mergeErrors, ...validationErrors].map(e => e.message)
  if (errors.length > 0) {
    throw new Error(`Errors validating discovered elements:\n\t${errors.join('\n\t')}`)
  }
  const upstreamChanges = getPlan(stateElements, mergedElements, false)

  const changes = wu(upstreamChanges.itemsByEvalOrder())
    .map(item => item.detailedChanges())
    .flatten()
    .map(changesWithPath)
    .flatten()
  return { changes, elements: mergedElements }
}

export const discoverChanges = async (
  workspaceElements: ReadonlyArray<Element>,
  stateElements: ReadonlyArray<Element>,
  fillConfig: (configType: ObjectType) => Promise<InstanceElement>,
): Promise<DiscoverChangesResult> => {
  const [adapters, newConfigs] = await initAdapters(workspaceElements, fillConfig)
  const upstreamElements = _.flatten(await Promise.all(
    Object.values(adapters).map(adapter => adapter.discover())
  ))

  const result = getUpstreamChanges(stateElements, upstreamElements)
  return {
    ...result,
    changes: wu.chain(result.changes, newConfigs.map(configToChange)),
  }
}
