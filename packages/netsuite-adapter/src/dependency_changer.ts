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
import _ from 'lodash'
import wu from 'wu'
import { DependencyChanger, isObjectTypeChange, isFieldChange, dependencyChange, getChangeData, isAdditionOrRemovalChange } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'

const { awu } = collections.asynciterable

const typeToFieldsDependencyOnTypeAdditionOrRemoval: DependencyChanger = async changes => {
  const changesWithKeys = wu(changes.entries()).map(([key, change]) => ({ key, change })).toArray()
  const addOrRemoveTypeChanges = _.keyBy(
    changesWithKeys.filter(({ change }) => isObjectTypeChange(change) && isAdditionOrRemovalChange(change)),
    ({ change }) => getChangeData(change).elemID.getFullName()
  )
  const parentToFieldChanges = _.groupBy(
    changesWithKeys.filter(({ change }) => isFieldChange(change)),
    ({ change }) => getChangeData(change).elemID.createTopLevelParentID().parent.getFullName()
  )
  return Object.entries(parentToFieldChanges).flatMap(([parentId, fieldChanges]) => {
    const parentChange = addOrRemoveTypeChanges[parentId]
    return parentChange
      ? fieldChanges.map(({ key }) => dependencyChange('add', parentChange.key, key))
      : []
  })
}

const changers = [
  typeToFieldsDependencyOnTypeAdditionOrRemoval,
]

export const dependencyChanger: DependencyChanger = (changes, dependencies) =>
  awu(changers).flatMap(changer => changer(changes, dependencies)).toArray()
