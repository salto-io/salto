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
import _ from 'lodash'
import {
  isModificationChange,
  InstanceElement,
  isInstanceChange,
  ModificationChange,
  ChangeError,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { values } from '@salto-io/lowerdash'
import { NetsuiteChangeValidator } from './types'
import { PERMISSION, ROLE } from '../constants'
import {
  RolePermission,
  getPermissionsListPath,
  isRolePermissionObject,
} from '../custom_references/weak_references/permissions_references'

const log = logger(module)

type ItemInList = RolePermission

type GetItemList = (instance: InstanceElement) => ItemInList[]
type GetItemString = (item: ItemInList) => string
type GetListPath = () => string[]
type GetMessage = (removedListItems: string[]) => string

export const getMessageByElementNameAndListItems = (elemName: string, removedListItems: string[]): string =>
  removedListItems.length > 1
    ? `Netsuite doesn't support the removal of inner ${elemName}s ${removedListItems.join(', ')} via API; ` +
      'Salto will ignore these changes for this deployment. ' +
      "Please use Netuiste's UI to remove them"
    : `Netsuite doesn't support the removal of inner ${elemName} ${removedListItems[0]} via API; ` +
      'Salto will ignore this change for this deployment. ' +
      "Please use Netuiste's UI to remove it"

export type ItemListGetters = {
  getItemList: GetItemList
  getItemString: GetItemString
  getListPath: GetListPath
  getDetailedMessage: GetMessage
}

const getRolePermissionList: GetItemList = instance => {
  const listPathValue = _.get(instance.value, getPermissionsListPath())
  if (_.isPlainObject(listPathValue)) {
    return Object.values(listPathValue).filter(isRolePermissionObject)
  }
  if (listPathValue !== undefined) {
    log.warn(
      "Role permissions in %s wasn't a plain object under permissions.permission: %o",
      instance.elemID.getFullName(),
      listPathValue,
    )
  }
  return []
}

const getRolePermkey: GetItemString = (permission: RolePermission): string => {
  const { permkey } = permission
  if (_.isString(permkey)) {
    return permkey
  }
  return permkey.value
}

const getRoleMessage = (removedListItems: string[]): string =>
  getMessageByElementNameAndListItems(PERMISSION, removedListItems)

const roleGetters: ItemListGetters = {
  getItemList: getRolePermissionList,
  getItemString: getRolePermkey,
  getListPath: getPermissionsListPath,
  getDetailedMessage: getRoleMessage,
}

export const getGettersByType = (typeName: string): ItemListGetters | undefined => {
  if (typeName === ROLE) {
    return roleGetters
  }
  return undefined
}

const getIdentifierItemMap = (instance: InstanceElement, getters: ItemListGetters): Record<string, ItemInList> => {
  const itemRecord: Record<string, ItemInList> = Object.fromEntries(
    getters.getItemList(instance).map(item => [getters.getItemString(item), item]),
  )
  return itemRecord
}

export const getRemovedItemsRecord = (
  instanceChange: ModificationChange<InstanceElement>,
  getters: ItemListGetters,
): Record<string, ItemInList> => {
  const { before, after } = instanceChange.data
  const beforeItemList = getIdentifierItemMap(before, getters)
  const afterItemSet = getIdentifierItemMap(after, getters)
  return _.omit(beforeItemList, Object.keys(afterItemSet))
}

const getChangeError = (instanceChange: ModificationChange<InstanceElement>): ChangeError | undefined => {
  const { before } = instanceChange.data
  const { elemID } = before
  const getters = getGettersByType(elemID.typeName)
  if (getters === undefined || _.get(before.value, getters.getListPath()) === undefined) {
    return undefined
  }

  const removedListItems = Object.keys(getRemovedItemsRecord(instanceChange, getters))

  return removedListItems.length > 0
    ? {
        elemID,
        severity: 'Warning',
        message: 'Inner Element Removal Not Supported',
        detailedMessage: getters.getDetailedMessage(removedListItems),
      }
    : undefined
}

const changeValidator: NetsuiteChangeValidator = async changes => {
  const instanceChanges = changes.filter(isModificationChange).filter(isInstanceChange)

  return instanceChanges.map(getChangeError).filter(values.isDefined)
}

export default changeValidator
