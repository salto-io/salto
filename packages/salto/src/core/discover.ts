import _ from 'lodash'
import wu from 'wu'

import { Element, ObjectType, InstanceElement } from 'adapter-api'
import { getPlan, DetailedChange } from './plan'
import initAdapters from './adapters/adapters'

type DiscoverChangesResult = {
  changes: Iterable<DetailedChange>
  elements: Element[]
}

const configToChange = (config: InstanceElement): DetailedChange => ({
  id: config.elemID,
  action: 'add',
  data: { after: config },
})

export const discoverChanges = async (
  workspaceElements: ReadonlyArray<Element>,
  stateElements: ReadonlyArray<Element>,
  fillConfig: (configType: ObjectType) => Promise<InstanceElement>,
): Promise<DiscoverChangesResult> => {
  const [adapters, newConfigs] = await initAdapters(workspaceElements, fillConfig)
  const upstreamElements = _.flatten(await Promise.all(
    Object.values(adapters).map(adapter => adapter.discover())
  ))
  const upstreamChanges = getPlan(stateElements, upstreamElements, false)

  const changes = wu.chain(
    wu(upstreamChanges.itemsByEvalOrder())
      .map(item => item.detailedChanges())
      .flatten(),
    newConfigs.map(configToChange),
  )
  return { changes, elements: upstreamElements }
}
