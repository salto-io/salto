import wu from 'wu'
import _ from 'lodash'
import { logger } from '@salto/logging'
import { collections } from '@salto/lowerdash'
import { ChangeDataType } from 'adapter-api'
import { DataNodeMap, DiffNode } from '@salto/dag'
import { PlanTransformer } from '../common'
import { DependencyProvider, DependencyChange, ChangeId } from './common'

const log = logger(module)

const updateDeps = (
  deps: Map<ChangeId, Set<ChangeId>>, changes: Iterable<DependencyChange>
): Map<ChangeId, Set<ChangeId>> => (
  new Map(wu.chain(
    deps,
    wu(collections.map.groupBy(changes, change => change.dependency.source))
      .map(([sourceId, srcChanges]) => {
        const [toAdd, toRemove] = _.partition(
          [...srcChanges.values()],
          change => change.action === 'add',
        ).map(depChanges => new Set(depChanges.map(change => change.dependency.target)))

        const sourceDeps = deps.get(sourceId) ?? new Set()
        const resultDeps = new Set(wu.chain(
          wu(sourceDeps).filter(id => !toRemove.has(id)),
          toAdd.values(),
        ))
        return [sourceId, resultDeps] as [ChangeId, Set<ChangeId>]
      })
  ))
)

export const addNodeDependencies = (
  providers: ReadonlyArray<DependencyProvider>
): PlanTransformer => graph => log.time(async () => {
  const changeData = new Map(wu(graph.keys()).map(id => [id, graph.getData(id)]))
  const outputDependencies = providers.reduce(
    async (deps, provider) => updateDeps(await deps, await provider(changeData, await deps)),
    Promise.resolve(new Map(graph)),
  )
  return new DataNodeMap<DiffNode<ChangeDataType>>(await outputDependencies, changeData)
}, 'add dependencies to graph')
