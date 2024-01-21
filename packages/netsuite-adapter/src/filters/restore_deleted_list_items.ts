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
import { logger } from '@salto-io/logging'
import { LocalFilterCreator } from '../filter'
import { ItemInList, ItemListGetters, getGettersByType, getRemovedListItemStrings } from '../change_validators/remove_list_item_without_id'

const log = logger(module)

const getRemovedListItems = (
  instanceChange: ModificationChange<InstanceElement>,
  getters: ItemListGetters,
): { [id: string]: ItemInList }[] => {
  const idsList = getRemovedListItemStrings(instanceChange)
  return idsList.removedListItems
    .map(id => {
      const item = getters.getItemByID(instanceChange.data.before, id)
      if (item === undefined) {
        return undefined
      }
      return { [id]: item }
    })
    .filter((val): val is { [id: string]: ItemInList } => val !== undefined)
}

const filterCreator: LocalFilterCreator = () => ({
  name: 'restorDeletedListItems',
  /**
   * This assigns the service URLs for new instances created through Salto
   */
  onDeploy: async changes => {
    log.debug('')
    changes
      .filter(isModificationChange)
      .filter(isInstanceChange)
      .forEach(instanceChange => {
        const getters = getGettersByType(instanceChange.data.before.elemID.typeName)
        if (getters === undefined) {
          return
        }
        const removedItems = getRemovedListItems(instanceChange, getters)
        Object.assign(
          getters.getItemList(instanceChange.data.after),
          ...removedItems
        )
      })
  },
})

export default filterCreator
