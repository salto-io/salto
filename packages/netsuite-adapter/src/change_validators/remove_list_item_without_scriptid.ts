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
  isModificationChange, InstanceElement, isInstanceChange,
  Value,
  ReferenceExpression,
  ModificationChange,
  ElemID,
  ChangeError,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { values } from '@salto-io/lowerdash'
import { NetsuiteChangeValidator } from './types'
import { PERMISSIONS, ROLE } from '../constants'

const log = logger(module)

const PERMISSION = 'permission'

type RolePermissionObject = {
  permkey: string | ReferenceExpression
  permlevel: string
  restriction?: string
}

export type ItemInList = RolePermissionObject

type GetItemList = (instance: InstanceElement) => ItemInList[]
type GetItemString = (item: ItemInList) => string
type GetItemByID = (instance: InstanceElement, id: string) => ItemInList | undefined
type GetListPath = () => string[]
type GetMessage = (removedListItems: string[]) => string

const getMessageByElementNameAndListItems = (elemName: string, removedListItems: string[]): string =>
  `Can't remove the inner ${elemName}${removedListItems.length > 1 ? 's' : ''} ${removedListItems.join(', ')}. NetSuite supports the removal of inner elements only from its UI.`

export type ItemListGetters = {
  getItemList: GetItemList
  getItemString: GetItemString
  getItemByID: GetItemByID
  getListPath: GetListPath
  getDetailedMessage: GetMessage
}

const isRolePermissionObject = (obj: Value): obj is RolePermissionObject => {
  const returnVal = (
    _.isPlainObject(obj)
    && (typeof obj.permkey === 'string' || isReferenceExpression(obj.permkey))
    && typeof obj.permlevel === 'string'
    && (typeof obj.restriction === 'string' || obj.restriction === undefined)
  )
  if (!returnVal) {
    log.debug('There is a role permission with a different shape', obj)
  }
  return returnVal
}

const getRoleListPath: GetListPath = () => [
  PERMISSIONS,
  PERMISSION,
]

const getRolePermissionList:GetItemList = instance => {
  const listPathValue = _.get(instance.value, getRoleListPath())
  if (_.isPlainObject(listPathValue)) {
    return Object.values(listPathValue)
      .filter(isRolePermissionObject)
  }
  if (listPathValue !== undefined) {
    log.debug("Role permissions wasn't a plain object under permissions.permission", instance)
  }
  return []
}

const getRolePermkey: GetItemString = (
  permission: RolePermissionObject
): string => {
  const { permkey } = permission
  if (_.isString(permkey)) {
    return permkey
  }
  return permkey.value
}

const getRolePermissionByName = (
  role: InstanceElement,
  id: string,
): RolePermissionObject | undefined => (
  getRolePermissionList(role)
    .find(permObj => getRolePermkey(permObj) === id)
)

const getRoleMessage = (removedListItems: string[]): string =>
  getMessageByElementNameAndListItems(PERMISSION, removedListItems)

const roleGetters: ItemListGetters = {
  getItemList: getRolePermissionList,
  getItemString: getRolePermkey,
  getItemByID: getRolePermissionByName,
  getListPath: getRoleListPath,
  getDetailedMessage: getRoleMessage,
}

export const getGettersByType = (
  typeName: string,
): ItemListGetters | undefined => {
  if (typeName === ROLE) {
    return roleGetters
  }
  return undefined
}
const getIdentifierList = (
  instance: InstanceElement,
  getters: ItemListGetters,
): string[] =>
  getters.getItemList(instance).map(getters.getItemString)

export const getRemovedListItemIds = (
  instanceChange: ModificationChange<InstanceElement>,
  getters: ItemListGetters,
): string[] => {
  const { before, after } = instanceChange.data
  const beforeItemList = getIdentifierList(before, getters)
  const afterItemSet = new Set(getIdentifierList(after, getters))
  return beforeItemList.filter(id => !afterItemSet.has(id))
}

const getDetailedMessage = (
  instanceChange: ModificationChange<InstanceElement>,
): {
  elemID: ElemID
  detailedMessage: string
} | undefined => {
  const { before, after } = instanceChange.data
  const { elemID } = before
  const getters = getGettersByType(elemID.typeName)
  if (getters === undefined || _.isUndefined(_.get(before.value, getters.getListPath()))) {
    return undefined
  }

  if (_.isUndefined(_.get(after.value, getters.getListPath()))) {
    return {
      elemID,
      detailedMessage: `Can't remove the list ${getters.getListPath().join('.')}.`,
    }
  }

  const removedListItems = getRemovedListItemIds(instanceChange, getters)
  return (removedListItems.length > 0) ? {
    elemID,
    detailedMessage: getters.getDetailedMessage(removedListItems),
  } : undefined
}


const changeValidator: NetsuiteChangeValidator = async changes => {
  const instanceChanges = changes
    .filter(isModificationChange)
    .filter(isInstanceChange)

  return instanceChanges
    .map(getDetailedMessage)
    .filter(values.isDefined)
    .map(({ detailedMessage, elemID }): ChangeError => ({
      elemID,
      severity: 'Warning',
      message: 'Can\'t remove inner elements',
      detailedMessage,
    }))
}

export default changeValidator
