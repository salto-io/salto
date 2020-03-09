/*
*                      Copyright 2020 Salto Labs Ltd.
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
  getChangeElement, isReferenceExpression, ChangeDataType, INSTANCE_ANNOTATIONS, Change,
  ChangeEntry, DependencyChange, addReferenceDependency, addParentDependency, isDependentAction,
  DependencyChanger,
} from '@salto-io/adapter-api'
import {
  TransformReferenceFunc,
  transformElement,
} from '@salto-io/adapter-utils'

const getAllReferencedIds = (elem: ChangeDataType): Set<string> => {
  const allReferencedIds = new Set<string>()
  const transformCallback: TransformReferenceFunc = val => {
    allReferencedIds.add(val.elemId.getFullName())
    return val
  }

  transformElement({
    element: elem,
    transformReferences: transformCallback,
    strict: false,
  })

  return allReferencedIds
}

const isString = (val?: string): val is string => val !== undefined
const getParentIds = (elem: ChangeDataType): Set<string> => new Set(
  collections.array.makeArray(elem.annotations[INSTANCE_ANNOTATIONS.PARENT])
    .map(val => (isReferenceExpression(val) ? val.elemId.getFullName() : undefined))
    .filter(isString)
)

const getChangeElemId = (change: Change<ChangeDataType>): string => (
  getChangeElement(change).elemID.getFullName()
)

export const addReferencesDependency: DependencyChanger = async changes => {
  const changesById = collections.iterable.groupBy(
    changes,
    ([_id, change]) => getChangeElemId(change),
  )

  const addChangeDependency = ([id, change]: ChangeEntry): Iterable<DependencyChange> => {
    const elem = getChangeElement(change)
    const parents = getParentIds(elem)
    return (wu(getAllReferencedIds(elem))
      .map(targetId => changesById.get(targetId) ?? [])
      .flatten(true) as wu.WuIterable<ChangeEntry>)
      .filter(([_id, targetChange]) => isDependentAction(change.action, targetChange.action))
      .map(([targetId, targetChange]) => (parents.has(getChangeElemId(targetChange))
        ? addParentDependency(id, targetId)
        : addReferenceDependency(targetChange.action, id, targetId)))
  }

  return wu(changes).map(addChangeDependency).flatten()
}
