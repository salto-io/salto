/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { collections, values } from '@salto-io/lowerdash'
import {
  getChangeElement, DependencyChanger, dependencyChange, isInstanceElement,
  CORE_ANNOTATIONS, isReferenceExpression, ChangeId, InstanceElement, Change,
} from '@salto-io/adapter-api'

const { makeArray } = collections.array

type ChangeNode = { nodeId: ChangeId; change: Change<InstanceElement> }
type CircularDepsPair = {
  src: ChangeNode
  dst: ChangeNode
}

export const removeStandaloneFieldDependency: DependencyChanger = async (
  changes, deps
) => {
  const instancesChanges = collections.iterable.groupBy(
    wu(changes).filter(([_id, change]) => isInstanceElement(getChangeElement(change))),
    ([_id, change]) => getChangeElement(change).elemID.getFullName(),
  )
  const circularReferences: CircularDepsPair[] = []
  wu(instancesChanges).forEach(([_id, instanceChanges]) => {
    instanceChanges.forEach(change => {
      const nodeId = change[0]
      const references = deps.get(nodeId)
      wu(references ?? []).forEach(refId => {
        const refChange = changes.get(refId)
        if (refChange
          && isInstanceElement(getChangeElement(refChange))
          && (deps.get(refId) ?? new Set()).has(nodeId)) {
          circularReferences.push({
            src: { nodeId, change: change[1] as Change<InstanceElement> },
            dst: { nodeId: refId, change: refChange as Change<InstanceElement> },
          })
        }
      })
    })
  })
  return circularReferences.map(pair => {
    const searchedId = getChangeElement(pair.dst.change).elemID.getFullName()
    if (makeArray(getChangeElement(pair.src.change).annotations[CORE_ANNOTATIONS.PARENT])
      .find(e => isReferenceExpression(e) && e.elemID.getFullName() === searchedId)) {
      return dependencyChange('remove', pair.dst.nodeId, pair.src.nodeId)
    }
    return undefined
  }).filter(values.isDefined)
}
