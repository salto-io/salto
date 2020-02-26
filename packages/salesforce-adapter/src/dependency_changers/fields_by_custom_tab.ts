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
import {
  DependencyChanger, getChangeElement, isField, Field, ChangeEntry, isInstanceChange, Change,
  DependencyChange, INSTANCE_ANNOTATIONS, isReferenceExpression, ElemID, dependencyChange,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { CUSTOM_TAB_METADATA_TYPE } from '../constants'
import { metadataType } from '../transformers/transformer'

const FIELDS_CREATED_BY_CUSTOM_TAB = [
  'LastReferencedDate',
  'LastViewedDate',
]

const isAdditionChangeEntry = (entry: ChangeEntry): boolean => entry[1].action === 'add'

const isRelevantFieldChange = (entry: ChangeEntry): entry is ChangeEntry<Field> => {
  const elem = getChangeElement(entry[1])
  return isField(elem) && FIELDS_CREATED_BY_CUSTOM_TAB.includes(elem.name)
}

const isCustomTabChange = (entry: ChangeEntry): boolean => (
  metadataType(getChangeElement(entry[1])) === CUSTOM_TAB_METADATA_TYPE
)

const getCustomTabParent = (change: Change): ElemID | undefined => {
  const customTab = getChangeElement(change)
  const [parent] = collections.array.makeArray(customTab.annotations[INSTANCE_ANNOTATIONS.PARENT])
  return isReferenceExpression(parent) ? parent.elemId : undefined
}

export const fieldsByCustomTab: DependencyChanger = async changes => {
  const relevantFieldAdditions = collections.iterable.groupBy(
    wu(changes.entries()).filter(isAdditionChangeEntry).filter(isRelevantFieldChange),
    ([_id, change]) => (
      getChangeElement(change).elemID.createTopLevelParentID().parent.getFullName()
    )
  )

  const createDependencyChanges = ([tabChangeId, tabChange]: ChangeEntry): DependencyChange[] => {
    const parent = getCustomTabParent(tabChange)
    if (parent === undefined) {
      return []
    }
    return collections.array.makeArray(relevantFieldAdditions.get(parent.getFullName()))
      .map(([fieldChangeId]) => dependencyChange('add', fieldChangeId, tabChangeId))
  }

  return wu(changes.entries())
    .filter(isAdditionChangeEntry)
    .filter(isInstanceChange)
    .filter(isCustomTabChange)
    .map(createDependencyChanges)
    .flatten(true)
}
