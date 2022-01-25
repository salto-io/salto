/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { collections } from '@salto-io/lowerdash'
import {
  getChangeData, isReferenceExpression, ChangeDataType, Change, ChangeEntry, DependencyChange,
  addReferenceDependency, addParentDependency, isDependentAction, DependencyChanger, isObjectType,
  ElemID,
} from '@salto-io/adapter-api'
import { getAllReferencedIds, getParents } from '@salto-io/adapter-utils'

const { awu } = collections.asynciterable

const getParentIds = (elem: ChangeDataType): Set<string> => new Set(
  getParents(elem).filter(isReferenceExpression)
    .map(ref => ref.elemID.createBaseID().parent.getFullName())
)

const getChangeElemId = (change: Change<ChangeDataType>): string => (
  getChangeData(change).elemID.getFullName()
)

export const addReferencesDependency: DependencyChanger = async changes => {
  const changesById = collections.iterable.groupBy(
    changes,
    ([_id, change]) => getChangeElemId(change),
  )

  const addChangeDependency = (
    [id, change]: ChangeEntry
  ): Iterable<DependencyChange> => {
    const elem = getChangeData(change)
    const parents = getParentIds(elem)
    const elemId = elem.elemID.getFullName()
    // Because fields are separate nodes in the graph, for object types we should only consider
    // references from the annotations
    const onlyAnnotations = isObjectType(elem)
    // Not using ElementsSource here is legit because it's ran
    // after resolve
    return (wu(getAllReferencedIds(elem, onlyAnnotations))
      .map(targetId => ElemID.fromFullName(targetId).createBaseID().parent.getFullName())
      .filter(targetId => targetId !== elemId) // Ignore self references
      .map(targetId => changesById.get(targetId) ?? [])
      .flatten(true) as wu.WuIterable<ChangeEntry>)
      .filter(([_id, targetChange]) => isDependentAction(change.action, targetChange.action))
      .map(([targetId, targetChange]) => (parents.has(getChangeElemId(targetChange))
        ? addParentDependency(id, targetId)
        : addReferenceDependency(targetChange.action, id, targetId)))
  }

  return awu(changes).flatMap(addChangeDependency).toArray()
}
