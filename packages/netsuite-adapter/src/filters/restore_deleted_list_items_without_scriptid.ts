/*
*                      Copyright 2024 Salto Labs Ltd.
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
import { InstanceElement, ModificationChange, isInstanceChange, isModificationChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import { setPath } from '@salto-io/adapter-utils'
import { LocalFilterCreator } from '../filter'
import { ItemInList, ItemListGetters, getGettersByType, getRemovedListItemIds } from '../change_validators/remove_list_item_without_scriptid'

const getRemovedListItems = (
  instanceChange: ModificationChange<InstanceElement>,
  getters: ItemListGetters,
): Record<string, ItemInList> => {
  const idsList = getRemovedListItemIds(instanceChange, getters)
  const itemsRecord: Record<string, ItemInList> = {}
  idsList.forEach(id => {
    const item = getters.getItemByID(instanceChange.data.before, id)
    if (item !== undefined) {
      itemsRecord[id] = item
    }
  })
  return itemsRecord
}

const filterCreator: LocalFilterCreator = () => ({
  name: 'restorDeletedListItems',
  onDeploy: async changes => {
    changes
      .filter(isModificationChange)
      .filter(isInstanceChange)
      .forEach(instanceChange => {
        const getters = getGettersByType(instanceChange.data.before.elemID.typeName)
        const { before, after } = instanceChange.data
        if (getters === undefined || _.isUndefined(_.get(before.value, getters.getListPath()))) {
          return
        }
        if (_.isUndefined(_.get(after.value, getters.getListPath()))) {
          setPath(
            after,
            after.elemID.createNestedID(...getters.getListPath()),
            _.get(before.value, getters.getListPath())
          )
        } else {
          const removedItems = getRemovedListItems(instanceChange, getters)
          Object.assign(
            _.get(after.value, getters.getListPath()),
            removedItems
          )
        }
      })
  },
})

export default filterCreator
