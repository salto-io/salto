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
import { getChangeData, InstanceElement, isInstanceChange, isModificationChange, ModificationChange } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { applyFunctionToChangeData } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { isDataObjectType } from '../types'
import { FilterWith } from '../filter'

const { awu } = collections.asynciterable

export const removeIdenticalValues = async (change: ModificationChange<InstanceElement>):
  Promise<ModificationChange<InstanceElement>> => {
  const differentKeys = new Set(_(change.data.after.value)
    .keys()
    .filter(key => !_.isEqual(change.data.after.value[key], change.data.before.value[key]))
    .value())

  return applyFunctionToChangeData<ModificationChange<InstanceElement>>(
    change,
    async element => {
      element.value = _.pickBy(
        element.value,
        (_value, key) => differentKeys.has(key) || key === 'attributes'
      )
      return element
    }
  )
}

const filterCreator = (): FilterWith<'onFetch' | 'preDeploy'> => ({
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onFetch: async () => {},
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
