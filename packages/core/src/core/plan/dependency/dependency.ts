/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { ChangeDataType, ChangeId, DependencyChange, DependencyChanger } from '@salto-io/adapter-api'
import { DataNodeMap, DiffNode } from '@salto-io/dag'
import { PlanTransformer } from '../common'

const log = logger(module)

const updateDeps = (
  deps: Map<ChangeId, Set<ChangeId>>,
  changes: Iterable<DependencyChange>,
): Map<ChangeId, Set<ChangeId>> =>
  new Map(
    wu.chain(
      deps,
      wu(collections.iterable.groupBy(changes, change => change.dependency.source)).map(([sourceId, srcChanges]) => {
        const [toAdd, toRemove] = _.partition([...srcChanges.values()], change => change.action === 'add').map(
          depChanges => new Set(depChanges.map(change => change.dependency.target)),
        )

        const sourceDeps = deps.get(sourceId) ?? new Set()
        const resultDeps = new Set(
          wu.chain(
            wu(sourceDeps).filter(id => !toRemove.has(id)),
            toAdd.values(),
          ),
        )
        return [sourceId, resultDeps] as [ChangeId, Set<ChangeId>]
      }),
    ),
  )

export const addNodeDependencies =
  (changers: ReadonlyArray<DependencyChanger>): PlanTransformer =>
  graph =>
    log.time(async () => {
      if (changers.length === 0) {
        // If there are no changers we return here to avoid creating changeData for no reason
        return graph
      }
      const changeData = new Map(wu(graph.keys()).map(id => [id, graph.getData(id)]))
      const outputDependencies = changers.reduce(
        async (deps, changer) => updateDeps(await deps, await changer(changeData, await deps)),
        Promise.resolve(new Map(graph)),
      )
      return new DataNodeMap<DiffNode<ChangeDataType>>(await outputDependencies, changeData)
    }, 'add dependencies to graph')
