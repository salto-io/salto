/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { getChangeData, InstanceElement, isAdditionOrModificationChange, isInstanceChange, Value } from '@salto-io/adapter-api'
import _ from 'lodash'
import { FilterCreator } from '../filter'

const isFilterInstance = (instanceElement: InstanceElement): boolean =>
  instanceElement.elemID.typeName === 'Filter'

const hasEditPermissions = (instanceElement: InstanceElement): boolean =>
  Object.prototype.hasOwnProperty.call(instanceElement.value, 'editPermissions')

const hasSharePermissions = (instanceElement: InstanceElement): boolean =>
  Object.prototype.hasOwnProperty.call(instanceElement.value, 'sharePermissions')

/**
 * Filter to support deploy in DC, handles share permissions
 * 1. Moves all edit permissions to share permissions
 * 2. Changes account id to key
 */
const filter: FilterCreator = ({ client }) => ({
  preDeploy: async changes => {
    if (!client.isDataCenter) {
      return
    }
    changes
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .filter(isFilterInstance)
      .filter(hasSharePermissions)
      .forEach(element => {
        element.value.sharePermissions
          .forEach((sharePermission: Value) => {
            sharePermission.edit = false
            sharePermission.view = true
          })
      })
    changes
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .filter(isFilterInstance)
      .filter(hasEditPermissions)
      .forEach(element => {
        if (element.value.sharePermissions === undefined) {
          element.value.sharePermissions = []
        }
        element.value.editPermissions
          .forEach((editPermission: Value) => {
            editPermission.edit = true
            editPermission.view = true
            if (Object.prototype.hasOwnProperty.call(editPermission, 'user')) {
              editPermission.user.key = editPermission.user.accountId
              delete editPermission.user.accountId
            }
            element.value.sharePermissions.push(editPermission)
          })
        delete element.value.editPermissions
      })
  },
  onDeploy: async changes => {
    if (!client.isDataCenter) {
      return
    }
    changes
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .filter(isFilterInstance)
      .filter(hasSharePermissions)
      .forEach(element => {
        const [editPermissions, sharePermissions] = _.partition(
          element.value.sharePermissions,
          sharePermission => sharePermission.edit
        )

        element.value.editPermissions = editPermissions
        element.value.sharePermissions = sharePermissions
        if (element.value.editPermissions.length === 0) {
          delete element.value.editPermissions
        }
        if (element.value.sharePermissions.length === 0) {
          delete element.value.sharePermissions
        }
        element.value.sharePermissions
          ?.forEach((sharePermission: Value) => {
            delete sharePermission.edit
            delete sharePermission.view
          })
        element.value.editPermissions
          ?.forEach((editPermission: Value) => {
            delete editPermission.edit
            delete editPermission.view
            if (Object.prototype.hasOwnProperty.call(editPermission, 'user')) {
              editPermission.user.accountId = editPermission.user.key
              delete editPermission.user.key
            }
          })
      })
  },
})

export default filter
