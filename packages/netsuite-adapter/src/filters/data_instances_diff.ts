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
import { getChangeData, InstanceElement, isEqualValues, isInstanceChange, isModificationChange, ModificationChange } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { isDataObjectType } from '../types'
import { FilterWith } from '../filter'

const { awu } = collections.asynciterable

export const getDifferentKeys = (
  change: ModificationChange<InstanceElement>
): Set<string> => new Set(
  Object.keys(change.data.after.value)
    .filter(key => !isEqualValues(
      change.data.after.value[key],
      change.data.before.value[key]
    ))
)

export const removeIdenticalValues = (change: ModificationChange<InstanceElement>): void => {
  const differentKeys = getDifferentKeys(change)
  Object.values(change.data).forEach(element => {
    element.value = _.pickBy(
      element.value,
      (_value, key) => differentKeys.has(key) || key === 'attributes'
    )
  })
}

const filterCreator = (): FilterWith<'preDeploy'> => ({
  name: 'dataInstancesDiff',
  preDeploy: async changes => {
    await awu(changes)
      .filter(isModificationChange)
      .filter(isInstanceChange)
      .filter(async change => isDataObjectType(
        await getChangeData<InstanceElement>(change).getType()
      ))
      .forEach(removeIdenticalValues)
  },
})

export default filterCreator
