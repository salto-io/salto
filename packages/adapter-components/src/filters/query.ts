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
import _ from 'lodash'
import { isInstanceElement, InstanceElement, isReferenceExpression } from '@salto-io/adapter-api'
import { filter, getParents } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { AbstractNodeMap } from '@salto-io/dag'
import { logger } from '@salto-io/logging'
import { UserConfigAdapterFilterCreator } from '../filter_utils'

const log = logger(module)

/*
 * Create a graph with instance ids as nodes and parent annotations+fields as edges
 */
export const createParentChildGraph = (
  instances: InstanceElement[],
  additionalParentFields?: Record<string, string[]>,
): AbstractNodeMap => {
  const graph = new AbstractNodeMap()
  instances.forEach(instance => {
    const parents = getParents(instance)
    const additionalParents =
      additionalParentFields?.[instance.elemID.typeName]?.flatMap(fieldName =>
        collections.array.makeArray(instance.value[fieldName]),
      ) ?? []
    const instanceID = instance.elemID.getFullName()
    const parentIDs = parents
      .concat(additionalParents)
      .filter(isReferenceExpression)
      .filter(ref => ref.elemID.idType === 'instance')
      .map(ref => ref.elemID.getFullName())

    parentIDs.forEach(parentID => graph.addEdge(instanceID, parentID))
  })
  return graph
}

/**
 * A filter to filter out instances by the fetchQuery of the adapter
 */
export const queryFilterCreator: <TContext, TResult extends void | filter.FilterResult>({
  additionalParentFields,
  typesToKeep,
}: {
  additionalParentFields?: Record<string, string[]>
  typesToKeep?: string[]
}) => UserConfigAdapterFilterCreator<TContext, TResult> =
  ({ additionalParentFields, typesToKeep }) =>
  ({ fetchQuery }) => ({
    name: 'queryFilter',
    onFetch: async elements => {
      const ignoredTypes = new Set(typesToKeep ?? [])
      const removedInstances = _.remove(
        elements,
        element =>
          isInstanceElement(element) &&
          !ignoredTypes.has(element.elemID.typeName) &&
          !fetchQuery.isInstanceMatch(element),
      )
      if (removedInstances.length === 0) {
        return
      }
      log.debug(
        'Omitted %d instances that did not match the fetch criteria. The first 100 ids that were removed are: %s',
        removedInstances.length,
        removedInstances
          .slice(0, 100)
          .map(e => e.elemID.getFullName())
          .join(', '),
      )

      // recurively remove children of removed instances
      const graph = createParentChildGraph(elements.filter(isInstanceElement), additionalParentFields)
      const additionalIDsToRemove = graph.getComponent({
        roots: removedInstances.map(e => e.elemID.getFullName()),
        reverse: true,
      })
      const dependentRemovedInstances = _.remove(elements, element =>
        additionalIDsToRemove.has(element.elemID.getFullName()),
      )
      if (dependentRemovedInstances.length > 0) {
        log.debug(
          'Omitted %d instances whose parents did not match the fetch criteria. The first 100 ids that were removed are: %s',
          removedInstances.length,
          dependentRemovedInstances
            .slice(0, 100)
            .map(e => e.elemID.getFullName())
            .join(', '),
        )
      }
    },
  })
