/*
*                      Copyright 2023 Salto Labs Ltd.
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
  getChangeData, isReferenceExpression, ChangeDataType, Change, ChangeEntry, DependencyChange,
  addReferenceDependency, addParentDependency, isDependentAction, DependencyChanger, isObjectType,
  ElemID, isModificationChange, isField, isEqualValues, dependencyChange,
} from '@salto-io/adapter-api'
import { getAllReferencedIds, getParents, resolvePath } from '@salto-io/adapter-utils'

const { awu } = collections.asynciterable

const getParentIds = (elem: ChangeDataType): Set<string> => new Set(
  getParents(elem).filter(isReferenceExpression)
    .map(ref => ref.elemID.createBaseID().parent.getFullName())
)

const getChangeElemId = (change: Change<ChangeDataType>): string => (
  getChangeData(change).elemID.getFullName()
)

const isReferenceValueChanged = (change: Change<ChangeDataType>, refElemId: ElemID): boolean => {
  if (!isModificationChange(change) || refElemId.isBaseID()) {
    return false
  }
  const beforeTopLevel = isField(change.data.before) ? change.data.before.parent : change.data.before
  const afterTopLevel = isField(change.data.after) ? change.data.after.parent : change.data.after
  return !isEqualValues(
    resolvePath(beforeTopLevel, refElemId),
    resolvePath(afterTopLevel, refElemId),
    { compareReferencesByValue: true }
  )
}

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
    return wu(getAllReferencedIds(elem, onlyAnnotations))
      .map(targetRefIdFullName => {
        const targetRefId = ElemID.fromFullName(targetRefIdFullName)
        const targetElemId = targetRefId.createBaseID().parent.getFullName()
        // Ignore self references
        if (targetElemId === elemId) {
          return undefined
        }
        const [targetChangeEntry] = changesById.get(targetElemId) ?? []
        if (targetChangeEntry === undefined) {
          return undefined
        }
        const [targetId, targetChange] = targetChangeEntry
        if (isDependentAction(change.action, targetChange.action)) {
          return parents.has(getChangeElemId(targetChange))
            ? addParentDependency(id, targetId)
            : addReferenceDependency(targetChange.action, id, targetId)
        }
        if (isReferenceValueChanged(targetChange, targetRefId)) {
          return dependencyChange('add', id, targetId)
        }
        return undefined
      })
      .filter(values.isDefined)
  }

  return awu(changes).flatMap(addChangeDependency).toArray()
}
