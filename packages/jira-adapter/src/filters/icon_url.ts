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
import { isAdditionOrModificationChange, isInstanceChange, getChangeData, InstanceElement, Change } from '@salto-io/adapter-api'
import { applyFunctionToChangeData } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { STATUS_TYPE_NAME } from '../constants'
import { FilterCreator } from '../filter'

const { awu } = collections.asynciterable

const RELEVANT_TYPES = [STATUS_TYPE_NAME]

const filter: FilterCreator = () => ({
  name: 'iconUrlFilter',
  preDeploy: async changes => {
    await awu(changes)
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .filter(change => RELEVANT_TYPES.includes(getChangeData(change).elemID.typeName))
      .forEach(async change => {
        await applyFunctionToChangeData<Change<InstanceElement>>(
          change,
          instance => {
            instance.value.iconurl = instance.value.iconUrl
            delete instance.value.iconUrl
            return instance
          }
        )
      })
  },

  onDeploy: async changes => {
    await awu(changes)
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .filter(change => RELEVANT_TYPES.includes(getChangeData(change).elemID.typeName))
      .forEach(async change => {
        await applyFunctionToChangeData<Change<InstanceElement>>(
          change,
          instance => {
            instance.value.iconUrl = instance.value.iconurl
            delete instance.value.iconurl
            return instance
          }
        )
      })
  },
})

export default filter
