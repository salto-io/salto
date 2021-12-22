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
  getChangeElement, DependencyChanger, dependencyChange, CORE_ANNOTATIONS,
  isReferenceExpression, ChangeId, InstanceElement, Change, isInstanceChange,
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
  const circularReferences: CircularDepsPair[] = []
  wu(deps).forEach(([id, references]) => {
    wu(references ?? []).forEach(refId => {
      const change = changes.get(id)
      const refChange = changes.get(refId)
      if (change && isInstanceChange(change)
        && refChange && isInstanceChange(refChange)
        && (deps.get(refId) ?? new Set()).has(id)) {
        circularReferences.push({
          src: { nodeId: id, change: change as Change<InstanceElement> },
          dst: { nodeId: refId, change: refChange as Change<InstanceElement> },
        })
      }
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
