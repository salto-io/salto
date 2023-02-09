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
import { getChangeData, isAdditionOrModificationChange, isInstanceChange, Change, ChangeDataType, isInstanceElement } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { PRIORITY_TYPE_NAME } from '../constants'
import { removeDomainPrefix } from './avatars'

const filter: FilterCreator = ({ client }) => ({
  name: 'priorityFilter',
  onFetch: async elements => {
    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === PRIORITY_TYPE_NAME)
      .filter(instance => !instance.value.isDefault)
      .forEach(instance => { delete instance.value.isDefault })
  },

  preDeploy: async (changes: Change<ChangeDataType>[]) => {
    changes.filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .filter(change => getChangeData(change).elemID.typeName === PRIORITY_TYPE_NAME)
      .filter(change => getChangeData(change).value.iconUrl !== undefined)
      .forEach(change => {
        change.data.after.value.iconUrl = new URL(
          getChangeData(change).value.iconUrl, client.baseUrl
        ).href
      })
  },

  onDeploy: async (changes: Change<ChangeDataType>[]) => {
    changes.filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .filter(change => getChangeData(change).elemID.typeName === PRIORITY_TYPE_NAME)
      .filter(change => getChangeData(change).value.iconUrl !== undefined)
      .forEach(change => {
        change.data.after.value.iconUrl = removeDomainPrefix(
          getChangeData(change).value.iconUrl, client.baseUrl
        )
      })
  },
})

export default filter
