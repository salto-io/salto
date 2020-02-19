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
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import {
  Element, getChangeElement, transform, isInstanceElement, TransformValueFunc,
  isReferenceExpression, ChangeDataType, INSTANCE_ANNOTATIONS, Change,
} from '@salto-io/adapter-api'
import {
  DependencyChanger, ChangeEntry, DependencyChange, addReferenceDependency, addParentDependency,
} from './common'

const getAllReferencedIds = (elem: Element): Set<string> => {
  const allReferencedIds = new Set<string>()
  const transformCallback: TransformValueFunc = val => {
    if (_.isArray(val)) {
      val.forEach(item => transformCallback(item, undefined))
      return val
    }
    if (isReferenceExpression(val)) {
      allReferencedIds.add(val.elemId.getFullName())
    }
    return val
  }

  if (isInstanceElement(elem)) {
    transform(elem.value, elem.type, transformCallback, false)
  }
  transform(elem.annotations, elem.annotationTypes, transformCallback, false)
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
      .map(referencedId => changesById.get(referencedId) ?? [])
      .flatten(true) as wu.WuIterable<ChangeEntry>)
      .filter(([_id, referencedChange]) => referencedChange.action === change.action)
      .map(([referencedId, referencedChange]) => (parents.has(getChangeElemId(referencedChange))
        ? addParentDependency(id, referencedId)
        : addReferenceDependency(change.action, id, referencedId)))
  }

  return wu(changes).map(addChangeDependency).flatten()
}
