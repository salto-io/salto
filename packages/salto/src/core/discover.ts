import _ from 'lodash'
import wu from 'wu'

import { Element, ObjectType, InstanceElement } from 'adapter-api'
import { getPlan, DetailedChange } from './plan'
import initAdapters from './adapters/adapters'

type DiscoverChangesResult = {
  changes: Iterable<DetailedChange>
  elements: Element[]
}

export const discoverChanges = async (
  workspaceElements: ReadonlyArray<Element>,
  stateElements: ReadonlyArray<Element>,
  fillConfig: (configType: ObjectType) => Promise<InstanceElement>,
): Promise<DiscoverChangesResult> => {
  const adapters = await initAdapters(workspaceElements, fillConfig)
  const upstreamElements = _.flatten(await Promise.all(
    Object.values(adapters).map(adapter => adapter.discover())
  ))
  const upstreamChanges = getPlan(stateElements, upstreamElements, false)

  const changes = wu(upstreamChanges.itemsByEvalOrder())
    .map(item => item.detailedChanges())
    .flatten()
  return { changes, elements: upstreamElements }
}
