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
import { DependencyChanger, isObjectTypeChange, isFieldChange, dependencyChange, getChangeData } from '@salto-io/adapter-api'
import { values, collections } from '@salto-io/lowerdash'

const { awu } = collections.asynciterable

const createDependencyBetweenTypeAndFields: DependencyChanger = async changes => {
  const changesWithKeys = Array.from(changes.entries())
    .map(([key, change]) => ({ key, change }))
  const typeChanges = _.keyBy(
    changesWithKeys.filter(({ change }) => isObjectTypeChange(change)),
    ({ change }) => getChangeData(change).elemID.getFullName()
  )
  return changesWithKeys.map(({ key, change }) => {
    const parentDependency = isFieldChange(change)
      ? typeChanges[getChangeData(change).parent.elemID.getFullName()]
      : undefined
    return parentDependency
      ? dependencyChange('add', parentDependency.key, key)
      : undefined
  }).filter(values.isDefined)
}

const changers = [
  createDependencyBetweenTypeAndFields,
]

export const dependencyChanger: DependencyChanger = (changes, dependencies) =>
  awu(changers).flatMap(changer => changer(changes, dependencies)).toArray()
